// server/src/controllers/requestDonationController.js
//
// The requester confirms that a donor who said yes actually gave blood. That:
//   - adds a "request" entry to the donor's donation history
//   - resets the donor's last donation date (so they become "not eligible" for the gap period)
//   - adds 1 to their total donations and notifies them
// If a blood bank already recorded the same donation (within 3 days), that record is linked
// instead, so nothing is counted twice. The requester can undo a confirmation for 48 hours.

import BloodRequest from "../models/BloodRequest.js";
import Donation from "../models/Donation.js";
import DonorProfile from "../models/DonorProfile.js";
import Notification from "../models/Notification.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { nextEligibleDate } from "../utils/eligibility.js";
import { emitToUser } from "../services/socket.js";
import { findSameDonation, preserveOldDate } from "../services/donationHistory.js";

const UNDO_MS = 48 * 60 * 60 * 1000;
const CONFIRMABLE = ["open", "in_progress", "fulfilled"];
const fmtDate = (d) => new Date(d).toISOString().slice(0, 10);

const loadForRequester = async (req) => {
  const r = await BloodRequest.findById(req.params.id);
  if (!r) throw new ApiError(404, "Request not found");
  const owner = String(r.requester) === String(req.user._id);
  if (!owner && req.user.role !== "admin") {
    throw new ApiError(403, "Only the person who posted this request can confirm donations");
  }
  const entry = r.matchedDonors.find((m) => String(m.donor) === String(req.params.donorId));
  if (!entry || entry.response !== "accepted") {
    throw new ApiError(404, "This donor did not accept this request");
  }
  return { r, entry };
};

const notifyDonor = async (profile, r, title, message) => {
  try {
    const n = await Notification.create({ user: profile.user, type: "request_update", title, message, relatedRequest: r._id });
    emitToUser(profile.user, "notification:new", { type: "request_update", relatedRequest: r._id, notificationId: n._id });
  } catch (err) {
    console.error("Donation notification failed:", err.message);
  }
};

// Records that donor `donorId` gave blood for request `r` (shared by the confirm button and by
// marking a request fulfilled): history entry, last donation date reset, +1 total, notification.
export const recordRequestDonation = async (r, donorId, donatedAt, actorId) => {
  const profile = await DonorProfile.findById(donorId).select("user lastDonationDate totalDonations");
  if (!profile) throw new ApiError(404, "This donor's profile no longer exists");

  // Reuse a record of the same donation (bank-recorded or self-reported) instead of adding another
  const same = await findSameDonation(profile._id, donatedAt);
  if (!same && profile.lastDonationDate) await preserveOldDate(profile._id, profile.lastDonationDate, donatedAt);
  let donation;
  let created = false;
  let counts = false; // does this confirmation add 1 to totalDonations?
  if (same && same.source === "bank") {
    if (same.request && String(same.request) !== String(r._id)) {
      throw new ApiError(409, "That donation is already linked to another request");
    }
    same.request = r._id;
    donation = await same.save();
  } else if (same && same.source === "request") {
    throw new ApiError(409, `This donor already has a confirmed donation on ${fmtDate(same.donatedAt)}`);
  } else if (same) {
    // self-reported: upgrade it to a confirmed donation
    counts = !same.countedInTotal;
    Object.assign(same, {
      source: "request",
      status: "verified",
      request: r._id,
      verifiedBy: actorId,
      donatedAt,
      countedInTotal: true,
      previousLastDonation: profile.lastDonationDate,
    });
    donation = await same.save();
  } else {
    counts = true;
    created = true;
    donation = await Donation.create({
      donor: profile._id,
      request: r._id,
      donatedAt,
      units: 1,
      source: "request",
      status: "verified",
      verifiedBy: actorId,
      previousLastDonation: profile.lastDonationDate,
      countedInTotal: true,
    });
  }

  // Claim the slot atomically so a double click can't confirm twice
  const claimed = await BloodRequest.updateOne(
    { _id: r._id, matchedDonors: { $elemMatch: { donor: profile._id, response: "accepted", donation: { $exists: false } } } },
    { $set: { "matchedDonors.$.donation": donation._id } }
  );
  if (!claimed.modifiedCount) {
    if (created) await Donation.deleteOne({ _id: donation._id });
    throw new ApiError(409, "This donation is already confirmed");
  }

  const update = { $max: { lastDonationDate: donatedAt } };
  if (counts) update.$inc = { totalDonations: 1 };
  const fresh = await DonorProfile.findByIdAndUpdate(profile._id, update, { new: true }).select("lastDonationDate totalDonations user");

  const next = nextEligibleDate(fresh.lastDonationDate);
  await notifyDonor(
    fresh,
    r,
    "Donation confirmed – thank you!",
    `Your ${r.bloodGroup} donation at ${r.hospital} on ${fmtDate(donatedAt)} was confirmed and added to your donation history and the leaderboard. ` +
      `You can donate again from ${fmtDate(next)}.`
  );

  return { donation, fresh, next };
};

// POST /api/requests/:id/donations/:donorId   Body: { donatedAt? }  (defaults to now)
export const confirmDonation = asyncHandler(async (req, res) => {
  const { r, entry } = await loadForRequester(req);
  if (!CONFIRMABLE.includes(r.status)) {
    throw new ApiError(409, "Donations can only be confirmed on open, in-progress or fulfilled requests");
  }
  if (entry.donation) throw new ApiError(409, "This donation is already confirmed");

  const donatedAt = req.body.donatedAt ? new Date(req.body.donatedAt) : new Date();
  if (donatedAt > new Date()) throw new ApiError(400, "Donation date cannot be in the future");
  const earliest = new Date(new Date(r.createdAt).getTime() - 24 * 60 * 60 * 1000);
  if (donatedAt < earliest) throw new ApiError(400, "Donation date cannot be before the request was posted");

  const { donation, fresh, next } = await recordRequestDonation(r, entry.donor, donatedAt, req.user._id);

  res.status(201).json({
    success: true,
    donation: { id: donation._id, donatedAt: donation.donatedAt, source: donation.source },
    donor: { lastDonationDate: fresh.lastDonationDate, nextEligibleDate: next, totalDonations: fresh.totalDonations },
  });
});

// DELETE /api/requests/:id/donations/:donorId   Undo a mistaken confirmation (within 48 hours)
export const undoDonation = asyncHandler(async (req, res) => {
  const { r, entry } = await loadForRequester(req);
  if (!entry.donation) throw new ApiError(404, "No confirmed donation to undo");

  const donation = await Donation.findById(entry.donation).select("+previousLastDonation");
  if (donation && donation.source === "request") {
    if (Date.now() - new Date(donation.updatedAt).getTime() > UNDO_MS) {
      throw new ApiError(409, "A confirmation can only be undone within 48 hours. Contact an admin.");
    }
  }

  const released = await BloodRequest.updateOne(
    { _id: r._id, matchedDonors: { $elemMatch: { donor: entry.donor, donation: entry.donation } } },
    { $unset: { "matchedDonors.$.donation": 1 } }
  );
  if (!released.modifiedCount) throw new ApiError(409, "This request was just changed. Refresh and try again.");

  if (donation?.source === "request") {
    const profile = await DonorProfile.findById(entry.donor).select("lastDonationDate");
    await Donation.deleteOne({ _id: donation._id });
    if (profile) {
      const update = { $inc: { totalDonations: -1 } };
      // Put the previous date back only if this donation is what set the current one
      if (profile.lastDonationDate && +profile.lastDonationDate === +donation.donatedAt) {
        if (donation.previousLastDonation) update.$set = { lastDonationDate: donation.previousLastDonation };
        else update.$unset = { lastDonationDate: 1 };
      }
      await DonorProfile.updateOne({ _id: profile._id, totalDonations: { $gt: 0 } }, { $inc: update.$inc });
      const rest = { ...update };
      delete rest.$inc;
      if (Object.keys(rest).length) await DonorProfile.updateOne({ _id: profile._id }, rest);
    }
  } else if (donation) {
    // A bank record stays (the bank witnessed it); only the link to this request is removed
    donation.request = undefined;
    await donation.save();
  }

  res.json({ success: true });
});
