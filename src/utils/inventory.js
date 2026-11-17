const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const tomorrowInput = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return fmt(d);
};

// Admins can manage every bank; staff manage their own. The server enforces this too.
// If the logged-in user object carries no bank id, staff are shown the button everywhere
// and the server rejects the wrong ones with a 403.
export function canManageBank(user, bankId) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "bank_staff") return false;
  const mine = user.bloodBank?.id || user.bloodBank?._id || user.bloodBank;
  return !mine || String(mine) === String(bankId);
}

export function normalizeBatch(raw) {
  return {
    id: raw.id || raw._id,
    bloodGroup: raw.bloodGroup || "",
    component: raw.component || "whole_blood",
    units: raw.units ?? 0,
    collectedAt: raw.collectedAt || "",
    expiresAt: raw.expiresAt || "",
    status: raw.status || "available",
    daysLeft: raw.daysLeft ?? null,
  };
}

// Text and colour for the "Expires" column
export function expiryInfo(b) {
  if (b.status === "used") return { text: "", tone: "text-gray-400" };
  if (b.status === "expired") return { text: "Expired", tone: "text-gray-400" };
  if (b.daysLeft === null) return { text: "", tone: "text-gray-500" };
  if (b.daysLeft <= 0) return { text: "Past expiry", tone: "text-red-600" };
  const text = b.daysLeft === 1 ? "1 day left" : `${b.daysLeft} days left`;
  if (b.daysLeft <= 3) return { text, tone: "text-red-600" };
  if (b.daysLeft <= 7) return { text, tone: "text-amber-600" };
  return { text, tone: "text-gray-500" };
}