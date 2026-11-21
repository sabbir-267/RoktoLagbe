// server/src/services/sanitizeParsed.js
//
// The AI's output is treated as UNTRUSTED. This function rebuilds a fresh object
// from only the fields we know about and re-validates every one of them with
// the same rules the normal request form uses. It is pure (no network, no DB),
// so it can be unit-tested for free.

import { BLOOD_GROUPS, normalizeBloodGroup } from "../utils/bloodGroup.js";
import { COMPONENTS } from "../utils/shelfLife.js";
import { normalizePhone } from "../utils/phone.js";
import { canonicalDistrict } from "../utils/districts.js";

const DAY = 24 * 60 * 60 * 1000;
const LANGUAGES = ["bangla", "english", "banglish", "other"];

export const REQUIRED_FIELDS = ["patientName", "bloodGroup", "unitsNeeded", "hospital", "district", "neededBy"];

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";
const toLatinDigits = (s) => String(s).replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)));

const cleanText = (v, max) => {
  if (typeof v !== "string") return undefined;
  const s = v
    .replace(/[\u0000-\u001F\u007F]/g, " ") // control characters
    .replace(/\s+/g, " ")
    .trim();
  return s ? s.slice(0, max) : undefined;
};

export const sanitizeParsed = (raw, { now = Date.now() } = {}) => {
  const warnings = [];
  const fields = {};

  const isObj = raw !== null && typeof raw === "object" && !Array.isArray(raw);
  const language = isObj && LANGUAGES.includes(raw.language) ? raw.language : undefined;

  if (!isObj || raw.isBloodRequest !== true) {
    return { isBloodRequest: false, language, fields: {}, missing: [], assumptions: [], warnings };
  }

  const patientName = cleanText(raw.patientName, 80);
  if (patientName && patientName.length >= 2) fields.patientName = patientName;

  if (raw.bloodGroup !== undefined) {
    const bg = normalizeBloodGroup(raw.bloodGroup);
    if (BLOOD_GROUPS.includes(bg)) fields.bloodGroup = bg;
    else warnings.push("Blood group was not recognised");
  }

  if (raw.component !== undefined) {
    if (COMPONENTS.includes(raw.component)) fields.component = raw.component;
    else warnings.push("Blood component was not recognised");
  }

  if (raw.unitsNeeded !== undefined) {
    const n = raw.unitsNeeded;
    if (Number.isInteger(n) && n >= 1 && n <= 20) fields.unitsNeeded = n;
    else warnings.push("Number of units must be a whole number between 1 and 20");
  }

  const hospital = cleanText(raw.hospital, 120);
  if (hospital && hospital.length >= 2) fields.hospital = hospital;

  if (raw.district !== undefined) {
    const d = canonicalDistrict(raw.district);
    if (d) fields.district = d;
    else warnings.push("District was not recognised");
  }

  if (raw.neededBy !== undefined) {
    const ms = typeof raw.neededBy === "string" ? Date.parse(raw.neededBy) : NaN;
    if (!Number.isNaN(ms) && ms > now && ms <= now + 60 * DAY) {
      fields.neededBy = new Date(ms).toISOString();
    } else {
      warnings.push("Deadline was missing, in the past, or more than 60 days away");
    }
  }

  if (raw.contactPhone !== undefined) {
    const phone = normalizePhone(toLatinDigits(raw.contactPhone));
    if (/^01[3-9]\d{8}$/.test(phone)) fields.contactPhone = phone;
    else warnings.push("Contact phone is not a valid Bangladeshi mobile number");
  }

  const notes = cleanText(raw.notes, 500);
  if (notes) fields.notes = notes;

  const assumptions = Array.isArray(raw.assumptions)
    ? raw.assumptions.map((a) => cleanText(a, 200)).filter(Boolean).slice(0, 5)
    : [];

  const missing = REQUIRED_FIELDS.filter((f) => fields[f] === undefined);

  return { isBloodRequest: true, language, fields, missing, assumptions, warnings };
};