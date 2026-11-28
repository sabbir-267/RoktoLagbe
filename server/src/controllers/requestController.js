import { autoNotifyForRequest } from "../services/autoNotify.js";
import DonorProfile from "../models/DonorProfile.js";
import BloodRequest from "../models/BloodRequest.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { normalizePhone } from "../utils/phone.js";
import { normalizeBloodGroup } from "../utils/bloodGroup.js";
import { urgencyFromNeededBy } from "../utils/urgency.js";
import { REQUEST_GRACE_MS } from "../services/requestService.js";
import { endTripsForRequest } from "./tripController.js";
import { recordRequestDonation } from "./requestDonationController.js";

const MAX_ACTIVE_PER_USER = 3;
const ACTIVE = ["open", "in_progress"];

const TRANSITIONS = {
  open: ["in_progress", "fulfilled", "cancelled"],
  in_progress: ["open", "fulfilled", "cancelled"],
  fulfilled: [],
  cancelled: [],
  expired: [],
};
const OWNER_ALLOWED = ["fulfilled", "cancelled"];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exactCI = (s) => new RegExp(`^${escapeRegex(s.trim())}$`, "i");
const str = (v) => (typeof v === "string" && v.trim() ? v : undefined); // ignores arrays/objects

const isPrivileged = (u) => !!u && ["admin", "bank_staff"].includes(u.role);
const isOwnerOf = (r, u) => !!u && String(r.requester) === String(u._id);

// Single place that decides what each viewer may see.
// rawText and the ai block are deliberately never included.
const toRequestDto = (r, viewer) => {
  const owner = isOwnerOf(r, viewer);
  return {
    id: r._id,
    bloodGroup: r.bloodGroup,
    component: r.component,
    unitsNeeded: r.unitsNeeded,
    fulfilledUnits: r.fulfilledUnits,
    hospital: r.hospital,
    district: r.district,
    coordinates: r.location?.coordinates?.length === 2 ? r.location.coordinates : undefined,
    neededBy: r.neededBy,
    urgency: r.urgency,
    status: r.status,
    createdAt: r.createdAt,
    notes: viewer ? r.notes : undefined,
    contactPhone: viewer ? r.contactPhone : undefined,
    patientName: owner || isPrivileged(viewer) ? r.patientName : undefined,
    isMine: owner || undefined,
    // Only the requester sees how many donors were alerted automatically
    autoNotify:
      owner && r.autoNotify?.at
        ? { at: r.autoNotify.at, notified: r.autoNotify.notified || 0, widened: !!r.autoNotify.widened, emailed: r.autoNotify.emailed || 0 }
        : undefined,
  };
};

const pageParams = (req, defLimit = 12) => ({
  page: Math.max(parseInt(req.query.page, 10) || 1, 1),
  limit: Math.min(Math.max(parseInt(req.query.limit, 10) || defLimit, 1), 50),
});

const readCoords = (body) => {
  const { latitude, longitude } = body;
  if ((latitude === undefined) !== (longitude === undefined)) {
    throw new ApiError(400, "Provide both latitude and longitude, or neither");
  }
  return latitude === undefined
    ? null
    : { type: "Point", coordinates: [Number(longitude), Number(latitude)] };
};

export const createRequest = asyncHandler(async (req, res) => {
  const active = await BloodRequest.countDocuments({ requester: req.user._id, status: { $in: ACTIVE } });
  if (active >= MAX_ACTIVE_PER_USER) {
    throw new ApiError(409, `You already have ${MAX_ACTIVE_PER_USER} active requests. Close one before creating another.`);
  }

  const b = req.body;
  const coords = readCoords(b);
  const doc = new BloodRequest({
    requester: req.user._id,
    patientName: b.patientName,
    bloodGroup: normalizeBloodGroup(b.bloodGroup),
    component: b.component || "whole_blood",
    unitsNeeded: Number(b.unitsNeeded),
    hospital: b.hospital,
    district: b.district,
    contactPhone: b.contactPhone ? normalizePhone(b.contactPhone) : req.user.phone,
    neededBy: new Date(b.neededBy),
    notes: b.notes || undefined,
    urgency: urgencyFromNeededBy(b.neededBy),
    // 6B: the original free-text message (kept for auditing) and whether the form was AI-assisted
    rawText: typeof b.rawText === "string" ? b.rawText.slice(0, 1000) : undefined,
    ai: { parsedFromText: b.parsedFromText === true || b.parsedFromText === "true" },
  });
  if (coords) doc.location = coords;
  await doc.save();

  // Alert matching donors right away. A problem here must never undo the request itself.
  let autoNotify = null;
  try {
    autoNotify = await autoNotifyForRequest(doc);
  } catch (err) {
    console.error("Automatic donor alert failed:", err.message);
  }

  res.status(201).json({ success: true, request: toRequestDto(doc, req.user), autoNotify });
});

export const listRequests = asyncHandler(async (req, res) => {
  const { page, limit } = pageParams(req);
  const status = str(req.query.status) || "open";

  const filter = { status, neededBy: { $gt: new Date(Date.now() - REQUEST_GRACE_MS) } };
  if (str(req.query.bloodGroup)) filter.bloodGroup = normalizeBloodGroup(req.query.bloodGroup);
  if (str(req.query.district)) filter.district = exactCI(req.query.district);
  if (str(req.query.component)) filter.component = req.query.component;
  if (str(req.query.urgency)) filter.urgency = req.query.urgency;

  const [rows, total] = await Promise.all([
    BloodRequest.find(filter).sort({ neededBy: 1 }).skip((page - 1) * limit).limit(limit),
    BloodRequest.countDocuments(filter),
  ]);

  res.json({
    success: true, page, limit, total,
    pages: Math.ceil(total / limit),
    requests: rows.map((r) => toRequestDto(r, req.user)),
  });
});

export const listMine = asyncHandler(async (req, res) => {
  const { page, limit } = pageParams(req, 20);
  const filter = { requester: req.user._id };
  if (str(req.query.status)) filter.status = req.query.status;

  const [rows, total] = await Promise.all([
    BloodRequest.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    BloodRequest.countDocuments(filter),
  ]);

  res.json({
    success: true, page, limit, total,
    pages: Math.ceil(total / limit),
    requests: rows.map((r) => toRequestDto(r, req.user)),
  });
});

export const getRequest = asyncHandler(async (req, res) => {
  const r = await BloodRequest.findById(req.params.id);
  const visible = r && (ACTIVE.includes(r.status) || isOwnerOf(r, req.user) || isPrivileged(req.user));
  if (!visible) throw new ApiError(404, "Request not found");

  const dto = toRequestDto(r, req.user);

  // Tell a notified donor their own answer ("pending" | "accepted" | "declined").
  // It is absent for everyone else, so the page knows not to show the reply buttons.
  if (req.user && !isOwnerOf(r, req.user)) {
    const donor = await DonorProfile.findOne({ user: req.user._id }).select("_id");
    const entry = donor && r.matchedDonors.find((m) => String(m.donor) === String(donor._id));
    if (entry) dto.myResponse = entry.response;
  }

  res.json({ success: true, request: dto });
});

export const updateRequest = asyncHandler(async (req, res) => {
  const r = await BloodRequest.findById(req.params.id);
  if (!r) throw new ApiError(404, "Request not found");
  if (!isOwnerOf(r, req.user) && req.user.role !== "admin") {
    throw new ApiError(403, "You can only change your own requests");
  }
  const b = req.body; // bloodGroup is deliberately not editable
  // The hospital pin may still be set or fixed while donors are responding (in_progress),
  // because the live trip map needs it; every other field is editable only while open.
  const onlyLocation = Object.keys(b).every((k) => k === "latitude" || k === "longitude");
  const editable = r.status === "open" || (onlyLocation && r.status === "in_progress");
  if (!editable) {
    throw new ApiError(409, onlyLocation ? "This request is closed" : "Only open requests can be edited");
  }

  for (const k of ["patientName", "hospital", "district", "notes"]) {
    if (b[k] !== undefined) r[k] = b[k];
  }
  if (b.contactPhone) r.contactPhone = normalizePhone(b.contactPhone);
  if (b.unitsNeeded !== undefined) {
    const n = Number(b.unitsNeeded);
    if (n < r.fulfilledUnits) throw new ApiError(400, "Units needed cannot be below units already fulfilled");
    r.unitsNeeded = n;
  }
  if (b.neededBy) {
    r.neededBy = new Date(b.neededBy);
    r.urgency = urgencyFromNeededBy(r.neededBy);
  }
  // Hospital pin can be set or fixed later
  const coords = readCoords(b);
  if (coords) r.location = coords;

  await r.save();
  res.json({ success: true, request: toRequestDto(r, req.user) });
});

export const setStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const r = await BloodRequest.findById(req.params.id);
  if (!r) throw new ApiError(404, "Request not found");

  const owner = isOwnerOf(r, req.user);
  const privileged = isPrivileged(req.user);
  if (!owner && !privileged) throw new ApiError(403, "You can only change your own requests");
  if (!privileged && !OWNER_ALLOWED.includes(status)) {
    throw new ApiError(403, "You can only mark your own request as fulfilled or cancelled");
  }
  if (!TRANSITIONS[r.status].includes(status)) {
    throw new ApiError(409, `Cannot change a ${r.status} request to ${status}`);
  }

  const update = { status };
  if (status === "fulfilled") {
    const units = req.body.fulfilledUnits !== undefined ? Number(req.body.fulfilledUnits) : r.unitsNeeded;
    if (units < 1 || units > r.unitsNeeded) {
      throw new ApiError(400, `fulfilledUnits must be between 1 and ${r.unitsNeeded}`);
    }
    update.fulfilledUnits = units;
  }

  // The status filter makes this safe if two people change it at once
  const updated = await BloodRequest.findOneAndUpdate(
    { _id: r._id, status: r.status },
    { $set: update },
    { new: true }
  );
  if (!updated) throw new ApiError(409, "This request was just changed by someone else. Refresh and try again.");
  // A closed request ends any live trips and clears their coordinates
  if (!ACTIVE.includes(status)) await endTripsForRequest(updated._id);

  // Fulfilled = the donors who said yes gave blood: record it for each of them (resets their last
  // donation date, adds it to their history and the leaderboard). The requester can untick donors
  // who didn't donate (donorIds); without a list every accepted donor is recorded.
  const donations = { recorded: 0, failed: [] };
  if (status === "fulfilled" && (owner || req.user.role === "admin")) {
    const chosen = Array.isArray(req.body.donorIds) ? new Set(req.body.donorIds.map(String)) : null;
    const now = new Date();
    for (const m of updated.matchedDonors) {
      if (m.response !== "accepted" || m.donation) continue;
      if (chosen && !chosen.has(String(m.donor))) continue;
      try {
        await recordRequestDonation(updated, m.donor, now, req.user._id);
        donations.recorded += 1;
      } catch (err) {
        donations.failed.push({ donorId: m.donor, message: err.message });
      }
    }
  }

  res.json({ success: true, request: toRequestDto(updated, req.user), donations });
});