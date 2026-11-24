// server/src/scripts/ruleParserTests.js
//
// Free, instant tests of the offline (no AI) request parser.
// Run:  npm run test:rules

import assert from "node:assert/strict";
import { parseWithRules } from "../services/ruleParser.js";

// Tuesday 17 Nov 2026, 2:00 PM in Dhaka (08:00 UTC)
const NOW = Date.parse("2026-11-17T08:00:00Z");
const run = (text) => parseWithRules(text, { now: NOW });
const dhaka = (iso) => new Date(Date.parse(iso) + 6 * 3600e3).toISOString().slice(0, 16).replace("T", " ");

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

t("English: full message", () => {
  const r = run("Urgent! Need 2 bags O+ blood for my father at Dhaka Medical College Hospital by tomorrow 10am. Call 01711223344");
  assert.equal(r.isBloodRequest, true);
  assert.equal(r.language, "english");
  assert.equal(r.fields.bloodGroup, "O+");
  assert.equal(r.fields.unitsNeeded, 2);
  assert.equal(r.fields.hospital, "Dhaka Medical College Hospital");
  assert.equal(r.fields.district, "Dhaka");
  assert.equal(r.fields.contactPhone, "01711223344");
  assert.equal(dhaka(r.fields.neededBy), "2026-11-18 10:00");
});

t("Bangla: digits, group, hospital, district, tonight", () => {
  const r = run("জরুরি ভিত্তিতে বি পজিটিভ রক্ত লাগবে ১ ব্যাগ, চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল, আজ রাতের মধ্যে। যোগাযোগ ০১৮১২৩৪৫৬৭৮");
  assert.equal(r.language, "bangla");
  assert.equal(r.fields.bloodGroup, "B+");
  assert.equal(r.fields.unitsNeeded, 1);
  assert.equal(r.fields.district, "Chattogram");
  assert.equal(r.fields.hospital, "চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল"); // kept as written, like the AI does
  assert.equal(r.fields.contactPhone, "01812345678");
  assert.equal(dhaka(r.fields.neededBy), "2026-11-17 20:00");
});

t("Banglish: AB negative, platelets, kal sokal", () => {
  const r = run("AB negative platelet lagbe 3 bag, Square Hospital Dhaka, kal sokal 9ta, rogi: Rahima Begum. jogajog +8801912345678");
  assert.equal(r.language, "banglish");
  assert.equal(r.fields.bloodGroup, "AB-");
  assert.equal(r.fields.component, "platelets");
  assert.equal(r.fields.unitsNeeded, 3);
  assert.equal(r.fields.hospital, "Square Hospital");
  assert.equal(r.fields.district, "Dhaka");
  assert.equal(r.fields.patientName, "Rahima Begum");
  assert.equal(r.fields.contactPhone, "01912345678");
  assert.equal(dhaka(r.fields.neededBy), "2026-11-18 09:00");
});

t("'O+ve', word numbers, patient label, condition note", () => {
  const r = run("Patient name: Karim Uddin. O+ve blood two bags needed for thalassemia at Rangpur Medical. 01556677889");
  assert.equal(r.fields.bloodGroup, "O+");
  assert.equal(r.fields.unitsNeeded, 2);
  assert.equal(r.fields.patientName, "Karim Uddin");
  assert.equal(r.fields.district, "Rangpur");
  assert.match(r.fields.notes, /thalassemia/i);
});

t("Bangla patient name stops at punctuation", () => {
  assert.equal(run("রোগীর নাম: মোছাঃ রহিমা খাতুন। এ পজিটিভ রক্ত লাগবে").fields.patientName, "মোছাঃ রহিমা খাতুন");
  assert.equal(run("Patient: Md. Abdul Karim, B+ blood needed").fields.patientName, "Md. Abdul Karim");
});

t("'বিকাল' is afternoon, not 'কাল' (tomorrow)", () => {
  const r = run("এ নেগেটিভ রক্ত দরকার আজ বিকাল ৪টায়, ঢাকা");
  assert.equal(r.fields.bloodGroup, "A-");
  assert.equal(dhaka(r.fields.neededBy), "2026-11-17 16:00");
});

t("Bangla district with case ending (ঢাকায়) and old English spelling", () => {
  assert.equal(run("ঢাকায় ও পজিটিভ রক্ত লাগবে").fields.district, "Dhaka");
  assert.equal(run("Need B- blood in Chittagong").fields.district, "Chattogram");
  assert.equal(run("Need A+ blood at Comilla").fields.district, "Cumilla");
});

t("'ASAP' sets two hours from now and notes it", () => {
  const r = run("Need A+ blood ASAP at Mitford hospital");
  assert.equal(dhaka(r.fields.neededBy), "2026-11-17 16:00");
  assert.ok(r.assumptions.some((a) => /two hours/.test(a)));
  assert.equal(r.fields.district, "Dhaka");
});

t("a time already passed today rolls to tomorrow", () => {
  const r = run("Need O- blood by 9am, Sylhet");
  assert.equal(dhaka(r.fields.neededBy), "2026-11-18 09:00");
});

t("unclear sign is left empty, not guessed", () => {
  const r = run("Blood group B lagbe 2 bag Dhaka");
  assert.equal(r.fields.bloodGroup, undefined);
  assert.ok(r.missing.includes("bloodGroup"));
});

t("not a blood request", () => {
  assert.equal(run("Hello, how are you? Meeting at 5pm tomorrow in Dhaka").isBloodRequest, false);
  assert.equal(run("Selling my bike, call 01711223344").isBloodRequest, false);
});

t("email-like and words with hyphens are not blood groups", () => {
  assert.equal(run("Need blood urgently, e-mail me at a-b@x.com").fields.bloodGroup, undefined);
});

t("missing fields are reported for the form", () => {
  const r = run("O+ blood lagbe");
  assert.deepEqual(r.missing.sort(), ["district", "hospital", "neededBy", "patientName", "unitsNeeded"]);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
