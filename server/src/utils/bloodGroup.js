export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// "a+", "A ", "ab " (URL-decoded "+") → "A+", "A+", "AB+"
export const normalizeBloodGroup = (v) =>
  String(v ?? "").toUpperCase().replace(/\s/g, "+");