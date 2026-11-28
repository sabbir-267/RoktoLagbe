// server/src/scripts/bankAccessTests.js
//
// Who may change blood stock: only verified staff (staff of an APPROVED bank, at
// that bank). Admins can read but not change stock; staff of a bank still waiting
// for approval cannot change it either.
//
// Needs the API running (npm run dev). Creates its own "ZZ BankAccess" users and
// banks directly in MongoDB and removes them at the end.
// Run: npm run test:bankaccess

import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import BloodBank from "../models/BloodBank.js";
import InventoryBatch from "../models/InventoryBatch.js";
import Donation from "../models/Donation.js";
import { loginThrough2fa } from "./helpers/twoFactorLogin.js";

const BASE = process.env.BASE_URL || "http://localhost:5000";
const PASSWORD = "password123";
const RUN = Date.now().toString(36).toUpperCase();

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

const created = { userIds: [], bankIds: [] };

const freePhone = async () => {
  for (let i = 0; i < 50; i++) {
    const phone = "0199997" + String(Math.floor(Math.random() * 1e4)).padStart(4, "0");
    if (!(await User.exists({ phone }))) return phone;
  }
  throw new Error("Could not find a free test phone number");
};

const makeBank = async (label, isApproved) => {
  const b = await BloodBank.create({ name: `ZZ BankAccess ${label} ${RUN}`, phone: "01700000000", district: "Dhaka", isApproved });
  created.bankIds.push(b._id);
  return String(b._id);
};

const makeUser = async (label, role = "user", bloodBank) => {
  const phone = await freePhone();
  const user = await User.create({
    name: `ZZ BankAccess ${label} ${RUN}`,
    phone,
    passwordHash: await bcrypt.hash(PASSWORD, 10),
    role,
    ...(bloodBank ? { bloodBank } : {}),
  });
  created.userIds.push(user._id);
  const r = await loginThrough2fa(api, { phone, password: PASSWORD });
  if (r.status !== 200) throw new Error(`Could not log in ${label}: ${r.status} ${JSON.stringify(r.data)}`);
  return { id: String(user._id), phone, token: r.data.token };
};

const batch = { bloodGroup: "O+", units: 3 };

const run = async () => {
  const health = await api("GET", "/api/health").catch(() => null);
  if (!health || health.status !== 200) throw new Error(`API not reachable at ${BASE}. Start it with npm run dev.`);
  await connectDB();

  const approved = await makeBank("Approved", true);
  const pending = await makeBank("Pending", false);
  const admin = await makeUser("Admin", "admin");
  const staff = await makeUser("Staff", "bank_staff", approved);
  const pendingStaff = await makeUser("PendingStaff", "bank_staff", pending);
  const other = await makeUser("User");
  const donor = await makeUser("Donor");

  console.log("— Verified staff can manage stock —");
  const add = await api("POST", `/api/banks/${approved}/inventory`, staff.token, batch);
  check("staff of approved bank can add a batch (201)", add.status === 201, `status ${add.status} ${JSON.stringify(add.data)}`);
  const batchId = add.data?.batch?.id || add.data?.batch?._id;
  const issue = await api("POST", `/api/banks/${approved}/inventory/${batchId}/issue`, staff.token, { units: 1 });
  check("staff can issue units (200)", issue.status === 200, `status ${issue.status}`);
  const reserve = await api("PATCH", `/api/banks/${approved}/inventory/${batchId}`, staff.token, { status: "reserved" });
  check("staff can change batch status (200)", reserve.status === 200, `status ${reserve.status}`);
  const lookup = await api("GET", `/api/banks/${approved}/donors/lookup?phone=${donor.phone}`, staff.token);
  check("staff can look up a donor (not 403)", lookup.status !== 403, `status ${lookup.status}`);

  console.log("\n— Admins cannot change stock —");
  const aAdd = await api("POST", `/api/banks/${approved}/inventory`, admin.token, batch);
  check("admin cannot add a batch (403)", aAdd.status === 403, `status ${aAdd.status}`);
  check("  with a clear message", /Admins cannot change blood stock/.test(aAdd.data?.message || ""), aAdd.data?.message);
  const aIssue = await api("POST", `/api/banks/${approved}/inventory/${batchId}/issue`, admin.token, { units: 1 });
  check("admin cannot issue units (403)", aIssue.status === 403, `status ${aIssue.status}`);
  const aStatus = await api("PATCH", `/api/banks/${approved}/inventory/${batchId}`, admin.token, { status: "expired" });
  check("admin cannot change batch status (403)", aStatus.status === 403, `status ${aStatus.status}`);
  const aDon = await api("POST", `/api/banks/${approved}/donations`, admin.token, { phone: donor.phone });
  check("admin cannot record a donation (403)", aDon.status === 403, `status ${aDon.status}`);
  const aLookup = await api("GET", `/api/banks/${approved}/donors/lookup?phone=${donor.phone}`, admin.token);
  check("admin cannot use donor lookup (403)", aLookup.status === 403, `status ${aLookup.status}`);
  const aList = await api("GET", `/api/banks/${approved}/inventory`, admin.token);
  check("admin can still view the inventory (200)", aList.status === 200, `status ${aList.status}`);
  const aEdit = await api("PATCH", `/api/banks/${approved}`, admin.token, { openingHours: "9am-5pm" });
  check("admin can still edit bank details (200)", aEdit.status === 200, `status ${aEdit.status}`);
  const units = (await InventoryBatch.findById(batchId).lean())?.units;
  check("stock was not changed by the admin", units === 2, `units ${units}`);

  console.log("\n— Unverified or other users cannot change stock —");
  const pAdd = await api("POST", `/api/banks/${pending}/inventory`, pendingStaff.token, batch);
  check("staff of an unapproved bank cannot add a batch (403)", pAdd.status === 403, `status ${pAdd.status}`);
  check("  told to wait for approval", /waiting for admin approval/.test(pAdd.data?.message || ""), pAdd.data?.message);
  const pDon = await api("POST", `/api/banks/${pending}/donations`, pendingStaff.token, { phone: donor.phone });
  check("staff of an unapproved bank cannot record a donation (403)", pDon.status === 403, `status ${pDon.status}`);
  const pEdit = await api("PATCH", `/api/banks/${pending}`, pendingStaff.token, { openingHours: "24/7" });
  check("staff of an unapproved bank can still fill in the profile (200)", pEdit.status === 200, `status ${pEdit.status}`);
  const xAdd = await api("POST", `/api/banks/${pending}/inventory`, staff.token, batch);
  check("staff cannot add stock at another bank (403)", xAdd.status === 403, `status ${xAdd.status}`);
  const uAdd = await api("POST", `/api/banks/${approved}/inventory`, other.token, batch);
  check("a normal user cannot add stock (403)", uAdd.status === 403, `status ${uAdd.status}`);
  const pBatches = await InventoryBatch.countDocuments({ bloodBank: pending });
  check("no stock was added to the unapproved bank", pBatches === 0, `${pBatches} batches`);

  console.log("\n— After approval —");
  await BloodBank.updateOne({ _id: pending }, { isApproved: true });
  const nowAdd = await api("POST", `/api/banks/${pending}/inventory`, pendingStaff.token, batch);
  check("once approved, the staff can add stock (201)", nowAdd.status === 201, `status ${nowAdd.status}`);
};

const cleanup = async () => {
  try {
    const [b, d, u, k] = await Promise.all([
      InventoryBatch.deleteMany({ bloodBank: { $in: created.bankIds } }),
      Donation.deleteMany({ bloodBank: { $in: created.bankIds } }),
      User.deleteMany({ _id: { $in: created.userIds }, name: /^ZZ BankAccess / }),
      BloodBank.deleteMany({ _id: { $in: created.bankIds }, name: /^ZZ BankAccess / }),
    ]);
    console.log(`\n🧹 Test data removed: ${u.deletedCount} users, ${k.deletedCount} banks, ${b.deletedCount} batches, ${d.deletedCount} donations`);
  } catch (err) {
    console.error(`Cleanup failed (delete "ZZ BankAccess ... ${RUN}" users/banks manually):`, err.message);
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
