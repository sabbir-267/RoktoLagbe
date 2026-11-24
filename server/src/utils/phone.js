// Converts +8801712345678 / 8801712345678 / 01712345678 → 01712345678
export const normalizePhone = (input = "") => {
  const cleaned = String(input).replace(/[\s-]/g, "");
  if (cleaned.startsWith("+880")) return "0" + cleaned.slice(4);
  if (cleaned.startsWith("880")) return "0" + cleaned.slice(3);
  return cleaned;
};