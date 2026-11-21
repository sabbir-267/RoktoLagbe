// server/src/utils/compatibility.js
//
// Which donor blood groups can give to each recipient group.
// This is a GUIDE for finding likely donors. The hospital must always confirm
// the blood type and do cross-matching before any transfusion.

const RED_CELLS = {
  "O-": ["O-"],
  "O+": ["O+", "O-"],
  "A-": ["A-", "O-"],
  "A+": ["A+", "A-", "O+", "O-"],
  "B-": ["B-", "O-"],
  "B+": ["B+", "B-", "O+", "O-"],
  "AB-": ["AB-", "A-", "B-", "O-"],
  "AB+": ["AB+", "AB-", "A+", "A-", "B+", "B-", "O+", "O-"],
};

// Whole blood and red cells follow red-cell compatibility.
// Platelets and plasma follow different rules, so we deliberately stay
// conservative and only match the identical blood group.
export const compatibleDonorGroups = (recipient, component = "whole_blood") => {
  const group = String(recipient ?? "").toUpperCase();
  if (!RED_CELLS[group]) return [];
  if (component === "platelets" || component === "plasma") return [group];
  return [...RED_CELLS[group]];
};