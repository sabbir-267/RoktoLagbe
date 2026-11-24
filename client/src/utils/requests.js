const pad = (n) => String(n).padStart(2, "0");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const COMPONENTS = [
  { value: "whole_blood", label: "Whole blood" },
  { value: "red_cells", label: "Red blood cells" },
  { value: "platelets", label: "Platelets" },
  { value: "plasma", label: "Plasma" },
];

export const COMPONENT_LABEL = Object.fromEntries(COMPONENTS.map((c) => [c.value, c.label]));

export const URGENCY = {
  critical: { label: "Critical", chip: "bg-red-100 text-red-700", bar: "bg-red-600" },
  high: { label: "High", chip: "bg-orange-100 text-orange-700", bar: "bg-orange-500" },
  medium: { label: "Medium", chip: "bg-amber-100 text-amber-700", bar: "bg-amber-400" },
  low: { label: "Low", chip: "bg-green-100 text-green-700", bar: "bg-green-500" },
};

export const STATUS = {
  open: { label: "Open", chip: "bg-green-50 text-green-700" },
  in_progress: { label: "In progress", chip: "bg-blue-50 text-brand-blue" },
  fulfilled: { label: "Fulfilled", chip: "bg-gray-100 text-gray-600" },
  cancelled: { label: "Cancelled", chip: "bg-gray-100 text-gray-500" },
  expired: { label: "Expired", chip: "bg-gray-100 text-gray-500" },
};

export const isActive = (status) => status === "open" || status === "in_progress";

export function normalizeRequest(raw) {
  if (!raw) return null;
  return {
    id: raw.id || raw._id,
    bloodGroup: raw.bloodGroup || "",
    component: raw.component || "whole_blood",
    unitsNeeded: raw.unitsNeeded ?? 1,
    fulfilledUnits: raw.fulfilledUnits ?? 0,
    hospital: raw.hospital || "",
    district: raw.district || "",
    neededBy: raw.neededBy || "",
    urgency: raw.urgency || "medium",
    status: raw.status || "open",
    createdAt: raw.createdAt || "",
    notes: raw.notes || "",
    contactPhone: raw.contactPhone || "",
    patientName: raw.patientName || "",
    isMine: Boolean(raw.isMine),
    myResponse: raw.myResponse || "",
  };
}

// "24 Nov 2026, 10:30 am"
export function formatDateTime(v) {
  if (!v) return "";
  return new Date(v).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// "in 5 hours", "in 2 days", "1 hour overdue"
export function timeLeft(v, now = Date.now()) {
  if (!v) return "";
  const diff = new Date(v).getTime() - now;
  const abs = Math.abs(diff);
  let text;
  if (abs < HOUR) {
    const m = Math.max(Math.round(abs / 60000), 1);
    text = `${m} min`;
  } else if (abs < DAY) {
    const h = Math.round(abs / HOUR);
    text = `${h} hour${h === 1 ? "" : "s"}`;
  } else {
    const d = Math.round(abs / DAY);
    text = `${d} day${d === 1 ? "" : "s"}`;
  }
  return diff >= 0 ? `in ${text}` : `${text} overdue`;
}

// <input type="datetime-local"> wants "2026-11-24T10:30" in the person's own time zone
export function toDateTimeLocal(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// The backend accepts a deadline from now up to 60 days ahead
export function neededByLimits(now = Date.now()) {
  return {
    min: toDateTimeLocal(new Date(now)),
    max: toDateTimeLocal(new Date(now + 60 * DAY)),
  };
}

export const localToISO = (local) => new Date(local).toISOString();
