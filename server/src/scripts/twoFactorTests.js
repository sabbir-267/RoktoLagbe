// server/src/scripts/twoFactorTests.js
// Two-step verification for admin / doctor / bank staff accounts.
// Needs the API running (npm run dev). Run: npm run test:2fa

import "dotenv/config";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { totpAt, currentStep } from "../utils/totp.js";

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
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, data };
};

const ids = [];
const freePhone = async () => {
  for (let i = 0; i < 50; i++) {
    const phone = "0199993" + String(Math.floor(Math.random() * 1e4)).padStart(4, "0");
    if (!(await User.exists({ phone }))) return phone;
  }
  throw new Error("no free phone");
};
const makeUser = async (label, role) => {
  const phone = await freePhone();
  const u = await User.create({ name: `ZZ TwoStep ${label} ${RUN}`, phone, passwordHash: await bcrypt.hash(PASSWORD, 10), role });
  ids.push(u._id);
  return { id: String(u._id), phone };
};
const login = (u) => api("POST", "/api/auth/login", null, { phone: u.phone, password: PASSWORD });
const nextCode = (secret, offset = 0) => totpAt(secret, currentStep() + offset);

const run = async () => {
  await connectDB();

  console.log("— Normal accounts are unchanged —");
  const plain = await makeUser("User", "user");
  const lp = await login(plain);
  check("a regular user gets a session straight away", lp.status === 200 && !!lp.data?.token && !lp.data?.twoFactor);
  check("  and is told two-step isn't required", lp.data?.user?.twoFactorRequired === false);

  console.log("\n— First login of an admin: setup —");
  const admin = await makeUser("Admin", "admin");
  const l1 = await login(admin);
  check("admin login asks for two-step setup, no session", l1.status === 200 && l1.data?.twoFactor === "setup" && !l1.data?.token,
    JSON.stringify(l1.data));
  const challenge = l1.data?.challenge;
  const asSession = await api("GET", "/api/auth/me", challenge);
  check("the challenge ticket can't be used as a session (401)", asSession.status === 401);
  const wrongPw = await api("POST", "/api/auth/login", null, { phone: admin.phone, password: "wrong-password" });
  check("a wrong password still fails before any two-step (401)", wrongPw.status === 401);

  const setup = await api("POST", "/api/auth/2fa/setup", null, { challenge });
  const secret = setup.data?.secret;
  check("setup returns a key and a QR-code link", setup.status === 200 && /^[A-Z2-7]{32}$/.test(secret || "") &&
    /^otpauth:\/\/totp\/RoktoLagbe/.test(setup.data?.otpauthUrl || ""), JSON.stringify(setup.data));
  const stored = await User.findById(admin.id).select("+twoFactor.pendingSecret").lean();
  check("  the key is stored encrypted", !!stored.twoFactor?.pendingSecret && !stored.twoFactor.pendingSecret.includes(secret));

  const badEnable = await api("POST", "/api/auth/2fa/enable", null, { challenge, code: "000000" });
  check("a wrong code doesn't finish setup (400)", badEnable.status === 400);
  const enable = await api("POST", "/api/auth/2fa/enable", null, { challenge, code: nextCode(secret) });
  check("the right code finishes setup and logs in (200)", enable.status === 200 && !!enable.data?.token, JSON.stringify(enable.data));
  const backup = enable.data?.backupCodes || [];
  check("  10 one-time backup codes are shown", backup.length === 10 && backup.every((c) => /^[a-z0-9]{4}-[a-z0-9]{4}$/.test(c)));
  check("  the user is marked as set up", enable.data?.user?.twoFactorEnabled === true);
  const adminToken = enable.data?.token;
  const adminCall = await api("GET", "/api/admin/stats", adminToken);
  check("the new session works for admin pages (200)", adminCall.status === 200, `status ${adminCall.status}`);

  console.log("\n— Later logins: verify —");
  const l2 = await login(admin);
  check("next login asks for the code", l2.data?.twoFactor === "verify" && !l2.data?.token);
  const reuse = await api("POST", "/api/auth/2fa/verify", null, { challenge: l2.data?.challenge, code: nextCode(secret) });
  check("the code just used for setup can't be used again (400)", reuse.status === 400 && /already used/.test(reuse.data?.message || ""),
    `${reuse.status} ${reuse.data?.message}`);
  const v2 = await api("POST", "/api/auth/2fa/verify", null, { challenge: l2.data?.challenge, code: nextCode(secret, 1) });
  check("the next code from the app works (200)", v2.status === 200 && !!v2.data?.token, JSON.stringify(v2.data));

  const l3 = await login(admin);
  const vb = await api("POST", "/api/auth/2fa/verify", null, { challenge: l3.data?.challenge, code: backup[0].toUpperCase() });
  check("a backup code works (any letter case)", vb.status === 200 && !!vb.data?.token, JSON.stringify(vb.data));
  const l4 = await login(admin);
  const vb2 = await api("POST", "/api/auth/2fa/verify", null, { challenge: l4.data?.challenge, code: backup[0] });
  check("the same backup code works only once (400)", vb2.status === 400);
  const status = await api("GET", "/api/auth/2fa/status", vb.data?.token);
  check("status shows 9 backup codes left", status.data?.enabled === true && status.data?.backupCodesLeft === 9, JSON.stringify(status.data));

  const regenBad = await api("POST", "/api/auth/2fa/backup-codes", vb.data?.token, { code: "123456" });
  check("new backup codes need the current app code (400)", regenBad.status === 400);
  const regen = await api("POST", "/api/auth/2fa/backup-codes", vb.data?.token, { code: nextCode(secret) });
  check("new backup codes with the right code (200)", regen.status === 200 && regen.data?.backupCodes?.length === 10);
  const l5 = await login(admin);
  const oldBackup = await api("POST", "/api/auth/2fa/verify", null, { challenge: l5.data?.challenge, code: backup[1] });
  check("  the old backup codes stop working", oldBackup.status === 400);

  console.log("\n— Old sessions and other roles —");
  const noMfa = jwt.sign({ id: admin.id, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "1h" });
  const old = await api("GET", "/api/admin/stats", noMfa);
  check("an admin session without two-step is refused (401)", old.status === 401 && /two-step/.test(old.data?.message || ""), old.data?.message);
  for (const role of ["doctor", "bank_staff"]) {
    const u = await makeUser(role, role);
    const r = await login(u);
    check(`${role} login also needs two-step`, r.data?.twoFactor === "setup" && !r.data?.token);
  }

  console.log("\n— Admin reset (lost phone) —");
  const admin2 = await makeUser("Admin2", "admin");
  const a2 = await login(admin2);
  const s2 = await api("POST", "/api/auth/2fa/setup", null, { challenge: a2.data?.challenge });
  const e2 = await api("POST", "/api/auth/2fa/enable", null, { challenge: a2.data?.challenge, code: nextCode(s2.data?.secret) });
  const admin2Token = e2.data?.token;
  const self = await api("POST", `/api/admin/users/${admin2.id}/reset-2fa`, admin2Token);
  check("an admin can't reset their own two-step (400)", self.status === 400);
  const byUser = await api("POST", `/api/admin/users/${admin.id}/reset-2fa`, lp.data?.token);
  check("a regular user can't reset anyone's (403)", byUser.status === 403);
  const reset = await api("POST", `/api/admin/users/${admin.id}/reset-2fa`, admin2Token);
  check("another admin can reset it (200)", reset.status === 200, JSON.stringify(reset.data));
  const after = await User.findById(admin.id).select("+twoFactor.secret +twoFactor.backupCodes").lean();
  check("  the key and backup codes are removed", !after.twoFactor?.enabled && !after.twoFactor?.secret && !after.twoFactor?.backupCodes?.length,
    JSON.stringify(after.twoFactor));
  const note = await Notification.findOne({ user: admin.id, title: /Two-step verification was reset/ }).lean();
  check("  the user is notified", !!note);
  const l6 = await login(admin);
  check("  next login asks to set it up again", l6.data?.twoFactor === "setup");

  console.log("\n— Guessing is limited —");
  const guesser = await makeUser("Guesser", "admin");
  const g = await login(guesser);
  const gs = await api("POST", "/api/auth/2fa/setup", null, { challenge: g.data?.challenge });
  await api("POST", "/api/auth/2fa/enable", null, { challenge: g.data?.challenge, code: nextCode(gs.data?.secret) });
  const g2 = await login(guesser);
  let last;
  for (let i = 0; i < 11; i++) {
    last = await api("POST", "/api/auth/2fa/verify", null, { challenge: g2.data?.challenge, code: String(100000 + i) });
  }
  check("after 10 wrong codes the account is paused (429)", last.status === 429, `status ${last.status}`);
};

try {
  await run();
} catch (err) {
  failed++;
  console.error("\n💥 Test run aborted:", err.message);
} finally {
  if (mongoose.connection.readyState === 1) {
    await Notification.deleteMany({ user: { $in: ids } });
    const r = await User.deleteMany({ _id: { $in: ids }, name: /^ZZ TwoStep / });
    console.log(`\n🧹 Test data removed: ${r.deletedCount} users`);
    await mongoose.disconnect();
  }
  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
}
