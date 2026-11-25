// server/src/scripts/tripTests.js
//
// Live checks for live trip tracking (docs/maps-and-live-tracking.md §2).
// Needs the API running (npm run dev in another terminal).
// Creates its own "ZZ Trip" users, donor profiles and requests directly in MongoDB,
// logs the users in through the API, and deletes everything it created at the end.
//
// Run:  npm run test:trip
// Optional env: BASE_URL

import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import DonorProfile from "../models/DonorProfile.js";
import BloodRequest from "../models/BloodRequest.js";
import Notification from "../models/Notification.js";

const BASE = process.env.BASE_URL || "http://localhost:5000";
const PASSWORD = "password123";
const RUN = Date.now().toString(36).toUpperCase();
const SPEED = Number(process.env.TRIP_AVG_KMH) || 18; // same rule as the server
const KM_PER_DEG_LAT = 111.195; // 6371 km * pi / 180

// Dhaka Medical College Hospital [lng, lat]
const HOSPITAL = [90.3976, 23.7258];
const north = (km) => ({ latitude: HOSPITAL[1] + km / KM_PER_DEG_LAT, longitude: HOSPITAL[0] });
const eta = (km) => Math.round(((km * 1.35) / SPEED) * 60);

let passed = 0;
let failed = 0;

const check = (name, ok, detail = "") => {
  ok ? passed++ : failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? `\n     → ${detail}` : ""}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const api = async (method, path, token, body) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429) {
    throw new Error(`Rate limited (429) on ${method} ${path}. Restart the server to reset the in-memory limiter.`);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  return { status: res.status, data };
};

const created = { userIds: [], requestIds: [] };

const freePhone = async () => {
  for (let i = 0; i < 50; i++) {
    const phone = "0199998" + String(Math.floor(Math.random() * 1e4)).padStart(4, "0");
    if (!(await User.exists({ phone }))) return phone;
  }
  throw new Error("Could not find a free test phone number");
};

const makeUser = async (label, role = "user") => {
  const phone = await freePhone();
  const user = await User.create({
    name: `ZZ Trip ${label} ${RUN}`,
    phone,
    passwordHash: await bcrypt.hash(PASSWORD, 10),
    role,
  });
  created.userIds.push(user._id);
  const r = await api("POST", "/api/auth/login", null, { phone, password: PASSWORD });
  if (r.status !== 200) throw new Error(`Could not log in ${label}: ${r.status} ${JSON.stringify(r.data)}`);
  return { id: String(user._id), phone, name: user.name, token: r.data.token };
};

const makeDonor = async (user, bloodGroup = "O+") => {
  const p = await DonorProfile.create({ user: user.id, bloodGroup, dateOfBirth: new Date("1998-05-10"), district: "Dhaka" });
  return String(p._id);
};

const makeRequest = async (requester, matched, { status = "open", location = true } = {}) => {
  const r = await BloodRequest.create({
    requester: requester.id,
    patientName: `ZZ Trip Patient ${RUN}`,
    bloodGroup: "O+",
    unitsNeeded: 1,
    hospital: "Dhaka Medical College Hospital",
    district: "Dhaka",
    contactPhone: requester.phone,
    neededBy: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    status,
    ...(location ? { location: { type: "Point", coordinates: HOSPITAL } } : {}),
    matchedDonors: matched.map(([donor, response]) => ({ donor, matchScore: 50, response, notifiedAt: new Date() })),
  });
  created.requestIds.push(r._id);
  return String(r._id);
};

const dbTrip = async (requestId, donorId) => {
  const r = await BloodRequest.findById(requestId).lean();
  return r?.matchedDonors.find((m) => String(m.donor) === donorId)?.trip;
};

const near = (a, b, tol) => typeof a === "number" && Math.abs(a - b) <= tol;
const noCoords = (t) => !!t && !("lat" in t) && !("lng" in t) && !("accuracy" in t);
const leaksTrip = (obj) => /"trip"|"trips"|"lat"|"lng"|"accuracy"/.test(JSON.stringify(obj));

const run = async () => {
  const health = await api("GET", "/api/health").catch(() => null);
  if (!health || health.status !== 200) {
    throw new Error(`API is not reachable at ${BASE}. Start it with "npm run dev" first.`);
  }
  await connectDB();

  const requester = await makeUser("Requester");
  const donorA = await makeUser("Donor A");
  const donorB = await makeUser("Donor B");
  const pending = await makeUser("Pending");
  const outsider = await makeUser("Outsider");
  const admin = await makeUser("Admin", "admin");
  const dA = await makeDonor(donorA);
  const dB = await makeDonor(donorB);
  const dP = await makeDonor(pending);

  const rid = await makeRequest(requester, [[dA, "accepted"], [dB, "accepted"], [dP, "pending"]]);
  const closedId = await makeRequest(requester, [[dA, "accepted"]], { status: "fulfilled" });
  const noPinId = await makeRequest(requester, [[dA, "accepted"]], { location: false });
  const T = `/api/requests/${rid}`;
  console.log(`\nSetup done (run ${RUN}, TRIP_AVG_KMH ${SPEED})\n`);

  // ---------- Access and validation ----------
  console.log("— Access and validation —");
  const anon = await api("POST", `${T}/trip`, null, { action: "start" });
  check("1    start without login → 401", anon.status === 401, `status ${anon.status}`);

  const badId = await api("POST", "/api/requests/not-an-id/trip", donorA.token, { action: "start" });
  check("2    invalid request id → 400", badId.status === 400, `status ${badId.status}`);
  const missing = await api("POST", `/api/requests/${new mongoose.Types.ObjectId()}/trip`, donorA.token, { action: "start" });
  check("2    unknown request → 404", missing.status === 404, `status ${missing.status}`);
  const missingTrips = await api("GET", `/api/requests/${new mongoose.Types.ObjectId()}/trips`, requester.token);
  check("2    GET trips on unknown request → 404", missingTrips.status === 404, `status ${missingTrips.status}`);

  const badAction = await api("POST", `${T}/trip`, donorA.token, { action: "fly" });
  check("3    unknown action → 400", badAction.status === 400, `status ${badAction.status}`);
  const noAction = await api("POST", `${T}/trip`, donorA.token, {});
  check("3    missing action → 400", noAction.status === 400, `status ${noAction.status}`);

  const badLoc = [
    [{ latitude: 91, longitude: 90 }, "latitude 91"],
    [{ latitude: 23.7, longitude: 181 }, "longitude 181"],
    [{ latitude: 23.7 }, "missing longitude"],
    [{ longitude: 90.4 }, "missing latitude"],
    [{ latitude: "abc", longitude: 90.4 }, "latitude not a number"],
    [{ latitude: [23.7], longitude: 90.4 }, "latitude array"],
    [{ ...north(2), accuracy: 6000 }, "accuracy 6000"],
    [{ ...north(2), accuracy: -1 }, "accuracy -1"],
  ];
  for (const [body, label] of badLoc) {
    const r = await api("PUT", `${T}/trip/location`, donorA.token, body);
    check(`4    location with ${label} → 400`, r.status === 400, `status ${r.status} ${JSON.stringify(r.data)}`);
  }

  const outStart = await api("POST", `${T}/trip`, outsider.token, { action: "start" });
  check("5    outsider (no donor profile) start → 403", outStart.status === 403, `status ${outStart.status}`);
  const outTrips = await api("GET", `${T}/trips`, outsider.token);
  check("5    outsider GET trips → 403", outTrips.status === 403, `status ${outTrips.status}`);
  const pendStart = await api("POST", `${T}/trip`, pending.token, { action: "start" });
  check("6    non-accepted (pending) donor start → 403", pendStart.status === 403, `status ${pendStart.status}`);
  const pendLoc = await api("PUT", `${T}/trip/location`, pending.token, north(2));
  check("6    non-accepted donor location → 403", pendLoc.status === 403, `status ${pendLoc.status}`);
  const pendTrips = await api("GET", `${T}/trips`, pending.token);
  check("6    non-accepted donor GET trips → 403", pendTrips.status === 403, `status ${pendTrips.status}`);
  const reqStart = await api("POST", `${T}/trip`, requester.token, { action: "start" });
  check("6    requester can't start a trip → 403", reqStart.status === 403, `status ${reqStart.status}`);

  const locFirst = await api("PUT", `${T}/trip/location`, donorA.token, north(2));
  check("7    location before start → 409", locFirst.status === 409, `status ${locFirst.status}`);
  const arrFirst = await api("POST", `${T}/trip`, donorA.token, { action: "arrived" });
  check("7    arrived before start → 409", arrFirst.status === 409, `status ${arrFirst.status}`);

  const empty = await api("GET", `${T}/trips`, requester.token);
  check("8    requester sees hospital pin and no trips yet",
    empty.status === 200 && near(empty.data?.hospital?.lat, HOSPITAL[1], 1e-9) && near(empty.data?.hospital?.lng, HOSPITAL[0], 1e-9) &&
      Array.isArray(empty.data?.trips) && empty.data.trips.length === 0,
    JSON.stringify(empty.data));
  const emptyDonor = await api("GET", `${T}/trips`, donorA.token);
  check("8    accepted donor without a trip gets an empty list", emptyDonor.status === 200 && emptyDonor.data?.trips?.length === 0,
    `status ${emptyDonor.status}`);

  // ---------- Start, location, throttle ----------
  console.log("\n— Start, location, throttle —");
  const notesBefore = await Notification.countDocuments({ user: requester.id, relatedRequest: rid });
  const start = await api("POST", `${T}/trip`, donorA.token, { action: "start" });
  const st = start.data?.trip;
  check("9    start → 200 on_the_way", start.status === 200 && st?.status === "on_the_way", `status ${start.status} ${JSON.stringify(start.data)}`);
  check("9    TripOwn: startedAt/updatedAt set, endedAt null, no coords, distance/eta null",
    !!st?.startedAt && !!st?.updatedAt && st?.endedAt === null && noCoords(st) && st?.distanceKm === null && st?.etaMinutes === null,
    JSON.stringify(st));
  const onWay = await Notification.findOne({ user: requester.id, relatedRequest: rid, type: "request_update", title: `${donorA.name} is on the way` }).lean();
  check('9    requester notified "<name> is on the way"', !!onWay, JSON.stringify(onWay));

  const loc1 = await api("PUT", `${T}/trip/location`, donorA.token, { ...north(2), accuracy: 15 });
  const l1 = loc1.data?.trip;
  check("10   location → 200 with lat/lng/accuracy", loc1.status === 200 && near(l1?.lat, north(2).latitude, 1e-9) &&
    near(l1?.lng, HOSPITAL[0], 1e-9) && l1?.accuracy === 15, `status ${loc1.status} ${JSON.stringify(loc1.data)}`);
  check("10   distanceKm ≈ 2.0 ± 0.1", near(l1?.distanceKm, 2, 0.1), `distanceKm ${l1?.distanceKm}`);
  check(`10   etaMinutes = round(2 × 1.35 / ${SPEED} × 60) = ${eta(2)}`, l1?.etaMinutes === eta(2), `etaMinutes ${l1?.etaMinutes}`);
  let db = await dbTrip(rid, dA);
  check("10   saved in the DB", near(db?.lat, north(2).latitude, 1e-9) && db?.accuracy === 15, JSON.stringify(db));

  const loc2 = await api("PUT", `${T}/trip/location`, donorA.token, { ...north(4), accuracy: 10 });
  check("11   update < 4 s later → 200 with the current (unchanged) trip",
    loc2.status === 200 && near(loc2.data?.trip?.lat, north(2).latitude, 1e-9) && loc2.data?.trip?.accuracy === 15,
    `status ${loc2.status} ${JSON.stringify(loc2.data)}`);
  db = await dbTrip(rid, dA);
  check("11   throttled update not saved", near(db?.lat, north(2).latitude, 1e-9), JSON.stringify(db));

  await sleep(4200);
  const loc3 = await api("PUT", `${T}/trip/location`, donorA.token, north(4));
  const l3 = loc3.data?.trip;
  check("12   update after 4 s → saved", loc3.status === 200 && near(l3?.lat, north(4).latitude, 1e-9), JSON.stringify(loc3.data));
  check("12   accuracy omitted → absent", l3 && !("accuracy" in l3), JSON.stringify(l3));
  check(`12   4 km → distance ≈ 4.0, eta ${eta(4)}`, near(l3?.distanceKm, 4, 0.1) && l3?.etaMinutes === eta(4), JSON.stringify(l3));
  db = await dbTrip(rid, dA);
  check("12   DB accuracy cleared", db && db.accuracy === undefined && near(db.lat, north(4).latitude, 1e-9), JSON.stringify(db));

  const startB = await api("POST", `${T}/trip`, donorB.token, { action: "start" });
  const locB = await api("PUT", `${T}/trip/location`, donorB.token, { ...north(1), accuracy: 30 });
  check("13   second accepted donor starts and shares", startB.status === 200 && locB.status === 200 && near(locB.data?.trip?.distanceKm, 1, 0.1),
    `${startB.status} ${locB.status} ${JSON.stringify(locB.data)}`);

  // ---------- Who sees what ----------
  console.log("\n— Who sees what —");
  const rq = await api("GET", `${T}/trips`, requester.token);
  const tA = rq.data?.trips?.find((t) => String(t.donorId) === dA);
  const tB = rq.data?.trips?.find((t) => String(t.donorId) === dB);
  check("14   requester sees both trips", rq.status === 200 && rq.data?.trips?.length === 2 && !!tA && !!tB, JSON.stringify(rq.data));
  check("14   TripView has name, bloodGroup, phone, coords, distance, eta",
    tA?.name === donorA.name && tA?.bloodGroup === "O+" && tA?.phone === donorA.phone && near(tA?.lat, north(4).latitude, 1e-9) &&
      near(tA?.distanceKm, 4, 0.1) && tA?.etaMinutes === eta(4),
    JSON.stringify(tA));
  check("14   pending donor not listed", !rq.data?.trips?.some((t) => String(t.donorId) === dP));

  const ad = await api("GET", `${T}/trips`, admin.token);
  check("15   admin sees trips", ad.status === 200 && ad.data?.trips?.length === 2, `status ${ad.status}`);

  const own = await api("GET", `${T}/trips`, donorA.token);
  check("16   donor sees only their own trip",
    own.status === 200 && own.data?.trips?.length === 1 && String(own.data.trips[0].donorId) === dA && near(own.data.trips[0].lat, north(4).latitude, 1e-9),
    JSON.stringify(own.data));
  check("16   donor sees the hospital pin", near(own.data?.hospital?.lat, HOSPITAL[1], 1e-9));

  // Coordinates never appear anywhere else
  for (const [who, u] of [["requester", requester], ["donor", donorA], ["outsider", outsider], ["admin", admin]]) {
    const g = await api("GET", T, u.token);
    check(`17   GET /api/requests/:id (${who}) has no trip data`, g.status === 200 && !leaksTrip(g.data), JSON.stringify(g.data).slice(0, 300));
  }
  const pub = await api("GET", T, null);
  check("17   GET /api/requests/:id (guest) has no trip data", pub.status === 200 && !leaksTrip(pub.data));
  const resp = await api("GET", `${T}/responses`, requester.token);
  check("17   GET /responses has no trip data", resp.status === 200 && resp.data?.accepted?.length === 2 && !leaksTrip(resp.data),
    JSON.stringify(resp.data).slice(0, 300));
  const mine = await api("GET", "/api/requests/mine", requester.token);
  check("17   GET /requests/mine has no trip data", mine.status === 200 && !leaksTrip(mine.data));
  const list = await api("GET", "/api/requests?district=Dhaka&limit=50", null);
  check("17   public list has no trip data", list.status === 200 && !leaksTrip(list.data));
  const matches = await api("GET", `${T}/matches`, requester.token);
  check("17   GET /matches has no trip data", matches.status === 200 && !leaksTrip(matches.data), `status ${matches.status}`);

  // ---------- Ending trips ----------
  console.log("\n— Arrived / stop —");
  const arr = await api("POST", `${T}/trip`, donorA.token, { action: "arrived" });
  const at = arr.data?.trip;
  check("18   arrived → 200, status arrived, endedAt set", arr.status === 200 && at?.status === "arrived" && !!at?.endedAt, JSON.stringify(arr.data));
  check("18   arrived: no coords, distance null, eta 0", noCoords(at) && at?.distanceKm === null && at?.etaMinutes === 0, JSON.stringify(at));
  db = await dbTrip(rid, dA);
  check("18   DB coords cleared after arrived", db?.status === "arrived" && db.lat === undefined && db.lng === undefined && db.accuracy === undefined && !!db.endedAt,
    JSON.stringify(db));
  const arrNote = await Notification.findOne({ user: requester.id, relatedRequest: rid, title: `${donorA.name} has arrived` }).lean();
  check('18   requester notified "<name> has arrived"', !!arrNote);

  const arrAgain = await api("POST", `${T}/trip`, donorA.token, { action: "arrived" });
  check("19   arrived again → 200, unchanged", arrAgain.status === 200 && arrAgain.data?.trip?.status === "arrived");
  const stopAfter = await api("POST", `${T}/trip`, donorA.token, { action: "stop" });
  check("19   stop after arrived keeps arrived", stopAfter.status === 200 && stopAfter.data?.trip?.status === "arrived");
  const locAfter = await api("PUT", `${T}/trip/location`, donorA.token, north(1));
  check("19   location after arrived → 409", locAfter.status === 409, `status ${locAfter.status}`);

  const stopB = await api("POST", `${T}/trip`, donorB.token, { action: "stop" });
  check("20   stop → 200 stopped, no coords, eta null", stopB.status === 200 && stopB.data?.trip?.status === "stopped" &&
    noCoords(stopB.data.trip) && stopB.data.trip.etaMinutes === null && !!stopB.data.trip.endedAt, JSON.stringify(stopB.data));
  db = await dbTrip(rid, dB);
  check("20   DB coords cleared after stop", db?.status === "stopped" && db.lat === undefined && db.accuracy === undefined, JSON.stringify(db));
  const notesAfter = await Notification.countDocuments({ user: requester.id, relatedRequest: rid });
  check("20   notifications: 2 on the way + 1 arrived, none for stop", notesAfter - notesBefore === 3, `new: ${notesAfter - notesBefore}`);

  const ended = await api("GET", `${T}/trips`, requester.token);
  check("21   requester still sees ended trips without coords",
    ended.data?.trips?.length === 2 && ended.data.trips.every(noCoords), JSON.stringify(ended.data));

  // ---------- 4-hour expiry ----------
  console.log("\n— 4-hour expiry —");
  const restart = await api("POST", `${T}/trip`, donorA.token, { action: "start" });
  check("22   restart → on_the_way with no old coords, endedAt null",
    restart.status === 200 && restart.data?.trip?.status === "on_the_way" && noCoords(restart.data.trip) && restart.data.trip.endedAt === null,
    JSON.stringify(restart.data));
  await api("PUT", `${T}/trip/location`, donorA.token, north(3));
  const old = new Date(Date.now() - 5 * 60 * 60 * 1000);
  await BloodRequest.updateOne({ _id: rid, "matchedDonors.donor": dA }, { $set: { "matchedDonors.$.trip.startedAt": old } });
  const exp = await api("GET", `${T}/trips`, requester.token);
  const expA = exp.data?.trips?.find((t) => String(t.donorId) === dA);
  check("23   trip older than 4 h read as stopped without coords", expA?.status === "stopped" && noCoords(expA) && !!expA.endedAt,
    JSON.stringify(expA));
  db = await dbTrip(rid, dA);
  check("23   expiry saved in DB (stopped, coords unset)", db?.status === "stopped" && db.lat === undefined && db.lng === undefined, JSON.stringify(db));

  await api("POST", `${T}/trip`, donorA.token, { action: "start" });
  await api("PUT", `${T}/trip/location`, donorA.token, north(3));
  await BloodRequest.updateOne({ _id: rid, "matchedDonors.donor": dA }, { $set: { "matchedDonors.$.trip.startedAt": old } });
  await sleep(4200);
  const expWrite = await api("PUT", `${T}/trip/location`, donorA.token, north(2));
  check("24   location on a stale trip → 409", expWrite.status === 409, `status ${expWrite.status} ${JSON.stringify(expWrite.data)}`);
  db = await dbTrip(rid, dA);
  check("24   stale trip stopped and cleared on write", db?.status === "stopped" && db.lat === undefined, JSON.stringify(db));

  // ---------- Closed requests ----------
  console.log("\n— Closed requests —");
  const cStart = await api("POST", `/api/requests/${closedId}/trip`, donorA.token, { action: "start" });
  check("25   start on a fulfilled request → 409", cStart.status === 409, `status ${cStart.status}`);
  const cLoc = await api("PUT", `/api/requests/${closedId}/trip/location`, donorA.token, north(2));
  check("25   location on a fulfilled request → 409", cLoc.status === 409, `status ${cLoc.status}`);

  await api("POST", `${T}/trip`, donorB.token, { action: "start" });
  await api("PUT", `${T}/trip/location`, donorB.token, north(2));
  const cancel = await api("PATCH", `${T}/status`, requester.token, { status: "cancelled" });
  db = await dbTrip(rid, dB);
  check("26   cancelling the request ends running trips and clears coords",
    cancel.status === 200 && db?.status === "stopped" && db.lat === undefined && !!db.endedAt, `${cancel.status} ${JSON.stringify(db)}`);
  const afterCancel = await api("POST", `${T}/trip`, donorB.token, { action: "start" });
  check("26   start after cancel → 409", afterCancel.status === 409, `status ${afterCancel.status}`);
  const histTrips = await api("GET", `${T}/trips`, requester.token);
  check("26   requester can still read trips of a closed request", histTrips.status === 200 && histTrips.data?.trips?.length === 2);

  // ---------- No hospital pin, then PATCH ----------
  console.log("\n— Hospital pin —");
  const N = `/api/requests/${noPinId}`;
  await api("POST", `${N}/trip`, donorA.token, { action: "start" });
  const np = await api("PUT", `${N}/trip/location`, donorA.token, north(2));
  check("27   no hospital pin → distance and eta null, coords kept",
    np.status === 200 && np.data?.trip?.distanceKm === null && np.data?.trip?.etaMinutes === null && near(np.data?.trip?.lat, north(2).latitude, 1e-9),
    JSON.stringify(np.data));
  const npTrips = await api("GET", `${N}/trips`, requester.token);
  check("27   GET trips → hospital null", npTrips.status === 200 && npTrips.data?.hospital === null);

  const halfPin = await api("PATCH", N, requester.token, { latitude: HOSPITAL[1] });
  check("28   PATCH with only latitude → 400", halfPin.status === 400, `status ${halfPin.status}`);
  const badPin = await api("PATCH", N, requester.token, { latitude: 100, longitude: 90 });
  check("28   PATCH with latitude 100 → 400", badPin.status === 400, `status ${badPin.status}`);
  const outPin = await api("PATCH", N, outsider.token, { latitude: HOSPITAL[1], longitude: HOSPITAL[0] });
  check("28   outsider PATCH pin → 403", outPin.status === 403, `status ${outPin.status}`);
  const pin = await api("PATCH", N, requester.token, { latitude: HOSPITAL[1], longitude: HOSPITAL[0] });
  check("28   requester sets hospital pin via PATCH",
    pin.status === 200 && near(pin.data?.request?.coordinates?.[0], HOSPITAL[0], 1e-9) && near(pin.data?.request?.coordinates?.[1], HOSPITAL[1], 1e-9),
    `status ${pin.status} ${JSON.stringify(pin.data)}`);
  const withPin = await api("GET", `${N}/trips`, requester.token);
  const wp = withPin.data?.trips?.[0];
  check("28   distance and eta now computed", near(wp?.distanceKm, 2, 0.1) && wp?.etaMinutes === eta(2), JSON.stringify(withPin.data));
  await api("POST", `${N}/trip`, donorA.token, { action: "stop" });
};

const cleanup = async () => {
  try {
    const ids = created.userIds;
    const [n, rq, d, u] = await Promise.all([
      Notification.deleteMany({ $or: [{ user: { $in: ids } }, { relatedRequest: { $in: created.requestIds } }] }),
      BloodRequest.deleteMany({ _id: { $in: created.requestIds } }),
      DonorProfile.deleteMany({ user: { $in: ids } }),
      User.deleteMany({ _id: { $in: ids }, name: /^ZZ Trip / }),
    ]);
    console.log(
      `\n🧹 Test data removed: ${u.deletedCount} users, ${d.deletedCount} donor profiles, ` +
        `${rq.deletedCount} requests, ${n.deletedCount} notifications`
    );
  } catch (err) {
    console.error(`Cleanup failed (delete users named "ZZ Trip ... ${RUN}" and their data manually):`, err.message);
  }
};

try {
  await run();
} catch (err) {
  failed++;
  console.error("\n💥 Test run aborted:", err.message);
} finally {
  if (mongoose.connection.readyState === 1) {
    await cleanup();
    await mongoose.disconnect();
  }
  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
}
