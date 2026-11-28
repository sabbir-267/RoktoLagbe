// server/src/scripts/requestTests.js
//
// Automated checks for Step 6A (blood requests).
// Needs the API running (npm run dev in another terminal).
// Creates its own users and requests, then deletes them at the end.
//
// Run:  npm run test:requests
// Optional env: BASE_URL, ADMIN_PHONE, ADMIN_PASSWORD

import "dotenv/config";
import fs from "node:fs";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import BloodRequest from "../models/BloodRequest.js";
import User from "../models/User.js";
import { expireStaleRequests } from "../services/requestService.js";
import { loginThrough2fa } from "./helpers/twoFactorLogin.js";

const BASE = process.env.BASE_URL || "http://localhost:5000";
const ADMIN_PHONE = process.env.ADMIN_PHONE || "01911111110";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "password123";
const PASSWORD = "password123";
const HOUR = 60 * 60 * 1000;

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
      `Rate limited (429) on ${method} ${path}. Restart the server to reset the in-memory limiter, ` +
        `or set REQUEST_CREATE_LIMIT=1000 in server/.env for development.`
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
const find = (res, id) => (res.data?.requests || []).find((r) => r.id === id);

const created = { phones: [], userIds: [] };

const register = async (name) => {
  const phone = randomPhone();
  const r = await api("POST", "/api/auth/register", null, { name, phone, password: PASSWORD });
  if (r.status !== 201) throw new Error(`Could not register ${name}: ${JSON.stringify(r.data)}`);
  created.phones.push(phone);
  created.userIds.push(r.data.user.id);
  return { phone, token: r.data.token, id: r.data.user.id };
};

const run = async () => {
  // ---------- Setup ----------
  const health = await api("GET", "/api/health").catch((e) => {
    if (e.message.startsWith("Rate limited")) throw e;
    return null;
  });
  if (!health || health.status !== 200) {
    throw new Error(`API is not reachable at ${BASE}. Start it with "npm run dev" first.`);
  }
  await connectDB();

  const adminLogin = await loginThrough2fa(api, { phone: ADMIN_PHONE, password: ADMIN_PASSWORD });
  if (adminLogin.status !== 200 || adminLogin.data?.user?.role !== "admin") {
    throw new Error(
      `Admin login failed (status ${adminLogin.status}, role ${adminLogin.data?.user?.role}). ` +
        `Make sure ${ADMIN_PHONE} exists and has role "admin" in Atlas.`
    );
  }
  const admin = adminLogin.data.token;

  const owner = await register("Req Owner");
  const other = await register("Req Other");

  const district = `ZZReq${Date.now()}`; // unique, so other data never interferes
  const body = (extra = {}) => ({
    patientName: "Karim Uddin",
    bloodGroup: "A+",
    unitsNeeded: 2,
    hospital: "Enam Medical College",
    district,
    neededBy: inHours(3),
    notes: "Surgery tonight",
    ...extra,
  });

  console.log(`\nSetup done. Test district "${district}"\n`);

  // ---------- Creating ----------
  console.log("— Creating requests (1–4) —");
  const noToken = await api("POST", "/api/requests", null, body());
  check("1    no token → 401", noToken.status === 401, `status ${noToken.status}`);

  const c = await api("POST", "/api/requests", owner.token, body());
  const r1 = c.data?.request;
  check("2    valid request → 201", c.status === 201, `status ${c.status} ${JSON.stringify(c.data)}`);
  check('2    urgency is "critical" for a 3-hour deadline', r1?.urgency === "critical", `urgency ${r1?.urgency}`);
  check('2    status is "open"', r1?.status === "open", `status ${r1?.status}`);
  check("2    owner sees patientName", r1?.patientName === "Karim Uddin", `patientName ${r1?.patientName}`);
  check("2    contactPhone defaults to the owner's phone", r1?.contactPhone === owner.phone, `contactPhone ${r1?.contactPhone}`);
  const req1 = r1?.id;

  const bad = await api("POST", "/api/requests", owner.token, {
    patientName: "K",
    bloodGroup: "X+",
    unitsNeeded: 0,
    hospital: "",
    neededBy: new Date(Date.now() - HOUR).toISOString(),
  });
  const fields = (bad.data?.errors || []).map((e) => e.field);
  const expectedFields = ["patientName", "bloodGroup", "unitsNeeded", "hospital", "district", "neededBy"];
  check("3    invalid body → 400", bad.status === 400, `status ${bad.status}`);
  check(
    "3    exactly one message per bad field",
    fields.length === expectedFields.length && expectedFields.every((f) => fields.includes(f)),
    `fields: ${fields.join(", ")}`
  );
  const distMsg = (bad.data?.errors || []).find((e) => e.field === "district")?.message;
  check('3    district message is "District is required"', distMsg === "District is required", `message ${distMsg}`);

  const far = await api("POST", "/api/requests", owner.token, body({ neededBy: inHours(90 * 24) }));
  check("4    neededBy beyond 60 days → 400", far.status === 400, `status ${far.status}`);
  check(
    "4    message mentions 60 days",
    (far.data?.errors || []).some((e) => e.message.includes("60 days")),
    JSON.stringify(far.data?.errors)
  );

  // ---------- Privacy ----------
  console.log("\n— Privacy (5, 6) —");
  const guestList = await api("GET", `/api/requests?bloodGroup=A%2B&district=${district}`);
  const g = find(guestList, req1);
  check("5    guest can see the open request", !!g, `total ${guestList.data?.total}`);
  check(
    "5    guest sees NO contactPhone / patientName / notes / requester",
    !!g && g.contactPhone === undefined && g.patientName === undefined && g.notes === undefined && g.requester === undefined,
    JSON.stringify(g)
  );

  const otherList = await api("GET", `/api/requests?bloodGroup=A%2B&district=${district}`, other.token);
  const o = find(otherList, req1);
  check("6    logged-in user sees contactPhone and notes", o?.contactPhone === owner.phone && o?.notes === "Surgery tonight", JSON.stringify(o));
  check("6    logged-in stranger still does NOT see patientName", o && o.patientName === undefined, `patientName ${o?.patientName}`);

  // ---------- Search and injection ----------
  console.log("\n— Search and injection (7, 8, 9) —");
  const a = await api("GET", `/api/requests?bloodGroup=A%2B&district=${district}`);
  const oneg = await api("GET", `/api/requests?bloodGroup=O-&district=${district}`);
  check("7    A+ filter finds the request", !!find(a, req1));
  check("7    O- filter does not", !find(oneg, req1));

  const inj = await api("GET", `/api/requests?district[$ne]=${district}&bloodGroup=A%2B&limit=50`);
  check("8    district[$ne] request succeeds (200)", inj.status === 200, `status ${inj.status}`);
  check("8    operator ignored (request still returned)", !!find(inj, req1), "the $ne operator was applied to the query");

  const pubStatus = await api("GET", "/api/requests?status=fulfilled");
  check("9    public status=fulfilled → 400", pubStatus.status === 400, `status ${pubStatus.status}`);

  // ---------- Permissions ----------
  console.log("\n— Permissions and status rules (10–13) —");
  const strangerEdit = await api("PATCH", `/api/requests/${req1}`, other.token, { unitsNeeded: 5 });
  check("10   stranger cannot edit (403)", strangerEdit.status === 403, `status ${strangerEdit.status}`);

  const edit = await api("PATCH", `/api/requests/${req1}`, owner.token, {
    unitsNeeded: 3,
    neededBy: inHours(48),
    bloodGroup: "O-",
  });
  check("11   owner can edit (200)", edit.status === 200, `status ${edit.status} ${JSON.stringify(edit.data)}`);
  check("11   unitsNeeded updated to 3", edit.data?.request?.unitsNeeded === 3, `units ${edit.data?.request?.unitsNeeded}`);
  check('11   urgency recalculated to "medium"', edit.data?.request?.urgency === "medium", `urgency ${edit.data?.request?.urgency}`);
  check("11   bloodGroup is locked (still A+)", edit.data?.request?.bloodGroup === "A+", `bloodGroup ${edit.data?.request?.bloodGroup}`);

  const strangerStatus = await api("PATCH", `/api/requests/${req1}/status`, other.token, { status: "cancelled" });
  check("12a  stranger cannot change status (403)", strangerStatus.status === 403, `status ${strangerStatus.status}`);
  const ownerProgress = await api("PATCH", `/api/requests/${req1}/status`, owner.token, { status: "in_progress" });
  check("12b  owner cannot set in_progress (403)", ownerProgress.status === 403, `status ${ownerProgress.status}`);

  const adminProgress = await api("PATCH", `/api/requests/${req1}/status`, admin, { status: "in_progress" });
  check("13a  admin sets in_progress (200)", adminProgress.status === 200, `status ${adminProgress.status}`);
  const inProgressList = await api("GET", `/api/requests?status=in_progress&district=${district}`);
  check("13b  request shows under status=in_progress", !!find(inProgressList, req1));

  const done = await api("PATCH", `/api/requests/${req1}/status`, admin, { status: "fulfilled" });
  check("13c  admin marks fulfilled (200)", done.status === 200, `status ${done.status}`);
  check("13c  fulfilledUnits is 3", done.data?.request?.fulfilledUnits === 3, `fulfilledUnits ${done.data?.request?.fulfilledUnits}`);

  const reopen = await api("PATCH", `/api/requests/${req1}/status`, owner.token, { status: "cancelled" });
  check("13d  closed request cannot change status (409)", reopen.status === 409, `status ${reopen.status}`);
  const editClosed = await api("PATCH", `/api/requests/${req1}`, owner.token, { hospital: "Other Hospital" });
  check("13e  closed request cannot be edited (409)", editClosed.status === 409, `status ${editClosed.status}`);

  // ---------- Visibility of closed requests ----------
  console.log("\n— Visibility of closed requests (14, 15, 17) —");
  const pubGet = await api("GET", `/api/requests/${req1}`);
  check("14   guest gets 404 for a fulfilled request", pubGet.status === 404, `status ${pubGet.status}`);
  const strangerGet = await api("GET", `/api/requests/${req1}`, other.token);
  check("14   stranger gets 404 for a fulfilled request", strangerGet.status === 404, `status ${strangerGet.status}`);
  const ownerGet = await api("GET", `/api/requests/${req1}`, owner.token);
  check("14b  owner can still view it (200)", ownerGet.status === 200, `status ${ownerGet.status}`);

  const mine = await api("GET", "/api/requests/mine", owner.token);
  const m = find(mine, req1);
  check("15   /mine lists the owner's request", !!m);
  check("15   /mine shows patientName and isMine", m?.patientName === "Karim Uddin" && m?.isMine === true, JSON.stringify(m));
  const mineNoToken = await api("GET", "/api/requests/mine");
  check("15   /mine without a token → 401", mineNoToken.status === 401, `status ${mineNoToken.status}`);

  const badId = await api("GET", "/api/requests/abc");
  check("17   invalid id → 400", badId.status === 400, `status ${badId.status}`);

  // ---------- Active request limit ----------
  console.log("\n— Active request limit (16) —");
  const extra = [];
  for (let i = 0; i < 3; i++) {
    const r = await api("POST", "/api/requests", owner.token, body({ patientName: `Patient ${i + 1}` }));
    check(`16   active request ${i + 1} of 3 → 201`, r.status === 201, `status ${r.status} ${JSON.stringify(r.data)}`);
    extra.push(r.data?.request?.id);
  }
  const fourth = await api("POST", "/api/requests", owner.token, body({ patientName: "Patient 4" }));
  check("16   fourth active request → 409", fourth.status === 409, `status ${fourth.status}`);

  // ---------- Expiry ----------
  console.log("\n— Expiry (18) —");
  await BloodRequest.updateOne({ _id: extra[0] }, { $set: { neededBy: new Date(Date.now() - 48 * HOUR) } });
  const afterAge = await api("GET", `/api/requests?district=${district}&limit=50`);
  check("18   overdue request is hidden BEFORE any sweep runs", !find(afterAge, extra[0]), "still listed");
  check("18   other requests are still listed", !!find(afterAge, extra[1]));

  const swept = await expireStaleRequests();
  check("18   sweep marks stale requests (count >= 1)", swept >= 1, `swept ${swept}`);
  const doc = await BloodRequest.findById(extra[0]).lean();
  check('18   status is "expired"', doc?.status === "expired", `status ${doc?.status}`);

  const serverSrc = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
  const imported = /import\s*\{[^}]*startRequestExpirySweep[^}]*\}\s*from/.test(serverSrc);
  const callAt = serverSrc.indexOf("startRequestExpirySweep()");
  const connectAt = serverSrc.indexOf("await connectDB()");
  check(
    "18   server.js imports and calls startRequestExpirySweep() after connectDB()",
    imported && callAt !== -1 && connectAt !== -1 && callAt > connectAt,
    "add the import and call startRequestExpirySweep() right after `await connectDB();` in server.js"
  );
};

const cleanup = async () => {
  try {
    if (created.userIds.length) await BloodRequest.deleteMany({ requester: { $in: created.userIds } });
    if (created.phones.length) await User.deleteMany({ phone: { $in: created.phones } });
    console.log("\n🧹 Test data removed");
  } catch (err) {
    console.error("Cleanup failed (delete the 'Req Owner' and 'Req Other' users and their requests manually):", err.message);
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