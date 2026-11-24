// Accepts 01XXXXXXXXX, +8801XXXXXXXXX, 8801XXXXXXXXX (the backend double-checks)
export const PHONE_RE = /^(?:\+?88)?01\d{9}$/;

export const cleanPhone = (value) => value.replace(/[\s-]/g, "");

// wa.me needs the country code with no "+" or leading 0: 01711111111 -> 8801711111111
export function toWhatsAppNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0")) return `88${digits}`;
  return `880${digits}`;
}