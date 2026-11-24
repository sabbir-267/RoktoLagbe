// server/src/scripts/matchingTests.js
//
// Live tests of donor matching, notifications and donor responses (Step 6C).
// No AI key needed. Needs the API running (npm run dev in another terminal).
//
// It creates its own users directly in the database (so no signup rate limit),
// signs tokens with the server's JWT_SECRET, creates donor profiles and
// requests through the real API, then deletes everything at the end.
//
// Run:  npm run test:match:live
// Optional env: BASE_URL, ADMIN_PHONE

import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import DonorProfile from "../models/DonorProfile.js";
import BloodRequest from "../models/BloodRequest.js";
import Notification from "../models/Notification.js";
import { signToken } from "../utils/token.js";

const BASE = process.env.BASE_URL || "http://localhost:5000";
const ADMIN_PHONE = process.env.ADMIN_PHONE || "01911111110";
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let passed = 0;
let failed = 0;

const check = (name, ok, detail = "") => {
  ok ? passed++ : failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? `\n     → ${detail}` : ""}`);
};

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
    throw new Error(
      `Rate limited (429) on ${method} ${path}. Restart the server, or set REQUEST_CREATE_LIMIT=1000 and MATCH_NOTIFY_LIMIT=1000 in server/.env.`
    );
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  return { status: res.status, data };
};

const randomPhone = () => "019" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const inHours = (h) => new Date(Date.now() + h * HOUR).toISOString();
const created = { userIds: [] };

const makeUser = async (name) => {
  const phone = randomPhone();
  const user = await User.create({ name, phone, passwordHash: "not-a-real-hash" }); // cannot log in with a password
  created.userIds.push(user._id);
  return { id: String(user._id), name, phone, token: signToken(user) };
};

const run = async () => {
  const health = await api("GET", "/api/health").catch((e) => {
    if (e.message.startsWith("Rate limited")) throw e;
    return null;
  });
  if (!health || health.status !== 200) {
    throw new Error(`API is not reachable at ${BASE}. Start it with "npm run dev" first.`);
  }
  await connectDB();

  const adminUser = await User.findOne({ phone: ADMIN_PHONE, role: "admin" });
  if (!adminUser) throw new Error(`No admin user with phone ${ADMIN_PHONE}. Set role "admin" in Atlas or pass ADMIN_PHONE.`);
  const admin = signToken(adminUser);

  const district = `ZZMatch${Date.now()}`;
  const otherDistrict = `ZZOther${Date.now()}`;
  const DHAKA = { latitude: 23.8103, longitude: 90.4125 };
  const SAVAR = { latitude: 23.8583, longitude: 90.2667 }; // about 16 km from DHAKA

  const requester = await makeUser("Match Requester");
  const outsider = await makeUser("Match Outsider"); // no donor profile
  const d1 = await makeUser("Donor One"); // A+, verified, near, phone visible
  const d2 = await makeUser("Donor Two"); // O-, compatible
  const d3 = await makeUser("Donor Three"); // A+ but donated 30 days ago
  const d4 = await makeUser("Donor Four"); // A+ but unavailable
  const d5 = await makeUser("Donor Five"); // A+ in another district
  const d6 = await makeUser("Donor Six"); // B+, not compatible

  const profile = (extra = {}) => ({
    bloodGroup: "A+",
    dateOfBirth: "1998-05-10",
    gender: "male",
    weightKg: 65,
    district,
    ...extra,
  });
  const makeDonor = async (u, extra) => {
    const r = await api("PUT", "/api/donors/me", u.token, profile(extra));
    if (r.status !== 201) throw new Error(`Could not create donor profile for ${u.name}: ${JSON.stringify(r.data)}`);
    u.donorId = r.data.donor.id;
  };

  await makeDonor(requester); // the requester is also a donor: must never match their own request
  await makeDonor(d1, { allowPhoneVisible: true, ...SAVAR });
  await makeDonor(d2, { bloodGroup: "O-" });
  await makeDonor(d3, { lastDonationDate: new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10) });
  await makeDonor(d4);
  await makeDonor(d5, { district: otherDistrict, ...SAVAR });
  await makeDonor(d6, { bloodGroup: "B+" });

  const verify = await api("PATCH", `/api/donors/${d1.donorId}/verify`, admin, {});
  if (verify.status !== 200) throw new Error(`Could not verify Donor One: ${JSON.stringify(verify.data)}`);
  const unavailable = await api("PATCH", "/api/donors/me/availability", d4.token, { isAvailable: false });
  if (unavailable.status !== 200) throw new Error(`Could not set Donor Four unavailable: ${JSON.stringify(unavailable.data)}`);

  const reqBody = (extra = {}) => ({
    patientName: "Match Patient",
    bloodGroup: "A+",
    unitsNeeded: 2,
    hospital: "Enam Medical College",
    district,
    neededBy: inHours(5),
    notes: "Surgery tonight",
    ...DHAKA,
    ...extra,
  });
  const created1 = await api("POST", "/api/requests", requester.token, reqBody());
  if (created1.status !== 201) throw new Error(`Could not create the test request: ${JSON.stringify(created1.data)}`);
  const req1 = created1.data.request.id;

  console.log(`\nSetup done. District "${district}", request ${req1}\n`);

  const has = (res, u) => (res.data?.matches || []).some((m) => m.donorId === u.donorId);
  const find = (res, u) => (res.data?.matches || []).find((m) => m.donorId === u.donorId);
  const index = (res, u) => (res.data?.matches || []).findIndex((m) => m.donorId === u.donorId);

  // ---------- Access ----------
  console.log("— Who may see matches —");
  const noToken = await api("GET", `/api/requests/${req1}/matches`);
  check("no token → 401", noToken.status === 401, `status ${noToken.status}`);
  const stranger = await api("GET", `/api/requests/${req1}/matches`, outsider.token);
  check("a stranger → 403", stranger.status === 403, `status ${stranger.status}`);
  const badId = await api("GET", "/api/requests/abc/matches", requester.token);
  check("invalid request id → 400", badId.status === 400, `status ${badId.status}`);
  const limit0 = await api("GET", `/api/requests/${req1}/matches?limit=0`, requester.token);
  const limit21 = await api("GET", `/api/requests/${req1}/matches?limit=21`, requester.token);
  check("limit 0 and limit 21 → 400", limit0.status === 400 && limit21.status === 400, `${limit0.status}, ${limit21.status}`);

  // ---------- Matching ----------
  console.log("\n— Matching rules —");
  const m = await api("GET", `/api/requests/${req1}/matches`, requester.token);
  check("the requester sees matches (200)", m.status === 200, `status ${m.status} ${JSON.stringify(m.data)}`);
  check("compatible groups for A+ are A+, A-, O+, O-", JSON.stringify([...(m.data?.compatibleGroups || [])].sort()) === JSON.stringify(["A+", "A-", "O+", "O-"]), JSON.stringify(m.data?.compatibleGroups));
  check("exact-group donor (Donor One) is included", has(m, d1));
  check("compatible O- donor (Donor Two) is included", has(m, d2));
  check("donor who donated 30 days ago is excluded", !has(m, d3));
  check("unavailable donor is excluded", !has(m, d4));
  check("donor in another district is excluded by default", !has(m, d5));
  check("incompatible B+ donor is excluded", !has(m, d6));
  check("the requester's own donor profile is excluded", !has(m, requester));
  check("the response carries the safety note", /cross-matching/i.test(m.data?.note || ""));

  console.log("\n— Ranking and reasons —");
  check("verified, nearby, exact-group donor ranks above the O- donor", index(m, d1) !== -1 && index(m, d1) < index(m, d2), `indexes ${index(m, d1)}, ${index(m, d2)}`);
  const r1 = find(m, d1);
  const r2 = find(m, d2);
  check('Donor One reasons include "Exact blood group match" and "Verified donor"', r1?.reasons?.includes("Exact blood group match") && r1?.reasons?.includes("Verified donor"), JSON.stringify(r1?.reasons));
  check('Donor Two reasons include "Compatible blood group"', r2?.reasons?.includes("Compatible blood group"), JSON.stringify(r2?.reasons));
  check("Donor One is about 16 km away", r1?.distanceKm > 15 && r1?.distanceKm < 17, `distanceKm ${r1?.distanceKm}`);
  check("Donor One scores higher than Donor Two", r1?.score > r2?.score, `${r1?.score} vs ${r2?.score}`);

  console.log("\n— Donor privacy —");
  check("a donor who opted in has their phone shown", r1?.phone === d1.phone, `phone ${r1?.phone}`);
  check("a donor who did not opt in has no phone", r2?.phone === undefined, `phone ${r2?.phone}`);

  console.log("\n— Other districts —");
  const wide = await api("GET", `/api/requests/${req1}/matches?includeOtherDistricts=true`, requester.token);
  check("includeOtherDistricts=true adds the other-district donor", has(wide, d5));
  check("same-district Donor One still ranks above them", index(wide, d1) < index(wide, d5), `indexes ${index(wide, d1)}, ${index(wide, d5)}`);

  // ---------- Notifying ----------
  console.log("\n— Notifying donors —");
  const strangerNotify = await api("POST", `/api/requests/${req1}/notify`, outsider.token, {});
  check("a stranger cannot notify (403)", strangerNotify.status === 403, `status ${strangerNotify.status}`);
  const badLimit = await api("POST", `/api/requests/${req1}/notify`, requester.token, { limit: 11 });
  check("limit 11 → 400", badLimit.status === 400, `status ${badLimit.status}`);

  const n1 = await api("POST", `/api/requests/${req1}/notify`, requester.token, {});
  const notifiedIds = (n1.data?.notified || []).map((x) => x.donorId).sort();
  check("the requester notifies matched donors (200)", n1.status === 200, `status ${n1.status} ${JSON.stringify(n1.data)}`);
  check("exactly Donor One and Donor Two were notified", JSON.stringify(notifiedIds) === JSON.stringify([d1.donorId, d2.donorId].sort()), JSON.stringify(notifiedIds));

  const inbox1 = await api("GET", "/api/notifications", d1.token);
  const note1 = inbox1.data?.notifications?.[0];
  check("Donor One has one unread donor_match notification", inbox1.data?.total === 1 && inbox1.data?.unreadCount === 1 && note1?.type === "donor_match", JSON.stringify(inbox1.data));
  check("the notification points to the request", note1?.requestId === req1, `requestId ${note1?.requestId}`);
  const text = `${note1?.title} ${note1?.message}`;
  check("the notification does NOT reveal the patient name or requester phone", !text.includes("Match Patient") && !text.includes(requester.phone), text);

  for (const [label, u] of [["Donor Three (recent donation)", d3], ["Donor Four (unavailable)", d4], ["Donor Six (B+)", d6]]) {
    const inbox = await api("GET", "/api/notifications", u.token);
    check(`${label} got no notification`, inbox.data?.total === 0, `total ${inbox.data?.total}`);
  }

  const n2 = await api("POST", `/api/requests/${req1}/notify`, requester.token, {});
  check("notifying again adds nobody", n2.status === 200 && n2.data?.notified?.length === 0, JSON.stringify(n2.data));
  check("…and reports 2 already notified", n2.data?.skipped?.alreadyNotified === 2, JSON.stringify(n2.data?.skipped));

  // ---------- Responding ----------
  console.log("\n— Donor responses —");
  const noProfile = await api("POST", `/api/requests/${req1}/respond`, outsider.token, { response: "accepted" });
  check("a user without a donor profile → 403", noProfile.status === 403, `status ${noProfile.status}`);
  const notMatched = await api("POST", `/api/requests/${req1}/respond`, d6.token, { response: "accepted" });
  check("a donor who was not matched → 403", notMatched.status === 403, `status ${notMatched.status}`);
  const badResp = await api("POST", `/api/requests/${req1}/respond`, d1.token, { response: "maybe" });
  check('response "maybe" → 400', badResp.status === 400, `status ${badResp.status}`);

  const acc = await api("POST", `/api/requests/${req1}/respond`, d1.token, { response: "accepted" });
  check("Donor One accepts (200)", acc.status === 200, `status ${acc.status} ${JSON.stringify(acc.data)}`);
  const again = await api("POST", `/api/requests/${req1}/respond`, d1.token, { response: "declined" });
  check("responding twice → 409", again.status === 409, `status ${again.status}`);
  const dec = await api("POST", `/api/requests/${req1}/respond`, d2.token, { response: "declined" });
  check("Donor Two declines (200)", dec.status === 200, `status ${dec.status}`);

  const afterRespond = await api("GET", "/api/notifications/unread-count", d1.token);
  check("responding marks the donor's notification as read", afterRespond.data?.unreadCount === 0, JSON.stringify(afterRespond.data));

  const reqInbox = await api("GET", "/api/notifications", requester.token);
  const accepted = (reqInbox.data?.notifications || []).find((n) => n.type === "request_update");
  check("the requester is told a donor accepted", !!accepted && /accepted/i.test(accepted.title), JSON.stringify(reqInbox.data));
  check("that notification does NOT contain the donor's phone", !JSON.stringify(accepted).includes(d1.phone));

  console.log("\n— Responses for the requester —");
  const strangerResp = await api("GET", `/api/requests/${req1}/responses`, outsider.token);
  check("a stranger cannot read responses (403)", strangerResp.status === 403, `status ${strangerResp.status}`);
  const resp = await api("GET", `/api/requests/${req1}/responses`, requester.token);
  const c = resp.data?.counts || {};
  check("counts: 2 notified, 0 pending, 1 accepted, 1 declined", c.notified === 2 && c.pending === 0 && c.accepted === 1 && c.declined === 1, JSON.stringify(c));
  check("the accepted donor's phone is shared with the requester", resp.data?.accepted?.[0]?.phone === d1.phone, JSON.stringify(resp.data?.accepted));
  check("a donor who declined is not exposed", !JSON.stringify(resp.data).includes(d2.phone) && !JSON.stringify(resp.data).includes("Donor Two"));

  // ---------- Cooldown ----------
  console.log("\n— Cooldown —");
  const created2 = await api("POST", "/api/requests", requester.token, reqBody({ patientName: "Second Patient" }));
  const req2 = created2.data?.request?.id;
  check("a second request is created (201)", created2.status === 201, `status ${created2.status}`);
  const n3 = await api("POST", `/api/requests/${req2}/notify`, requester.token, {});
  check("donors notified in the last 24h are skipped (cooldown)", n3.status === 200 && n3.data?.notified?.length === 0 && n3.data?.skipped?.cooldown === 2, JSON.stringify(n3.data));

  // ---------- Notification endpoints ----------
  console.log("\n— Notification endpoints —");
  const first = reqInbox.data?.notifications?.[0];
  const otherPatch = await api("PATCH", `/api/notifications/${first?.id}/read`, outsider.token);
  check("another user cannot mark my notification read (404)", otherPatch.status === 404, `status ${otherPatch.status}`);
  const badNote = await api("PATCH", "/api/notifications/abc/read", requester.token);
  check("invalid notification id → 400", badNote.status === 400, `status ${badNote.status}`);
  const noAuthNote = await api("GET", "/api/notifications");
  check("notifications without a token → 401", noAuthNote.status === 401, `status ${noAuthNote.status}`);
  const mine = await api("PATCH", `/api/notifications/${first?.id}/read`, requester.token);
  check("the owner marks it read (200)", mine.status === 200 && mine.data?.notification?.isRead === true, `status ${mine.status}`);
  const all = await api("PATCH", "/api/notifications/read-all", requester.token);
  const unread = await api("GET", "/api/notifications?unread=true", requester.token);
  check("read-all leaves nothing unread", all.status === 200 && unread.data?.total === 0, JSON.stringify(unread.data));

  // ---------- Closed requests ----------
  console.log("\n— Closed requests —");
  const close = await api("PATCH", `/api/requests/${req1}/status`, requester.token, { status: "fulfilled" });
  check("the requester marks the request fulfilled", close.status === 200, `status ${close.status}`);
  const closedMatches = await api("GET", `/api/requests/${req1}/matches`, requester.token);
  const closedNotify = await api("POST", `/api/requests/${req1}/notify`, requester.token, {});
  check("matches on a closed request → 409", closedMatches.status === 409, `status ${closedMatches.status}`);
  check("notify on a closed request → 409", closedNotify.status === 409, `status ${closedNotify.status}`);
  const closedResponses = await api("GET", `/api/requests/${req1}/responses`, requester.token);
  check("the requester can still read responses on a closed request", closedResponses.status === 200, `status ${closedResponses.status}`);
};

const cleanup = async () => {
  try {
    const ids = created.userIds;
    if (ids.length) {
      await Notification.deleteMany({ user: { $in: ids } });
      await BloodRequest.deleteMany({ requester: { $in: ids } });
      await DonorProfile.deleteMany({ user: { $in: ids } });
      await User.deleteMany({ _id: { $in: ids } });
    }
    console.log("\n🧹 Test data removed");
  } catch (err) {
    console.error("Cleanup failed (delete the 'Match Requester', 'Match Outsider' and 'Donor One…Six' users manually):", err.message);
  }
};

try {
  await run();
} catch (err) {
  failed++;
  console.error(`\n❌ ${err.message}`);
} finally {
  await cleanup();
  await mongoose.disconnect();
  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
}