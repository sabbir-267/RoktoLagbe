// server/src/scripts/donationHistoryTests.js
//
// Donation history and automatic "last donation date" reset:
//   - the requester confirms an accepted donor gave blood → history entry, date reset, +1 total
//   - undo restores the previous date
//   - a date the donor types becomes a self-reported entry; a later confirmation/bank record of the
//     same donation replaces it instead of counting twice
//   - legacy profiles (date but no records) still show an entry
//
// Needs the API running (npm run dev). Creates "ZZ DonHist" users/banks/requests in MongoDB and
// removes them at the end. Run: npm run test:donations

import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import DonorProfile from "../models/DonorProfile.js";
import BloodRequest from "../models/BloodRequest.js";
import BloodBank from "../models/BloodBank.js";
import Donation from "../models/Donation.js";
import InventoryBatch from "../models/InventoryBatch.js";
import Notification from "../models/Notification.js";
import { loginThrough2fa } from "./helpers/twoFactorLogin.js";

const BASE = process.env.BASE_URL || "http://localhost:5000";
const PASSWORD = "password123";
const RUN = Date.now().toString(36).toUpperCase();
const DAY = 24 * 60 * 60 * 1000;

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
  const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (res.status === 429) throw new Error(`Rate limited (429) on ${method} ${path}. Restart the server.`);
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, data };
};

const created = { userIds: [], requestIds: [], bankIds: [], profileIds: [] };

const freePhone = async () => {
  for (let i = 0; i < 50; i++) {
    const phone = "0199996" + String(Math.floor(Math.random() * 1e4)).padStart(4, "0");
    if (!(await User.exists({ phone }))) return phone;
  }
  throw new Error("Could not find a free test phone number");
};

const makeUser = async (label, extra = {}) => {
  const phone = await freePhone();
  const user = await User.create({
    name: `ZZ DonHist ${label} ${RUN}`,
    phone,
    passwordHash: await bcrypt.hash(PASSWORD, 10),
    role: "user",
    ...extra,
  });
  created.userIds.push(user._id);
  const r = await loginThrough2fa(api, { phone, password: PASSWORD });
  if (r.status !== 200) throw new Error(`Could not log in ${label}: ${r.status} ${JSON.stringify(r.data)}`);
  return { id: String(user._id), phone, token: r.data.token };
};

const makeDonor = async (label, lastDonationDate) => {
  const u = await makeUser(label, { email: `zz-donhist-${label.toLowerCase()}-${RUN.toLowerCase()}@example.com`, isEmailVerified: true });
  const p = await DonorProfile.create({
    user: u.id,
    bloodGroup: "O+",
    dateOfBirth: new Date("1998-05-10"),
    district: "Dhaka",
    ...(lastDonationDate ? { lastDonationDate } : {}),
  });
  created.profileIds.push(p._id);
  return { ...u, profileId: String(p._id) };
};

const makeRequest = async (requester, donors) => {
  const r = await BloodRequest.create({
    requester: requester.id,
    patientName: `ZZ DonHist Patient ${RUN}`,
    bloodGroup: "O+",
    unitsNeeded: 2,
    hospital: "Dhaka Medical College Hospital",
    district: "Dhaka",
    contactPhone: requester.phone,
    neededBy: new Date(Date.now() + 2 * DAY),
    matchedDonors: donors.map(([d, response]) => ({ donor: d.profileId, matchScore: 50, response, notifiedAt: new Date() })),
  });
  created.requestIds.push(r._id);
  return String(r._id);
};

const profile = (d) => DonorProfile.findById(d.profileId).lean();
const sameDay = (a, b) => !!a && !!b && Math.abs(new Date(a) - new Date(b)) < DAY;

const run = async () => {
  const health = await api("GET", "/api/health").catch(() => null);
  if (!health || health.status !== 200) throw new Error(`API not reachable at ${BASE}. Start it with npm run dev.`);
  await connectDB();

  const oldDate = new Date(Date.now() - 200 * DAY);
  const requester = await makeUser("Requester");
  const stranger = await makeUser("Stranger");
  const admin = await makeUser("Admin", { role: "admin" });
  const donorA = await makeDonor("DonorA", oldDate); // eligible, donated 200 days ago
  const donorB = await makeDonor("DonorB"); // will self-report first
  const pendingDonor = await makeDonor("Pending");
  const reqId = await makeRequest(requester, [[donorA, "accepted"], [donorB, "accepted"], [pendingDonor, "pending"]]);

  console.log("— Requester confirms a donation —");
  const s1 = await api("POST", `/api/requests/${reqId}/donations/${donorA.profileId}`, stranger.token, {});
  check("someone else cannot confirm (403)", s1.status === 403, `status ${s1.status}`);
  const p1 = await api("POST", `/api/requests/${reqId}/donations/${pendingDonor.profileId}`, requester.token, {});
  check("a donor who didn't accept cannot be confirmed (404)", p1.status === 404, `status ${p1.status}`);
  const fut = await api("POST", `/api/requests/${reqId}/donations/${donorA.profileId}`, requester.token, {
    donatedAt: new Date(Date.now() + 3 * DAY).toISOString(),
  });
  check("a future date is rejected (400)", fut.status === 400, `status ${fut.status}`);

  const c1 = await api("POST", `/api/requests/${reqId}/donations/${donorA.profileId}`, requester.token, {});
  check("requester confirms the donation (201)", c1.status === 201, `status ${c1.status} ${JSON.stringify(c1.data)}`);
  let pa = await profile(donorA);
  check("last donation date reset to today", sameDay(pa.lastDonationDate, new Date()), `${pa.lastDonationDate}`);
  check("total donations went up by 1", pa.totalDonations === 1, `total ${pa.totalDonations}`);
  check("response shows the next eligible date (~120 days)", c1.data?.donor?.nextEligibleDate && new Date(c1.data.donor.nextEligibleDate) > new Date(Date.now() + 100 * DAY));
  const again = await api("POST", `/api/requests/${reqId}/donations/${donorA.profileId}`, requester.token, {});
  check("confirming twice is refused (409)", again.status === 409, `status ${again.status}`);

  const resp = await api("GET", `/api/requests/${reqId}/responses`, requester.token);
  const rowA = resp.data?.accepted?.find((d) => String(d.donorId) === donorA.profileId);
  check("responses mark the donor as confirmed", rowA?.donationConfirmed === true, JSON.stringify(rowA));

  const histA = await api("GET", "/api/donors/me/donations", donorA.token);
  const reqEntry = histA.data?.donations?.find((d) => d.source === "request");
  check("donor's history has the confirmed donation", !!reqEntry, JSON.stringify(histA.data));
  check("  with hospital and request link", reqEntry?.hospital === "Dhaka Medical College Hospital" && String(reqEntry?.requestId) === reqId);
  check("  and the older profile date as a self-reported entry", histA.data?.donations?.some((d) => d.source === "self" && sameDay(d.donatedAt, oldDate)));
  const note = await Notification.findOne({ user: donorA.id, relatedRequest: reqId, title: /Donation confirmed/ }).lean();
  check("donor was notified", !!note);

  const avail = await api("GET", `/api/donors/me`, donorA.token);
  check("donor now shows as not eligible", avail.data?.donor?.isEligible === false || avail.data?.donor?.eligibleNow === false || avail.data?.donor?.nextEligibleDate > new Date().toISOString(), JSON.stringify(avail.data?.donor && { e: avail.data.donor.isEligible, n: avail.data.donor.nextEligibleDate }));

  console.log("\n— Undo —");
  const u1 = await api("DELETE", `/api/requests/${reqId}/donations/${donorA.profileId}`, stranger.token);
  check("someone else cannot undo (403)", u1.status === 403, `status ${u1.status}`);
  const u2 = await api("DELETE", `/api/requests/${reqId}/donations/${donorA.profileId}`, requester.token);
  check("requester can undo (200)", u2.status === 200, `status ${u2.status} ${JSON.stringify(u2.data)}`);
  pa = await profile(donorA);
  check("previous last donation date restored", sameDay(pa.lastDonationDate, oldDate), `${pa.lastDonationDate}`);
  check("total back to 0", pa.totalDonations === 0, `total ${pa.totalDonations}`);
  const left = await Donation.countDocuments({ donor: donorA.profileId, source: "request" });
  check("the confirmed record was removed", left === 0, `${left} left`);

  console.log("\n— Self-reported, then confirmed (no double counting) —");
  const today = new Date().toISOString().slice(0, 10);
  const put = await api("PUT", "/api/donors/me", donorB.token, {
    bloodGroup: "O+",
    dateOfBirth: "1998-05-10",
    district: "Dhaka",
    lastDonationDate: today,
  });
  check("donor sets their own last donation date (200)", put.status === 200, `status ${put.status} ${JSON.stringify(put.data)}`);
  let selfRows = await Donation.find({ donor: donorB.profileId }).lean();
  check("a self-reported history entry was added", selfRows.length === 1 && selfRows[0].source === "self", JSON.stringify(selfRows));
  await api("PUT", "/api/donors/me", donorB.token, { bloodGroup: "O+", dateOfBirth: "1998-05-10", district: "Dhaka", lastDonationDate: today });
  selfRows = await Donation.find({ donor: donorB.profileId }).lean();
  check("saving the same date again adds nothing", selfRows.length === 1, `${selfRows.length} rows`);
  let pb = await profile(donorB);
  check("self-reported does not add to total donations", (pb.totalDonations || 0) === 0, `total ${pb.totalDonations}`);

  const c2 = await api("POST", `/api/requests/${reqId}/donations/${donorB.profileId}`, requester.token, {});
  check("requester confirms the same donation (201)", c2.status === 201, `status ${c2.status} ${JSON.stringify(c2.data)}`);
  const rowsB = await Donation.find({ donor: donorB.profileId }).lean();
  check("the self entry was upgraded, not duplicated", rowsB.length === 1 && rowsB[0].source === "request" && rowsB[0].status === "verified", JSON.stringify(rowsB.map((r) => r.source)));
  pb = await profile(donorB);
  check("total donations is now 1", pb.totalDonations === 1, `total ${pb.totalDonations}`);

  console.log("\n— Leaderboard —");
  const board = await api("GET", "/api/donors/leaderboard?period=month&limit=100", donorB.token);
  const onBoard = (d) => board.data?.leaders?.some((l) => String(l.donorId) === d.profileId);
  check("a donor confirmed through a request appears on the leaderboard", onBoard(donorB), JSON.stringify(board.data?.me));
  check("  and sees their own rank", board.data?.me?.onBoard === true && board.data.me.donations === 1, JSON.stringify(board.data?.me));
  check("an undone confirmation does not count", !onBoard(donorA));
  const boardLegacy = await api("GET", "/api/donors/leaderboard?period=all&limit=100");
  check("self-reported dates don't put anyone on the board", !boardLegacy.data?.leaders?.some((l) => String(l.donorId) === donorA.profileId));

  console.log("\n— Blood bank records —");
  const bank = await BloodBank.create({ name: `ZZ DonHist Bank ${RUN}`, phone: "01700000000", district: "Dhaka", isApproved: true });
  created.bankIds.push(bank._id);
  const staff = await makeUser("Staff", { role: "bank_staff", bloodBank: bank._id });
  const dup = await api("POST", `/api/banks/${bank._id}/donations`, staff.token, { phone: donorB.phone, addToStock: false });
  check("bank can't record a donation already confirmed by the requester (409)", dup.status === 409, `status ${dup.status}`);

  const donorC = await makeDonor("DonorC");
  await api("PUT", "/api/donors/me", donorC.token, { bloodGroup: "O+", dateOfBirth: "1998-05-10", district: "Dhaka", lastDonationDate: today });
  const bc = await api("POST", `/api/banks/${bank._id}/donations`, staff.token, { phone: donorC.phone, addToStock: false });
  check("bank records a donation the donor had self-reported (201)", bc.status === 201, `status ${bc.status} ${JSON.stringify(bc.data)}`);
  const rowsC = await Donation.find({ donor: donorC.profileId }).lean();
  check("the bank record replaced the self entry", rowsC.length === 1 && rowsC[0].source === "bank", JSON.stringify(rowsC.map((r) => r.source)));
  const pc = await profile(donorC);
  check("bank donation reset the date and counted once", sameDay(pc.lastDonationDate, new Date()) && pc.totalDonations === 1, `${pc.lastDonationDate} total ${pc.totalDonations}`);

  console.log("\n— Marking a request fulfilled records the donations —");
  const donorE = await makeDonor("DonorE", new Date(Date.now() - 300 * DAY));
  const donorF = await makeDonor("DonorF");
  const req2 = await makeRequest(requester, [[donorE, "accepted"], [donorF, "accepted"]]);
  const ful = await api("PATCH", `/api/requests/${req2}/status`, requester.token, {
    status: "fulfilled",
    fulfilledUnits: 1,
    donorIds: [donorE.profileId], // F said yes but didn't donate
  });
  check("requester marks the request fulfilled (200)", ful.status === 200, `status ${ful.status} ${JSON.stringify(ful.data)}`);
  check("  1 donation recorded", ful.data?.donations?.recorded === 1, JSON.stringify(ful.data?.donations));
  const pe = await profile(donorE);
  check("chosen donor's last donation date reset to today", sameDay(pe.lastDonationDate, new Date()) && pe.totalDonations === 1, `${pe.lastDonationDate} total ${pe.totalDonations}`);
  const pf = await profile(donorF);
  check("unticked donor is unchanged", !pf.lastDonationDate && (pf.totalDonations || 0) === 0, `${pf.lastDonationDate} total ${pf.totalDonations}`);
  const histE = await api("GET", "/api/donors/me/donations", donorE.token);
  check("chosen donor's history shows the donation", histE.data?.donations?.some((d) => d.source === "request" && String(d.requestId) === req2));
  const board2 = await api("GET", "/api/donors/leaderboard?period=month&limit=100");
  check("chosen donor is on the leaderboard", board2.data?.leaders?.some((l) => String(l.donorId) === donorE.profileId));

  const donorG = await makeDonor("DonorG");
  const req3 = await makeRequest(requester, [[donorG, "accepted"]]);
  const ful3 = await api("PATCH", `/api/requests/${req3}/status`, requester.token, { status: "fulfilled" });
  check("fulfilling without a list records every accepted donor", ful3.data?.donations?.recorded === 1, JSON.stringify(ful3.data?.donations));
  const pg = await profile(donorG);
  check("  and resets their date", sameDay(pg.lastDonationDate, new Date()) && pg.totalDonations === 1);

  console.log("\n— Legacy profiles and admin view —");
  const donorD = await makeDonor("Legacy", new Date(Date.now() - 50 * DAY));
  const histD = await api("GET", "/api/donors/me/donations", donorD.token);
  check("a profile date with no records still shows in history", histD.data?.donations?.length === 1 && histD.data.donations[0].source === "self", JSON.stringify(histD.data));
  const adm = await api("GET", `/api/admin/donors/${donorB.profileId}/donations`, admin.token);
  check("admin can view any donor's history (200)", adm.status === 200 && adm.data?.donations?.length === 1, `status ${adm.status} ${JSON.stringify(adm.data)}`);
  const notAdm = await api("GET", `/api/admin/donors/${donorB.profileId}/donations`, stranger.token);
  check("non-admins cannot (403)", notAdm.status === 403, `status ${notAdm.status}`);
};

const cleanup = async () => {
  try {
    const [d, n, r, b, k, p, u] = await Promise.all([
      Donation.deleteMany({ donor: { $in: created.profileIds } }),
      Notification.deleteMany({ $or: [{ user: { $in: created.userIds } }, { relatedRequest: { $in: created.requestIds } }] }),
      BloodRequest.deleteMany({ _id: { $in: created.requestIds } }),
      InventoryBatch.deleteMany({ bloodBank: { $in: created.bankIds } }),
      BloodBank.deleteMany({ _id: { $in: created.bankIds }, name: /^ZZ DonHist / }),
      DonorProfile.deleteMany({ _id: { $in: created.profileIds } }),
      User.deleteMany({ _id: { $in: created.userIds }, name: /^ZZ DonHist / }),
    ]);
    console.log(
      `\n🧹 Test data removed: ${u.deletedCount} users, ${p.deletedCount} donor profiles, ${r.deletedCount} requests, ` +
        `${d.deletedCount} donations, ${k.deletedCount} banks, ${b.deletedCount} batches, ${n.deletedCount} notifications`
    );
  } catch (err) {
    console.error(`Cleanup failed (delete "ZZ DonHist ... ${RUN}" data manually):`, err.message);
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
