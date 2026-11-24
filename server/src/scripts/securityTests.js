// server/src/scripts/securityTests.js
//
// Live security tests against the running API (npm run dev in another terminal).
// No AI key needed. It creates its own users in the database and removes them at the end.
//
// Run:  npm run test:security
// Optional env: BASE_URL

import "dotenv/config";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import DonorProfile from "../models/DonorProfile.js";
import { signToken } from "../utils/token.js";
import { parseOrigins } from "../config/security.js";

const BASE = process.env.BASE_URL || "http://localhost:5000";

let passed = 0;
let failed = 0;
const check = (name, ok, detail = "") => {
  ok ? passed++ : failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? `\n     → ${detail}` : ""}`);
};

const call = async (method, path, { token, body, raw, headers = {} } = {}) => {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (raw !== undefined) {
    payload = raw;
    h["Content-Type"] = "application/json";
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    h["Content-Type"] = "application/json";
  }
  const res = await fetch(BASE + path, { method, headers: h, body: payload });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (res.status === 429) throw new Error(`Rate limited (429) on ${method} ${path}. Restart the server and retry.`);
  return { status: res.status, data, headers: res.headers };
};

const randomPhone = () => "019" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const created = { userIds: [] };
const makeUser = async (name, extra = {}) => {
  const user = await User.create({ name, phone: randomPhone(), passwordHash: "not-a-real-hash", ...extra });
  created.userIds.push(user._id);
  return user;
};
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

const run = async () => {
  const health = await call("GET", "/api/health").catch((e) => {
    if (e.message.startsWith("Rate limited")) throw e;
    return null;
  });
  if (!health || health.status !== 200) throw new Error(`API is not reachable at ${BASE}. Start it with "npm run dev" first.`);
  await connectDB();

  // ---------- Headers ----------
  console.log("— Security headers —");
  const h = health.headers;
  check("x-powered-by is hidden", h.get("x-powered-by") === null, `got ${h.get("x-powered-by")}`);
  check("x-content-type-options is nosniff", h.get("x-content-type-options") === "nosniff", `got ${h.get("x-content-type-options")}`);
  check("x-frame-options is set", !!h.get("x-frame-options"));
  check("strict-transport-security is set", !!h.get("strict-transport-security"));
  const limited = await call("GET", "/api/donors?limit=1");
  check("API responses carry rate-limit headers", !!(limited.headers.get("ratelimit-limit") || limited.headers.get("ratelimit")), "no RateLimit header");

  // ---------- CORS ----------
  console.log("\n— CORS —");
  const allowed = parseOrigins(process.env.CLIENT_URL)[0];
  if (allowed) {
    const ok = await call("GET", "/api/health", { headers: { Origin: allowed } });
    check("the configured frontend origin is allowed", ok.headers.get("access-control-allow-origin") === allowed, `got ${ok.headers.get("access-control-allow-origin")}`);
    const pre = await call("OPTIONS", "/api/requests", {
      headers: { Origin: allowed, "Access-Control-Request-Method": "POST" },
    });
    check("preflight from the frontend succeeds", pre.status === 204 && pre.headers.get("access-control-allow-origin") === allowed, `status ${pre.status}`);
  } else {
    console.log("⏭️  CLIENT_URL is not set, skipping the allowed-origin checks");
  }
  const evil = await call("GET", "/api/health", { headers: { Origin: "https://evil.example" } });
  check("an unknown origin gets no CORS permission", evil.headers.get("access-control-allow-origin") === null, `got ${evil.headers.get("access-control-allow-origin")}`);
  const evilPre = await call("OPTIONS", "/api/requests", {
    headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" },
  });
  check("an unknown origin's preflight gets no CORS permission", evilPre.headers.get("access-control-allow-origin") === null);

  // ---------- Request bodies ----------
  console.log("\n— Hostile request bodies —");
  const op = await call("POST", "/api/auth/login", { body: { phone: { $ne: "" }, password: "x" } });
  check("an operator in the body is rejected (400)", op.status === 400 && op.data?.message === "Invalid request body", `status ${op.status} ${JSON.stringify(op.data)}`);
  const nested = await call("POST", "/api/auth/login", { body: { a: [{ b: { $gt: "" } }] } });
  check("a nested operator is rejected (400)", nested.status === 400, `status ${nested.status}`);
  const dotted = await call("POST", "/api/auth/login", { body: { "a.b": 1 } });
  check("a dotted key is rejected (400)", dotted.status === 400, `status ${dotted.status}`);
  const proto = await call("POST", "/api/auth/login", { raw: '{"phone":"01911111111","__proto__":{"admin":true}}' });
  check("a __proto__ key is rejected (400)", proto.status === 400, `status ${proto.status}`);
  const broken = await call("POST", "/api/auth/login", { raw: '{"phone":' });
  check("malformed JSON is a 400, not a 500", broken.status === 400, `status ${broken.status}`);
  const huge = await call("POST", "/api/auth/login", { body: { phone: "01911111111", password: "a".repeat(200 * 1024) } });
  check("a 200 KB body is refused (413)", huge.status === 413, `status ${huge.status}`);
  const missing = await call("GET", "/api/does-not-exist");
  check("an unknown route is a JSON 404", missing.status === 404 && missing.data?.success === false, `status ${missing.status}`);

  // ---------- Tokens ----------
  console.log("\n— Forged and abused tokens —");
  const secret = process.env.JWT_SECRET;
  const victim = await makeUser("Sec Victim");
  const valid = signToken(victim);
  const me = (token) => call("GET", "/api/auth/me", { token });

  check("sanity: a valid token works (200)", (await me(valid)).status === 200);

  const parts = valid.split(".");
  const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -2)}${parts[2].endsWith("A") ? "B" : "A"}x`;
  check("a token with a broken signature is rejected (401)", (await me(tampered)).status === 401);

  const wrong = jwt.sign({ id: String(victim._id), role: "admin" }, "a-totally-different-secret-value-123456");
  check("a token signed with another secret is rejected (401)", (await me(wrong)).status === 401);

  const none = `${b64url({ alg: "none", typ: "JWT" })}.${b64url({ id: String(victim._id), role: "admin" })}.`;
  check('an unsigned "alg: none" token is rejected (401)', (await me(none)).status === 401);

  const expired = jwt.sign({ id: String(victim._id), role: victim.role }, secret, { expiresIn: -10 });
  check("an expired token is rejected (401)", (await me(expired)).status === 401);

  const noBearer = await call("GET", "/api/auth/me", { headers: { Authorization: valid } });
  check('a token without the "Bearer " prefix is rejected (401)', noBearer.status === 401);

  const lying = jwt.sign({ id: String(victim._id), role: "admin" }, secret);
  const asAdmin = await call("POST", "/api/banks", { token: lying, body: { name: "Hacked Bank", phone: "01700000000", district: "Dhaka" } });
  check("a validly signed token claiming role admin gets no admin power (403)", asAdmin.status === 403, `status ${asAdmin.status}`);

  const banned = await makeUser("Sec Banned");
  const bannedToken = signToken(banned);
  await User.updateOne({ _id: banned._id }, { $set: { isActive: false } });
  check("a deactivated user's token stops working at once (401)", (await me(bannedToken)).status === 401);

  const gone = await makeUser("Sec Gone");
  const goneToken = signToken(gone);
  await User.deleteOne({ _id: gone._id });
  check("a deleted user's token stops working at once (401)", (await me(goneToken)).status === 401);

  // ---------- Mass assignment ----------
  console.log("\n— Mass assignment —");
  const other = await makeUser("Sec Other");
  const mallory = await makeUser("Sec Mallory");
  const put = await call("PUT", "/api/donors/me", {
    token: signToken(mallory),
    body: {
      bloodGroup: "A+",
      dateOfBirth: "1998-05-10",
      district: "Dhaka",
      isVerified: true,
      totalDonations: 99,
      verifiedBy: String(other._id),
      user: String(other._id),
      medicalNotes: "injected",
    },
  });
  check("a donor profile is created (201)", put.status === 201, `status ${put.status} ${JSON.stringify(put.data)}`);
  check("isVerified cannot be self-assigned", put.data?.donor?.isVerified === false, `isVerified ${put.data?.donor?.isVerified}`);
  check("totalDonations cannot be self-assigned", put.data?.donor?.totalDonations === 0, `totalDonations ${put.data?.donor?.totalDonations}`);
  const stored = await DonorProfile.findOne({ user: mallory._id }).select("+medicalNotes").lean();
  check("the profile is attached to the caller, not the id in the body", !!stored && !(await DonorProfile.findOne({ user: other._id })));
  check("medicalNotes cannot be injected", !stored?.medicalNotes, `medicalNotes ${stored?.medicalNotes}`);
  check("verifiedBy cannot be injected", !stored?.verifiedBy, `verifiedBy ${stored?.verifiedBy}`);
};

const cleanup = async () => {
  try {
    if (created.userIds.length) {
      await DonorProfile.deleteMany({ user: { $in: created.userIds } });
      await User.deleteMany({ _id: { $in: created.userIds } });
    }
    console.log("\n🧹 Test data removed");
  } catch (err) {
    console.error("Cleanup failed (delete the 'Sec ...' users manually):", err.message);
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