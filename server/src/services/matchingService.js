// server/src/services/matchingService.js
//
// Finds donors for a blood request and notifies them.
//
// Hard filters (a donor is never shown or notified unless ALL are true):
//   - compatible blood group for the requested component
//   - available, with an active account
//   - eligible to donate now (not donated within DONATION_GAP_DAYS)
//   - not the person who made the request
//   - same district (unless includeOtherDistricts is set)
//
// Notifying is safe to repeat: a donor can be added to a request only once
// (atomic $ne guard), a request can shortlist at most 20 donors, and a donor
// is never notified twice within the cooldown window (default 24 hours).

import DonorProfile from "../models/DonorProfile.js";
import BloodRequest from "../models/BloodRequest.js";
import Notification from "../models/Notification.js";
import { compatibleDonorGroups } from "../utils/compatibility.js";
import { eligibleCutoff } from "../utils/eligibility.js";
import { rankDonors } from "./matchScoring.js";

export const MAX_NOTIFIED_PER_REQUEST = 20;
const ACTIVE = ["open", "in_progress"];
const cooldownMs = () => (Number(process.env.MATCH_COOLDOWN_HOURS) || 24) * 60 * 60 * 1000;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exactCI = (s) => new RegExp(`^${escapeRegex(String(s).trim())}$`, "i");

const COMPONENT_LABEL = {
  whole_blood: "whole blood",
  red_cells: "red cells",
  platelets: "platelets",
  plasma: "plasma",
};

const formatWhen = (date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }).format(new Date(date));

// Returns ranked [{ donor, score, reasons, distanceKm }]
export const findMatches = async (request, { limit = 10, includeOtherDistricts = false } = {}) => {
  const groups = compatibleDonorGroups(request.bloodGroup, request.component);
  if (!groups.length) return [];

  const filter = {
    bloodGroup: { $in: groups },
    isAvailable: true,
    user: { $ne: request.requester },
    $or: [{ lastDonationDate: null }, { lastDonationDate: { $lte: eligibleCutoff() } }],
  };
  if (!includeOtherDistricts) filter.district = exactCI(request.district);

  const candidates = await DonorProfile.find(filter)
    .populate("user", "name phone avatar isActive")
    .limit(500)
    .lean();

  const usable = candidates.filter((d) => d.user && d.user.isActive);
  const plain = typeof request.toObject === "function" ? request.toObject() : request;
  return rankDonors(plain, usable).slice(0, limit);
};

export const notifyDonors = async (request, { limit = 10, includeOtherDistricts = false } = {}) => {
  const ranked = await findMatches(request, { limit: 100, includeOtherDistricts });

  const already = new Set(request.matchedDonors.map((m) => String(m.donor)));
  const fresh = ranked.filter((m) => !already.has(String(m.donor._id)));

  const recentlyNotified = new Set(
    (
      await Notification.distinct("user", {
        user: { $in: fresh.map((m) => m.donor.user._id) },
        type: "donor_match",
        createdAt: { $gte: new Date(Date.now() - cooldownMs()) },
      })
    ).map(String)
  );
  const eligible = fresh.filter((m) => !recentlyNotified.has(String(m.donor.user._id)));

  const room = Math.max(MAX_NOTIFIED_PER_REQUEST - already.size, 0);
  const picks = eligible.slice(0, Math.min(limit, room));

  const notified = [];
  for (const m of picks) {
    // Atomic: only adds the donor if they are not already on the request and the cap is not reached
    const res = await BloodRequest.updateOne(
      {
        _id: request._id,
        status: { $in: ACTIVE },
        "matchedDonors.donor": { $ne: m.donor._id },
        $expr: { $lt: [{ $size: { $ifNull: ["$matchedDonors", []] } }, MAX_NOTIFIED_PER_REQUEST] },
      },
      { $push: { matchedDonors: { donor: m.donor._id, matchScore: m.score, response: "pending", notifiedAt: new Date() } } }
    );
    if (res.modifiedCount !== 1) continue;

    // Deliberately no patient name or phone number in the notification
    await Notification.create({
      user: m.donor.user._id,
      type: "donor_match",
      title: `Blood needed: ${request.bloodGroup} in ${request.district}`,
      message:
        `${request.unitsNeeded} unit(s) of ${COMPONENT_LABEL[request.component] || "blood"} needed at ` +
        `${request.hospital} by ${formatWhen(request.neededBy)}. Open the request to respond.`,
      relatedRequest: request._id,
    });
    notified.push(m);
  }

  const total = already.size + notified.length;
  return {
    notified: notified.map((m) => ({ donorId: m.donor._id, name: m.donor.user.name, score: m.score })),
    skipped: {
      alreadyNotified: ranked.length - fresh.length,
      cooldown: fresh.length - eligible.length,
    },
    totalNotified: total,
    capReached: total >= MAX_NOTIFIED_PER_REQUEST,
  };
};