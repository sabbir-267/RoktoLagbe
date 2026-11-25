// server/src/controllers/tripController.js
//
// Live trip tracking for accepted donors (docs/maps-and-live-tracking.md §2).
// Privacy rules:
//   - only a donor whose response is "accepted" can start/update/end their own trip,
//     and only while the request is open or in_progress
//   - only the requester and admins see trips; a donor sees only their own
//   - coordinates exist only while a trip is "on_the_way" and are never returned
//     by any other endpoint
import BloodRequest from "../models/BloodRequest.js";
import DonorProfile from "../models/DonorProfile.js";
import Notification from "../models/Notification.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { distanceKm } from "../services/matchScoring.js";
import { emitToUser } from "../services/socket.js";

const ACTIVE = ["open", "in_progress"];
export const TRIP_MAX_MS = 4 * 60 * 60 * 1000; // a trip older than this is treated as stopped
export const TRIP_THROTTLE_MS = 4000; // location updates closer together than this are not saved
const ROAD_FACTOR = 1.35; // straight line -> rough road distance
const avgKmh = () => Number(process.env.TRIP_AVG_KMH) || 18;

const COORD_FIELDS = ["lat", "lng", "accuracy"];
const unsetCoords = (prefix) => Object.fromEntries(COORD_FIELDS.map((f) => [`${prefix}.${f}`, ""]));

const hospitalOf = (r) => {
  const c = r.location?.coordinates;
  return Array.isArray(c) && c.length === 2 ? { lat: c[1], lng: c[0] } : null;
};

// ---------- DTOs ----------

export const toTripOwn = (trip, hospital) => {
  const live = trip.status === "on_the_way" && Number.isFinite(trip.lat) && Number.isFinite(trip.lng);
  const km = live && hospital ? distanceKm([trip.lng, trip.lat], [hospital.lng, hospital.lat]) : null;
  let etaMinutes = null;
  if (trip.status === "arrived") etaMinutes = 0;
  else if (km !== null) etaMinutes = Math.round(((km * ROAD_FACTOR) / avgKmh()) * 60);

  return {
    status: trip.status,
    startedAt: trip.startedAt ?? null,
    updatedAt: trip.updatedAt ?? null,
    endedAt: trip.endedAt ?? null,
    ...(live
      ? { lat: trip.lat, lng: trip.lng, ...(Number.isFinite(trip.accuracy) ? { accuracy: trip.accuracy } : {}) }
      : {}),
    distanceKm: km === null ? null : Math.round(km * 100) / 100,
    etaMinutes,
  };
};

// profile: DonorProfile (bloodGroup), user: { name, avatar, phone }
const toTripView = (trip, hospital, profile, user) => ({
  ...toTripOwn(trip, hospital),
  donorId: profile._id,
  name: user?.name,
  avatar: user?.avatar,
  bloodGroup: profile.bloodGroup,
  phone: user?.phone, // already shared with the requester once the donor accepted
});

// ---------- Lazy 4-hour expiry ----------

const isStale = (trip, now = Date.now()) =>
  trip?.status === "on_the_way" && (!trip.startedAt || now - new Date(trip.startedAt).getTime() > TRIP_MAX_MS);

// Ends every stale trip on this request (atomically, one entry at a time) and updates
// the in-memory document to match. Returns the entries that were ended.
const expireStaleTrips = async (r) => {
  const now = new Date();
  const ended = [];
  for (const m of r.matchedDonors) {
    if (!isStale(m.trip, now.getTime())) continue;
    const res = await BloodRequest.updateOne(
      {
        _id: r._id,
        matchedDonors: { $elemMatch: { _id: m._id, "trip.status": "on_the_way", "trip.startedAt": m.trip.startedAt } },
      },
      {
        $set: { "matchedDonors.$.trip.status": "stopped", "matchedDonors.$.trip.endedAt": now, "matchedDonors.$.trip.updatedAt": now },
        $unset: unsetCoords("matchedDonors.$.trip"),
      }
    );
    if (res.modifiedCount === 1) ended.push(m);
    m.trip.status = "stopped";
    m.trip.endedAt = now;
    m.trip.updatedAt = now;
    for (const f of COORD_FIELDS) m.trip[f] = undefined;
  }
  return ended;
};

// Called when a request is closed: ends every running trip and clears its coordinates
export const endTripsForRequest = async (requestId) => {
  const now = new Date();
  try {
    await BloodRequest.updateOne(
      { _id: requestId, "matchedDonors.trip.status": "on_the_way" },
      {
        $set: { "matchedDonors.$[t].trip.status": "stopped", "matchedDonors.$[t].trip.endedAt": now, "matchedDonors.$[t].trip.updatedAt": now },
        $unset: unsetCoords("matchedDonors.$[t].trip"),
      },
      { arrayFilters: [{ "t.trip.status": "on_the_way" }] }
    );
  } catch (err) {
    console.error("Ending trips for a closed request failed:", err.message);
  }
};

// ---------- Side effects (best effort) ----------

const pushUpdate = (r, view) => {
  try {
    emitToUser(r.requester, "trip:update", { requestId: r._id, trip: view });
  } catch {
    /* socket pushes are best effort */
  }
};

const notifyRequester = async (r, title, message) => {
  try {
    const n = await Notification.create({ user: r.requester, type: "request_update", title, message, relatedRequest: r._id });
    try {
      emitToUser(r.requester, "notification:new", { type: "request_update", relatedRequest: r._id, notificationId: n._id });
    } catch {
      /* best effort */
    }
  } catch (err) {
    console.error("Trip notification failed:", err.message);
  }
};

// ---------- Loading the acting donor ----------

// Returns { r, donor, entry } for an accepted donor of this request, or throws 404/403/409
const loadAcceptedDonor = async (req) => {
  const r = await BloodRequest.findById(req.params.id);
  if (!r) throw new ApiError(404, "Request not found");

  const donor = await DonorProfile.findOne({ user: req.user._id }).select("_id bloodGroup");
  const entry = donor && r.matchedDonors.find((m) => String(m.donor) === String(donor._id));
  if (!entry || entry.response !== "accepted") {
    throw new ApiError(403, "Only a donor who accepted this request can share their trip");
  }
  if (!ACTIVE.includes(r.status)) throw new ApiError(409, "This request is closed");

  const expired = await expireStaleTrips(r);
  return { r, donor, entry, expiredOwn: expired.includes(entry) };
};

const reloadEntry = async (r, donor) => {
  const fresh = await BloodRequest.findById(r._id).select("matchedDonors requester location status");
  return fresh?.matchedDonors.find((m) => String(m.donor) === String(donor._id)) || null;
};

const ownFilter = (r, donor, extra = {}) => ({
  _id: r._id,
  status: { $in: ACTIVE },
  matchedDonors: { $elemMatch: { donor: donor._id, response: "accepted", ...extra } },
});

// ---------- Endpoints ----------

// POST /api/requests/:id/trip  { action: "start" | "arrived" | "stop" }
export const tripAction = asyncHandler(async (req, res) => {
  const { action } = req.body;
  const { r, donor, entry, expiredOwn } = await loadAcceptedDonor(req);
  const hospital = hospitalOf(r);
  const user = req.user;
  const now = new Date();
  const prev = entry.trip?.status;

  if (expiredOwn) pushUpdate(r, toTripView(entry.trip, hospital, donor, user));

  if (action === "start") {
    const updated = await BloodRequest.updateOne(ownFilter(r, donor), {
      $set: { "matchedDonors.$.trip": { status: "on_the_way", startedAt: now, updatedAt: now } },
    });
    if (updated.modifiedCount !== 1) throw new ApiError(409, "Could not start your trip. Refresh and try again.");
    const trip = { status: "on_the_way", startedAt: now, updatedAt: now };
    pushUpdate(r, toTripView(trip, hospital, donor, user));
    if (prev !== "on_the_way") {
      await notifyRequester(
        r,
        `${user.name} is on the way`,
        `A donor who accepted your ${r.bloodGroup} request is on the way to ${r.hospital}. Open your request to follow them.`
      );
    }
    return res.json({ success: true, trip: toTripOwn(trip, hospital) });
  }

  // arrived / stop
  if (!prev) throw new ApiError(409, "Start your trip first");
  const next = action === "arrived" ? "arrived" : "stopped";
  // Nothing to change: same status again, or "stop" after already arriving
  if (prev === next || (prev === "arrived" && next === "stopped")) {
    return res.json({ success: true, trip: toTripOwn(entry.trip, hospital) });
  }

  const updated = await BloodRequest.updateOne(ownFilter(r, donor, { "trip.status": prev }), {
    $set: { "matchedDonors.$.trip.status": next, "matchedDonors.$.trip.endedAt": now, "matchedDonors.$.trip.updatedAt": now },
    $unset: unsetCoords("matchedDonors.$.trip"),
  });
  if (updated.modifiedCount !== 1) throw new ApiError(409, "Your trip was just changed. Refresh and try again.");

  const trip = { status: next, startedAt: entry.trip.startedAt, updatedAt: now, endedAt: now };
  pushUpdate(r, toTripView(trip, hospital, donor, user));
  if (next === "arrived") {
    await notifyRequester(
      r,
      `${user.name} has arrived`,
      `A donor for your ${r.bloodGroup} request says they have arrived at ${r.hospital}.`
    );
  }
  res.json({ success: true, trip: toTripOwn(trip, hospital) });
});

// PUT /api/requests/:id/trip/location  { latitude, longitude, accuracy? }
export const updateTripLocation = asyncHandler(async (req, res) => {
  const { r, donor, entry, expiredOwn } = await loadAcceptedDonor(req);
  const hospital = hospitalOf(r);
  if (expiredOwn) pushUpdate(r, toTripView(entry.trip, hospital, donor, req.user));

  const trip = entry.trip;
  if (trip?.status !== "on_the_way") throw new ApiError(409, "Start your trip first");

  const now = new Date();
  const hasPosition = Number.isFinite(trip.lat) && Number.isFinite(trip.lng);
  // Throttle: accepted but not saved if the previous position is less than 4 s old
  if (hasPosition && trip.updatedAt && now - new Date(trip.updatedAt) < TRIP_THROTTLE_MS) {
    return res.json({ success: true, trip: toTripOwn(trip, hospital) });
  }

  const lat = Number(req.body.latitude);
  const lng = Number(req.body.longitude);
  const accuracy = req.body.accuracy === undefined || req.body.accuracy === null ? undefined : Number(req.body.accuracy);

  const update = {
    $set: { "matchedDonors.$.trip.lat": lat, "matchedDonors.$.trip.lng": lng, "matchedDonors.$.trip.updatedAt": now },
  };
  if (accuracy === undefined) update.$unset = { "matchedDonors.$.trip.accuracy": "" };
  else update.$set["matchedDonors.$.trip.accuracy"] = accuracy;

  // Guarded by the same trip (startedAt) still running, and by the throttle window
  const guard = { "trip.status": "on_the_way", "trip.startedAt": trip.startedAt };
  if (hasPosition) guard["trip.updatedAt"] = { $lte: new Date(now.getTime() - TRIP_THROTTLE_MS) };
  const updated = await BloodRequest.updateOne(ownFilter(r, donor, guard), update);

  if (updated.modifiedCount !== 1) {
    // A parallel update won the race, or the trip/request just ended
    const current = await reloadEntry(r, donor);
    if (current?.trip?.status === "on_the_way") return res.json({ success: true, trip: toTripOwn(current.trip, hospital) });
    throw new ApiError(409, "Your trip is no longer active");
  }

  const saved = { status: "on_the_way", startedAt: trip.startedAt, updatedAt: now, lat, lng, accuracy };
  pushUpdate(r, toTripView(saved, hospital, donor, req.user));
  res.json({ success: true, trip: toTripOwn(saved, hospital) });
});

// GET /api/requests/:id/trips
export const getTrips = asyncHandler(async (req, res) => {
  const r = await BloodRequest.findById(req.params.id);
  if (!r) throw new ApiError(404, "Request not found");

  const owner = String(r.requester) === String(req.user._id);
  const admin = req.user.role === "admin";
  let entries;
  if (owner || admin) {
    entries = r.matchedDonors.filter((m) => m.response === "accepted" && m.trip?.status);
  } else {
    const donor = await DonorProfile.findOne({ user: req.user._id }).select("_id");
    const mine = donor && r.matchedDonors.find((m) => String(m.donor) === String(donor._id));
    if (!mine || mine.response !== "accepted") throw new ApiError(403, "You cannot see trips for this request");
    entries = mine.trip?.status ? [mine] : [];
  }

  const hospital = hospitalOf(r);
  const expired = await expireStaleTrips(r);

  const profiles = await DonorProfile.find({ _id: { $in: entries.map((m) => m.donor) } })
    .select("bloodGroup user")
    .populate("user", "name avatar phone")
    .lean();
  const byId = new Map(profiles.map((p) => [String(p._id), p]));

  const trips = [];
  for (const m of entries) {
    const p = byId.get(String(m.donor));
    if (!p) continue;
    const view = toTripView(m.trip, hospital, p, p.user);
    if (expired.includes(m)) pushUpdate(r, view);
    trips.push(view);
  }
  // Running trips first, then the most recently updated
  trips.sort(
    (a, b) =>
      Number(b.status === "on_the_way") - Number(a.status === "on_the_way") ||
      new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
  );

  res.json({ success: true, hospital, trips });
});
