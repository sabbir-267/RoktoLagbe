// server/src/scripts/mustRunTests.js
//
// Automated version of the "must run" Step 5 checks.
// Needs the API running (npm run dev in another terminal).
// Creates its own bank + users, then deletes them at the end.
//
// Run:  npm run test:must
// Optional env: BASE_URL, ADMIN_PHONE, ADMIN_PASSWORD

import "dotenv/config";
import fs from "node:fs";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import BloodBank from "../models/BloodBank.js";
import InventoryBatch from "../models/InventoryBatch.js";
import User from "../models/User.js";
import { expireStaleBatches } from "../services/inventoryService.js";

const BASE = process.env.BASE_URL || "http://localhost:5000";
const ADMIN_PHONE = process.env.ADMIN_PHONE || "01911111110";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "password123";
const PASSWORD = "password123";

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
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  return { status: res.status, data };
};

const randomPhone = () => "019" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const yesterday = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const created = { bankId: null, phones: [] };

const run = async () => {
  // ---------- Setup ----------
  const health = await api("GET", "/api/health").catch(() => null);
  if (!health || health.status !== 200) {
    throw new Error(`API is not reachable at ${BASE}. Start it with "npm run dev" first.`);
  }
  await connectDB();

  const adminLogin = await api("POST", "/api/auth/login", null, { phone: ADMIN_PHONE, password: ADMIN_PASSWORD });
  if (adminLogin.status !== 200 || adminLogin.data?.user?.role !== "admin") {
    throw new Error(
      `Admin login failed (status ${adminLogin.status}, role ${adminLogin.data?.user?.role}). ` +
        `Make sure ${ADMIN_PHONE} exists and has role "admin" in Atlas.`
    );
  }
  const adminToken = adminLogin.data.token;

  const staffPhone = randomPhone();
  const staffReg = await api("POST", "/api/auth/register", null, {
    name: "MustRun Staff",
    phone: staffPhone,
    password: PASSWORD,
  });
  created.phones.push(staffPhone);
  if (staffReg.status !== 201) throw new Error(`Could not register test staff: ${JSON.stringify(staffReg.data)}`);
  const staffToken = staffReg.data.token;
  const staffUserId = staffReg.data.user.id;

  const district = `ZZTest${Date.now()}`;
  const bankRes = await api("POST", "/api/banks", adminToken, {
    name: "ZZ MustRun Test Bank",
    phone: "01700000000",
    district,
    division: "Test",
  });
  if (bankRes.status !== 201) throw new Error(`Could not create test bank: ${JSON.stringify(bankRes.data)}`);
  const bankId = bankRes.data.bank.id;
  created.bankId = bankId;

  const assign = await api("POST", `/api/banks/${bankId}/staff`, adminToken, { phone: staffPhone });
  if (assign.status !== 200) throw new Error(`Could not assign staff: ${JSON.stringify(assign.data)}`);

  console.log(`\nSetup done. Test bank ${bankId} in district "${district}"\n`);

  // ---------- 16b: staff cannot set licenseNo ----------
  console.log("— Staff permissions (16b) —");
  const patch = await api("PATCH", `/api/banks/${bankId}`, staffToken, {
    phone: "01733333333",
    licenseNo: "HACK-1",
  });
  check("16b  staff can edit own bank (200)", patch.status === 200, `status ${patch.status}`);
  const bankDoc = await BloodBank.findById(bankId).lean();
  check("16b  phone was updated", bankDoc?.phone === "01733333333", `phone is ${bankDoc?.phone}`);
  check("16b  licenseNo was NOT set by staff", bankDoc?.licenseNo === undefined, `licenseNo is ${bankDoc?.licenseNo}`);

  // ---------- 14b / 14c: hasBloodGroup search ----------
  console.log("\n— Bank search by blood group (14b, 14c) —");
  const addO = await api("POST", `/api/banks/${bankId}/inventory`, staffToken, {
    bloodGroup: "O-",
    component: "whole_blood",
    units: 2,
    collectedAt: yesterday(),
  });
  check("     staff can add an O- batch (201)", addO.status === 201, `status ${addO.status}`);
  const batchOId = addO.data?.batch?.id;

  const has0 = await api("GET", `/api/banks?district=${district}&hasBloodGroup=O-`);
  check("14b  hasBloodGroup=O- finds the bank", has0.data?.total === 1, `total ${has0.data?.total}`);
  const hasA = await api("GET", `/api/banks?district=${district}&hasBloodGroup=A%2B`);
  check("14c  hasBloodGroup=A+ finds nothing", hasA.data?.total === 0, `total ${hasA.data?.total}`);

  // ---------- 15: operator injection ----------
  console.log("\n— Injection (15) —");
  const inj = await api("GET", `/api/banks?district[$ne]=${district}&limit=50`);
  const ids = (inj.data?.banks || []).map((b) => b.id);
  check("15   district[$ne] request succeeds (200)", inj.status === 200, `status ${inj.status}`);
  check(
    "15   operator was ignored (test bank still returned)",
    ids.includes(bankId),
    "the $ne operator was applied to the query"
  );

  // ---------- 13f: atomic issue (bonus) ----------
  console.log("\n— Atomic issue / race (13f) —");
  const addB = await api("POST", `/api/banks/${bankId}/inventory`, staffToken, {
    bloodGroup: "B+",
    component: "whole_blood",
    units: 3,
    collectedAt: yesterday(),
  });
  const batchBId = addB.data?.batch?.id;
  const [r1, r2] = await Promise.all([
    api("POST", `/api/banks/${bankId}/inventory/${batchBId}/issue`, staffToken, { units: 3 }),
    api("POST", `/api/banks/${bankId}/inventory/${batchBId}/issue`, staffToken, { units: 3 }),
  ]);
  const statuses = [r1.status, r2.status].sort();
  check("13f  two simultaneous issues: one 200, one 409", statuses[0] === 200 && statuses[1] === 409, `got ${statuses}`);
  const batchB = await InventoryBatch.findById(batchBId).lean();
  check("13f  units never go negative (is 0)", batchB?.units === 0, `units ${batchB?.units}`);

  // ---------- 18: expiry ----------
  console.log("\n— Expiry (18, 18b) —");
  const stockBefore = await api("GET", `/api/banks/${bankId}/stock`);
  check(
    "18   O- shows in public stock while valid",
    stockBefore.data?.stock?.some((s) => s.bloodGroup === "O-"),
    JSON.stringify(stockBefore.data?.stock)
  );

  await InventoryBatch.updateOne({ _id: batchOId }, { $set: { expiresAt: new Date(Date.now() - 60 * 60 * 1000) } });
  const stockAfter = await api("GET", `/api/banks/${bankId}/stock`);
  check(
    "18   expired O- is excluded BEFORE any sweep runs",
    !stockAfter.data?.stock?.some((s) => s.bloodGroup === "O-"),
    JSON.stringify(stockAfter.data?.stock)
  );

  const swept = await expireStaleBatches();
  check("18b  sweep marks stale batches (count >= 1)", swept >= 1, `swept ${swept}`);
  const batchO = await InventoryBatch.findById(batchOId).lean();
  check('18b  batch status is "expired"', batchO?.status === "expired", `status ${batchO?.status}`);

  const revive = await api("PATCH", `/api/banks/${bankId}/inventory/${batchOId}`, staffToken, { status: "available" });
  check("18c  expired batch cannot be revived (409)", revive.status === 409, `status ${revive.status}`);

  const serverSrc = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
  const imported = /import\s*\{[^}]*startExpirySweep[^}]*\}\s*from/.test(serverSrc);
  const callAt = serverSrc.indexOf("startExpirySweep()");
  const connectAt = serverSrc.indexOf("await connectDB()");
  check(
    "18b  server.js imports and calls startExpirySweep() after connectDB()",
    imported && callAt !== -1 && connectAt !== -1 && callAt > connectAt,
    "add the import and call startExpirySweep() right after `await connectDB();` in server.js"
  );

  // ---------- 19 / 19b: revocation ----------
  console.log("\n— Revoking staff (19, 19b) —");
  const before = await api("POST", `/api/banks/${bankId}/inventory`, staffToken, {
    bloodGroup: "AB+",
    units: 1,
    collectedAt: yesterday(),
  });
  check("19   staff can add stock before removal (201)", before.status === 201, `status ${before.status}`);

  const remove = await api("DELETE", `/api/banks/${bankId}/staff/${staffUserId}`, adminToken);
  check("19   admin removes staff (200)", remove.status === 200, `status ${remove.status}`);
  const userDoc = await User.findById(staffUserId).lean();
  check(
    '19   user is back to role "user" with no bank',
    userDoc?.role === "user" && !userDoc?.bloodBank,
    `role ${userDoc?.role}, bloodBank ${userDoc?.bloodBank}`
  );

  const after = await api("POST", `/api/banks/${bankId}/inventory`, staffToken, {
    bloodGroup: "AB+",
    units: 1,
    collectedAt: yesterday(),
  });
  check("19b  OLD token is rejected immediately (403)", after.status === 403, `status ${after.status}`);
};

const cleanup = async () => {
  try {
    if (created.bankId) {
      await InventoryBatch.deleteMany({ bloodBank: created.bankId });
      await BloodBank.deleteOne({ _id: created.bankId });
    }
    if (created.phones.length) await User.deleteMany({ phone: { $in: created.phones } });
    console.log("\n🧹 Test data removed");
  } catch (err) {
    console.error("Cleanup failed (remove 'ZZ MustRun Test Bank' manually):", err.message);
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