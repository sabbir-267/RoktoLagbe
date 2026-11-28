// server/src/scripts/avatarTests.js
// Profile pictures: upload, serve (cross-origin, cached), validation, removal.
// Needs the API running (npm run dev). Run: npm run test:avatar

import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import Avatar from "../models/Avatar.js";

const BASE = process.env.BASE_URL || "http://localhost:5000";
const RUN = Date.now().toString(36).toUpperCase();
let passed = 0;
let failed = 0;
const check = (name, ok, detail = "") => {
  ok ? passed++ : failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? `\n     → ${detail}` : ""}`);
};

// A real 1x1 PNG, and a JPEG header followed by filler
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 1)]);

const send = (method, path, token, body, type) =>
  fetch(BASE + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(type ? { "Content-Type": type } : {}) },
    body,
  });

let userId;
const run = async () => {
  await connectDB();
  const phone = "0199994" + String(Math.floor(Math.random() * 1e4)).padStart(4, "0");
  const u = await User.create({ name: `ZZ Avatar ${RUN}`, phone, passwordHash: await bcrypt.hash("password123", 10) });
  userId = u._id;
  const login = await (await send("POST", "/api/auth/login", null, JSON.stringify({ identifier: phone, password: "password123" }), "application/json")).json();
  const token = login.token;

  const anon = await send("PUT", "/api/avatars/me", null, PNG, "image/png");
  check("must be logged in to upload (401)", anon.status === 401, `status ${anon.status}`);

  const up = await send("PUT", "/api/avatars/me", token, PNG, "image/png");
  const upData = await up.json();
  check("upload a PNG (200)", up.status === 200, `status ${up.status} ${JSON.stringify(upData)}`);
  check("  returns the picture address", /^\/api\/avatars\/[a-f0-9]{24}\?v=/.test(upData.avatar || ""), upData.avatar);
  const me = await (await send("GET", "/api/auth/me", token)).json();
  check("account info shows the new picture", me.user?.avatar === upData.avatar, me.user?.avatar);

  const get = await send("GET", upData.avatar);
  const bytes = Buffer.from(await get.arrayBuffer());
  check("anyone can load the picture (200)", get.status === 200, `status ${get.status}`);
  check("  same bytes, image/png", bytes.equals(PNG) && get.headers.get("content-type")?.startsWith("image/png"), get.headers.get("content-type"));
  check("  allowed on the website's address (cross-origin)", get.headers.get("cross-origin-resource-policy") === "cross-origin");
  check("  cached long-term (versioned URL)", /immutable/.test(get.headers.get("cache-control") || ""), get.headers.get("cache-control"));
  const again = await send("GET", upData.avatar, null, undefined, undefined);
  const etag = get.headers.get("etag");
  const cond = await fetch(BASE + upData.avatar, { headers: { "If-None-Match": etag } });
  check("  unchanged picture answers 304", cond.status === 304 && again.status === 200, `status ${cond.status}`);

  const up2 = await send("PUT", "/api/avatars/me", token, JPEG, "image/jpeg");
  const up2Data = await up2.json();
  check("replace with a JPEG (200), new address", up2.status === 200 && up2Data.avatar !== upData.avatar, `status ${up2.status}`);
  check("  still one stored picture per user", (await Avatar.countDocuments({ user: userId })) === 1);

  const fake = await send("PUT", "/api/avatars/me", token, Buffer.from("<script>alert(1)</script>"), "image/png");
  check("a non-image file is refused (400)", fake.status === 400, `status ${fake.status}`);
  const big = await send("PUT", "/api/avatars/me", token, Buffer.concat([PNG, Buffer.alloc(400 * 1024)]), "image/png");
  check("a file over 300 KB is refused (413)", big.status === 413, `status ${big.status}`);
  const svg = await send("PUT", "/api/avatars/me", token, Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "image/svg+xml");
  check("SVG is not accepted", svg.status === 400 || svg.status === 415, `status ${svg.status}`);

  const del = await send("DELETE", "/api/avatars/me", token);
  check("remove the picture (200)", del.status === 200, `status ${del.status}`);
  const gone = await send("GET", `/api/avatars/${userId}`);
  check("  it no longer loads (404)", gone.status === 404, `status ${gone.status}`);
  const me2 = await (await send("GET", "/api/auth/me", token)).json();
  check("  account info has no picture", !me2.user?.avatar, me2.user?.avatar);
  const bad = await send("GET", "/api/avatars/not-an-id");
  check("a bad id answers 404", bad.status === 404, `status ${bad.status}`);
};

try {
  await run();
} catch (err) {
  failed++;
  console.error("\n💥 Test run aborted:", err.message);
} finally {
  if (mongoose.connection.readyState === 1) {
    await Avatar.deleteMany({ user: userId });
    const r = await User.deleteMany({ _id: userId, name: /^ZZ Avatar / });
    console.log(`\n🧹 Test data removed: ${r.deletedCount} user`);
    await mongoose.disconnect();
  }
  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
}
