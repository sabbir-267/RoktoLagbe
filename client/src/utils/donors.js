import { divisionOfDistrict } from "../data/bangladesh";

const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayInput = () => fmt(new Date());

// "2000-05-12T00:00:00.000Z" -> "2000-05-12" (what <input type="date"> needs)
export const toDateInput = (v) => (v ? String(v).slice(0, 10) : "");

// "2026-03-02T..." -> "2 Mar 2026"
export function formatDate(v) {
  if (!v) return "";
  return new Date(v).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Allowed date-of-birth range for ages 18 to 65
export function dobLimits() {
  const now = new Date();
  const max = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
  const min = new Date(now.getFullYear() - 66, now.getMonth(), now.getDate() + 1);
  return { min: fmt(min), max: fmt(max) };
}

// The backend wraps a single donor as { success, donor }
export function unwrapDonor(data) {
  const inner = data?.donor || data;
  if (!inner || !inner.bloodGroup) {
    console.warn("Unexpected donor response shape:", data);
    return null;
  }
  return inner;
}

// Maps the backend's donor object to one consistent shape for the UI
export function normalizeDonor(raw) {
  if (!raw) return null;
  return {
    id: raw.id || raw._id,
    name: raw.name || "Donor",
    avatar: raw.avatar || raw.user?.avatar || "",
    phone: raw.phone || "",
    bloodGroup: raw.bloodGroup || "",
    gender: raw.gender || "",
    weightKg: raw.weightKg ?? "",
    dateOfBirth: raw.dateOfBirth || "",
    division: raw.division || divisionOfDistrict(raw.district),
    district: raw.district || "",
    upazila: raw.upazila || "",
    area: raw.area || "",
    campus: raw.campus || "",
    group: raw.group || "",
    lastDonationDate: raw.lastDonationDate || "",
    nextEligibleDate: raw.nextEligibleDate || "",
    totalDonations: raw.totalDonations ?? 0,
    allowPhoneVisible: Boolean(raw.allowPhoneVisible),
    showOnLeaderboard: raw.showOnLeaderboard !== false,
    emailAlerts: raw.emailAlerts !== false,
    available: raw.isAvailable ?? true, // switch on AND eligible (worked out by the server)
    availabilityOn: raw.availabilityOn ?? raw.isAvailable ?? true, // the donor's own switch
    verified: Boolean(raw.isVerified),
    eligible: raw.isEligible ?? true,
  };
}