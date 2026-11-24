// server/src/scripts/parserUnitTests.js
//
// Free, instant tests of the sanitizer and district list. No API key, no server,
// no database needed.
//
// Run:  npm run test:parser

import assert from "node:assert/strict";
import { sanitizeParsed, REQUIRED_FIELDS } from "../services/sanitizeParsed.js";
import { DISTRICTS, canonicalDistrict } from "../utils/districts.js";

const NOW = Date.parse("2026-11-17T08:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const run = (raw) => sanitizeParsed(raw, { now: NOW });

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

console.log("— Happy path —");
t("a complete, valid answer is cleaned and passed through", () => {
  const r = run({
    isBloodRequest: true,
    language: "bangla",
    patientName: "  Karim   Uddin ",
    bloodGroup: "A+",
    component: "red_cells",
    unitsNeeded: 2,
    hospital: "Enam Medical College",
    district: "Dhaka",
    neededBy: "2026-11-18T09:00:00+06:00",
    contactPhone: "+8801712345678",
    notes: "Surgery",
    assumptions: ["Assumed 9am for morning"],
  });
  assert.equal(r.isBloodRequest, true);
  assert.equal(r.language, "bangla");
  assert.equal(r.fields.patientName, "Karim Uddin");
  assert.equal(r.fields.component, "red_cells");
  assert.equal(r.fields.neededBy, "2026-11-18T03:00:00.000Z");
  assert.equal(r.fields.contactPhone, "01712345678");
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.warnings, []);
});

t("missing required fields are listed", () => {
  const r = run({ isBloodRequest: true, bloodGroup: "O-" });
  assert.deepEqual(r.fields, { bloodGroup: "O-" });
  assert.deepEqual(r.missing, REQUIRED_FIELDS.filter((f) => f !== "bloodGroup"));
});

console.log("\n— Bad values are dropped, not trusted —");
t("invalid values are removed with one warning each", () => {
  const r = run({
    isBloodRequest: true,
    bloodGroup: "X+",
    unitsNeeded: 25,
    district: "Narnia",
    neededBy: "2026-11-10T09:00:00+06:00",
    contactPhone: "12345",
  });
  assert.deepEqual(r.fields, {});
  assert.equal(r.warnings.length, 5);
  assert.equal(r.missing.length, REQUIRED_FIELDS.length);
});

t("units: only whole numbers 1-20 are accepted", () => {
  for (const bad of [0, -1, 2.5, 21, "2", null, NaN]) {
    assert.equal(run({ isBloodRequest: true, unitsNeeded: bad }).fields.unitsNeeded, undefined, `accepted ${bad}`);
  }
  for (const good of [1, 20]) {
    assert.equal(run({ isBloodRequest: true, unitsNeeded: good }).fields.unitsNeeded, good);
  }
});

t("deadline: past, beyond 60 days, or unparseable is dropped", () => {
  const iso = (ms) => new Date(ms).toISOString();
  assert.equal(run({ isBloodRequest: true, neededBy: iso(NOW - DAY) }).fields.neededBy, undefined);
  assert.equal(run({ isBloodRequest: true, neededBy: iso(NOW + 61 * DAY) }).fields.neededBy, undefined);
  assert.equal(run({ isBloodRequest: true, neededBy: "tomorrow morning" }).fields.neededBy, undefined);
  assert.equal(run({ isBloodRequest: true, neededBy: 12345 }).fields.neededBy, undefined);
  assert.equal(run({ isBloodRequest: true, neededBy: iso(NOW + 59 * DAY) }).fields.neededBy, iso(NOW + 59 * DAY));
});

t("a Bangla-digit phone number is converted", () => {
  assert.equal(run({ isBloodRequest: true, contactPhone: "০১৭১২৩৪৫৬৭৮" }).fields.contactPhone, "01712345678");
});

t("blood group and component must be from the allowed lists", () => {
  assert.equal(run({ isBloodRequest: true, bloodGroup: "ab+" }).fields.bloodGroup, "AB+");
  assert.equal(run({ isBloodRequest: true, bloodGroup: "A positive" }).fields.bloodGroup, undefined);
  assert.equal(run({ isBloodRequest: true, component: "stem_cells" }).fields.component, undefined);
});

console.log("\n— Not a request / garbage input —");
t("isBloodRequest false returns no fields", () => {
  const r = run({ isBloodRequest: false, bloodGroup: "A+", unitsNeeded: 2 });
  assert.equal(r.isBloodRequest, false);
  assert.deepEqual(r.fields, {});
});

t("null, strings, arrays and numbers are treated as not a request", () => {
  for (const junk of [null, undefined, "A+ blood", [1, 2], 42, true]) {
    const r = run(junk);
    assert.equal(r.isBloodRequest, false);
    assert.deepEqual(r.fields, {});
  }
});

t('"true" (a string) does not count as isBloodRequest', () => {
  assert.equal(run({ isBloodRequest: "true", bloodGroup: "A+" }).isBloodRequest, false);
});

console.log("\n— Hardening —");
t("unknown fields (urgency, requester, status) never come through", () => {
  const r = run({ isBloodRequest: true, bloodGroup: "A+", urgency: "critical", requester: "someone", status: "fulfilled" });
  assert.deepEqual(Object.keys(r.fields), ["bloodGroup"]);
  assert.equal("urgency" in r, false);
});

t("a __proto__ key in the AI output pollutes nothing", () => {
  const raw = JSON.parse('{"isBloodRequest":true,"bloodGroup":"A+","__proto__":{"polluted":true}}');
  const r = run(raw);
  assert.equal({}.polluted, undefined);
  assert.equal(r.fields.polluted, undefined);
  assert.deepEqual(Object.keys(r.fields), ["bloodGroup"]);
});

t("text is cleaned and capped", () => {
  const r = run({
    isBloodRequest: true,
    patientName: "x".repeat(200),
    hospital: "Dhaka\u0000 Medical\nCollege",
    notes: "n".repeat(1000),
  });
  assert.equal(r.fields.patientName.length, 80);
  assert.equal(r.fields.hospital, "Dhaka Medical College");
  assert.equal(r.fields.notes.length, 500);
});

t("a one-character name or hospital is dropped", () => {
  const r = run({ isBloodRequest: true, patientName: "K", hospital: "H" });
  assert.equal(r.fields.patientName, undefined);
  assert.equal(r.fields.hospital, undefined);
});

t("assumptions: at most 5, each capped, non-strings removed", () => {
  const r = run({ isBloodRequest: true, assumptions: ["a", "b", "c", "d", "e", "f", "g", 42, null, "y".repeat(500)] });
  assert.equal(r.assumptions.length, 5);
  const long = run({ isBloodRequest: true, assumptions: ["y".repeat(500)] });
  assert.equal(long.assumptions[0].length, 200);
});

t("an unknown language value is ignored", () => {
  assert.equal(run({ isBloodRequest: true, language: "klingon" }).language, undefined);
  assert.equal(run({ isBloodRequest: true, language: "banglish" }).language, "banglish");
});

console.log("\n— Districts —");
t("the list has 64 unique districts", () => {
  assert.equal(DISTRICTS.length, 64);
  assert.equal(new Set(DISTRICTS.map((d) => d.toLowerCase())).size, 64);
});

t("alternate spellings map to the canonical name", () => {
  const cases = {
    Chittagong: "Chattogram",
    comilla: "Cumilla",
    Jessore: "Jashore",
    BOGRA: "Bogura",
    barisal: "Barishal",
    "Cox's Bazar": "Cox's Bazar",
    "coxs bazar": "Cox's Bazar",
    "cox bazar": "Cox's Bazar",
    dhaka: "Dhaka",
    "  Sylhet ": "Sylhet",
  };
  for (const [input, expected] of Object.entries(cases)) {
    assert.equal(canonicalDistrict(input), expected, `${input} → ${canonicalDistrict(input)}`);
  }
});

t("unknown places and junk are not recognised", () => {
  for (const bad of ["Narnia", "", null, undefined, "ঢাকা", "dhaka; drop table"]) {
    assert.equal(canonicalDistrict(bad), undefined, `recognised ${bad}`);
  }
});

console.log(`\nResult: ${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;