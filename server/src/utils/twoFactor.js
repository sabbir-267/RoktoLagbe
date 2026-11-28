// utils/twoFactor.js
// Which accounts must use two-step verification (an authenticator-app code after the password).
// Default: admins, doctors and blood bank staff. Override with TWO_FACTOR_ROLES=admin,doctor,bank_staff
// (set it to "none" to switch two-step verification off, e.g. for local testing).
const DEFAULT_ROLES = ["admin", "doctor", "bank_staff"];

export const twoFactorRoles = () => {
  const raw = (process.env.TWO_FACTOR_ROLES || "").trim();
  if (!raw) return DEFAULT_ROLES;
  if (raw.toLowerCase() === "none") return [];
  return raw.split(",").map((r) => r.trim()).filter(Boolean);
};

export const requiresTwoFactor = (user) => !!user && twoFactorRoles().includes(user.role);
