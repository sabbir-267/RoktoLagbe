// server/src/services/donationHistory.js
//
// One donor's donation history, from three sources (models/Donation.js `source`):
//   bank    – recorded by verified blood bank staff (donationController.recordDonation)
//   request – confirmed by the requester the donor gave blood to (requestDonationController)
//   self    – the donor typed a "last donation date" on their profile
// Every source moves DonorProfile.lastDonationDate forward, which is what resets eligibility.

import Donation from "../models/Donation.js";

const DAY = 24 * 60 * 60 * 1000;
// Records this close together are treated as the same donation (e.g. a bank recorded it AND
// the requester confirmed it), so nothing is counted twice.
export const SAME_DONATION_MS = 3 * DAY;

export const findSameDonation = (donorId, date) =>
  Donation.findOne({
    donor: donorId,
    status: { $ne: "rejected" },
    donatedAt: { $gte: new Date(date.getTime() - SAME_DONATION_MS), $lte: new Date(date.getTime() + SAME_DONATION_MS) },
  });

// The donor changed their own "last donation date": keep a self-reported entry for it unless a
// record for that donation already exists. Self-reported entries don't add to totalDonations.
export const recordSelfReported = async (profile, date) => {
  if (!date || Number.isNaN(date.getTime())) return;
  if (await findSameDonation(profile._id, date)) return;
  await Donation.create({
    donor: profile._id,
    donatedAt: date,
    source: "self",
    status: "self_reported",
    countedInTotal: false,
  });
};

// Before a new donation moves lastDonationDate forward, keep the old date in the history if
// nothing records it yet (profiles saved before history existed), so it isn't lost.
// newDate: the donation being recorded; an old date within a few days of it is the same donation.
export const preserveOldDate = async (donorId, oldDate, newDate) => {
  if (!oldDate) return;
  if (newDate && Math.abs(new Date(oldDate) - new Date(newDate)) <= SAME_DONATION_MS) return;
  await recordSelfReported({ _id: donorId }, new Date(oldDate)).catch((err) =>
    console.error("Could not keep the previous donation date:", err.message)
  );
};

const toDto = (d) => ({
  id: d._id,
  source: d.source || "bank",
  status: d.status,
  donatedAt: d.donatedAt,
  units: d.units,
  bankName: d.bloodBank?.name || null,
  bankDistrict: d.bloodBank?.district || null,
  hospital: d.request?.hospital || null,
  district: d.request?.district || d.bloodBank?.district || null,
  requestId: d.request?._id || null,
});

// Newest first. A lastDonationDate saved before history existed (no record near it) is shown
// as a self-reported entry so the history never contradicts the profile.
export const historyFor = async (profile, { limit = 100 } = {}) => {
  const rows = await Donation.find({ donor: profile._id, status: { $ne: "rejected" } })
    .sort({ donatedAt: -1, _id: -1 })
    .limit(limit)
    .populate("bloodBank", "name district")
    .populate("request", "hospital district")
    .lean();

  const donations = rows.map(toDto);
  const last = profile.lastDonationDate ? new Date(profile.lastDonationDate) : null;
  if (last && !rows.some((d) => Math.abs(new Date(d.donatedAt) - last) <= SAME_DONATION_MS)) {
    donations.push({
      id: `profile-${profile._id}`,
      source: "self",
      status: "self_reported",
      donatedAt: last,
      units: 1,
      bankName: null,
      bankDistrict: null,
      hospital: null,
      district: null,
      requestId: null,
    });
    donations.sort((a, b) => new Date(b.donatedAt) - new Date(a.donatedAt));
  }
  return donations;
};
