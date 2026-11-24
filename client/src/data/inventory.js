export const COMPONENTS = [
  { value: "whole_blood", label: "Whole blood" },
  { value: "red_cells", label: "Red cells" },
  { value: "platelets", label: "Platelets" },
  { value: "plasma", label: "Plasma" },
];

export const componentLabel = (value) =>
  COMPONENTS.find((c) => c.value === value)?.label || value;

export const STATUSES = [
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "expired", label: "Expired" },
  { value: "used", label: "Used up" },
];

export const statusLabel = (value) => STATUSES.find((s) => s.value === value)?.label || value;