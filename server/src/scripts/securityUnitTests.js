// server/src/scripts/securityUnitTests.js
//
// Free, instant tests of the security helpers. No server, database or API key needed.
//
// Run:  npm run test:security:unit

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { hasUnsafeKeys } from "../middleware/rejectOperators.js";
import { parseOrigins } from "../config/security.js";
import { validateEnv } from "../config/env.js";

let passed = 0;
let failed = 0;
const t = (name, fn) => {
  try {
    fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`❌ ${name}\n     → ${err.message.split("\n")[0]}`);
  }
};

console.log("— Operator and key rejection —");
t("normal bodies pass", () => {
  for (const ok of [{}, { a: 1 }, { name: "x", list: [1, 2, { b: "c" }] }, [], null, undefined, "text", 42, true]) {
    assert.equal(hasUnsafeKeys(ok), false, JSON.stringify(ok));
  }
});

t("MongoDB operator keys are rejected at any depth", () => {
  assert.equal(hasUnsafeKeys({ $ne: "" }), true);
  assert.equal(hasUnsafeKeys({ phone: { $ne: "" } }), true);
  assert.equal(hasUnsafeKeys({ a: [{ b: { $gt: 1 } }] }), true);
  assert.equal(hasUnsafeKeys([{ $where: "1" }]), true);
});

t("dotted keys are rejected", () => {
  assert.equal(hasUnsafeKeys({ "a.b": 1 }), true);
  assert.equal(hasUnsafeKeys({ nested: { "x.y": 1 } }), true);
});

t("prototype-pollution keys are rejected", () => {
  assert.equal(hasUnsafeKeys(JSON.parse('{"__proto__":{"admin":true}}')), true);
  assert.equal(hasUnsafeKeys({ constructor: { prototype: {} } }), true);
  assert.equal(hasUnsafeKeys({ prototype: 1 }), true);
});

t("absurdly deep nesting is rejected", () => {
  let deep = { v: 1 };
  for (let i = 0; i < 20; i++) deep = { n: deep };
  assert.equal(hasUnsafeKeys(deep), true);
  let shallow = { v: 1 };
  for (let i = 0; i < 5; i++) shallow = { n: shallow };
  assert.equal(hasUnsafeKeys(shallow), false);
});

t("values that merely CONTAIN a dollar sign or dot are fine", () => {
  assert.equal(hasUnsafeKeys({ notes: "costs $5.00, call 01711.." }), false);
});

console.log("\n— CORS origin list —");
t("origins are split, trimmed and stripped of trailing slashes", () => {
  assert.deepEqual(parseOrigins("http://localhost:5173/, https://rokto.example.com ,"), [
    "http://localhost:5173",
    "https://rokto.example.com",
  ]);
});
t("an empty or missing list gives no allowed origins", () => {
  assert.deepEqual(parseOrigins(""), []);
  assert.deepEqual(parseOrigins(undefined), []);
});

console.log("\n— Environment validation —");
const goodSecret = randomBytes(48).toString("hex");
const good = { MONGO_URI: "mongodb+srv://u:p@cluster0.example.net/db", JWT_SECRET: goodSecret, NODE_ENV: "development" };

t("a good configuration has no problems", () => {
  assert.deepEqual(validateEnv(good).problems, []);
});
t("a random 96-character hex secret is never mistaken for a placeholder", () => {
  for (let i = 0; i < 200; i++) {
    const env = { ...good, JWT_SECRET: randomBytes(48).toString("hex") };
    assert.deepEqual(validateEnv(env).problems, []);
  }
});
t("the placeholder secret from the setup guide is rejected", () => {
  const { problems } = validateEnv({ ...good, JWT_SECRET: "paste_the_generated_string_here" });
  assert.ok(problems.length >= 1);
});
t("a long placeholder is still rejected", () => {
  const { problems } = validateEnv({ ...good, JWT_SECRET: "please_paste_the_generated_string_here_ok_now" });
  assert.ok(problems.some((p) => p.includes("placeholder")));
});
t("missing and short secrets are rejected", () => {
  assert.ok(validateEnv({ ...good, JWT_SECRET: undefined }).problems.some((p) => p.includes("missing")));
  assert.ok(validateEnv({ ...good, JWT_SECRET: "short" }).problems.some((p) => p.includes("shorter")));
});
t("a missing, malformed or placeholder database address is rejected", () => {
  assert.ok(validateEnv({ ...good, MONGO_URI: undefined }).problems.length >= 1);
  assert.ok(validateEnv({ ...good, MONGO_URI: "http://nope" }).problems.length >= 1);
  assert.ok(validateEnv({ ...good, MONGO_URI: "mongodb+srv://u:<db_password>@c.net/db" }).problems.length >= 1);
});
t("production requires CLIENT_URL and warns about localhost", () => {
  assert.ok(validateEnv({ ...good, NODE_ENV: "production" }).problems.some((p) => p.includes("CLIENT_URL")));
  const w = validateEnv({ ...good, NODE_ENV: "production", CLIENT_URL: "http://localhost:5173" });
  assert.deepEqual(w.problems, []);
  assert.ok(w.warnings.some((x) => x.includes("localhost")));
});
t("a placeholder AI key only disables AI, it never blocks startup", () => {
  const r = validateEnv({ ...good, ANTHROPIC_API_KEY: "your_key_here" });
  assert.deepEqual(r.problems, []);
  assert.equal(r.aiDisabled, true);
});
t("a missing AI key is a warning, not a problem", () => {
  const r = validateEnv(good);
  assert.deepEqual(r.problems, []);
  assert.ok(r.warnings.some((x) => x.includes("ANTHROPIC_API_KEY")));
});
t("a real-looking AI key keeps AI enabled", () => {
  const r = validateEnv({ ...good, ANTHROPIC_API_KEY: "sk-ant-api03-" + randomBytes(24).toString("hex") });
  assert.equal(r.aiDisabled, false);
  assert.ok(!r.warnings.some((x) => x.includes("ANTHROPIC_API_KEY")));
});

console.log(`\nResult: ${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;