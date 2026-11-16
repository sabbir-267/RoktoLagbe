const DAY = 24 * 60 * 60 * 1000;
const gapDays = () => Number(process.env.DONATION_GAP_DAYS) || 120;

export const nextEligibleDate = (last) =>
  last ? new Date(new Date(last).getTime() + gapDays() * DAY) : null;

export const isEligibleNow = (last) => !last || nextEligibleDate(last) <= new Date();

// donors with lastDonationDate <= this are eligible
export const eligibleCutoff = () => new Date(Date.now() - gapDays() * DAY);

export const ageFromDob = (dob) => {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
};