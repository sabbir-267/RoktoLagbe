const HOUR = 60 * 60 * 1000;

export const urgencyFromNeededBy = (neededBy, now = Date.now()) => {
  const hours = (new Date(neededBy).getTime() - now) / HOUR;
  if (hours <= 6) return "critical";
  if (hours <= 24) return "high";
  if (hours <= 72) return "medium";
  return "low";
};