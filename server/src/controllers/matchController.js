// server/src/controllers/matchController.js
import BloodRequest from "../models/BloodRequest.js";
import DonorProfile from "../models/DonorProfile.js";
import Notification from "../models/Notification.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { compatibleDonorGroups } from "../utils/compatibility.js";
import { findMatches, notifyDonors } from "../services/matchingService.js";

const ACTIVE = ["open", "in_progress"];
const NOTE =
  "Compatibility is a guide only. The hospital must confirm the blood type and do cross-matching before any transfusion.";

const clamp = (value, min, max, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
};

// Only the requester, bank staff, or an admin may manage matching for a request
const loadManageable = async (req) => {
  const r = await BloodRequest.findById(req.params.id);
  if (!r) throw new ApiError(404, "Request not found");
  const owner = String(r.requester) === String(req.user._id);
  if (!owner && !["admin", "bank_staff"].includes(req.user.role)) {
    throw new ApiError(403, "Only the requester, a bank staff member, or an admin can do this");
  }
  return r;
};

const requireActive = (r) => {
  if (!ACTIVE.includes(r.status)) throw new ApiError(409, "Only open requests can be matched");
};

const toMatchDto = ({ donor, score, reasons, distanceKm }, entries) => {
  const entry = entries.get(String(donor._id));
  return {
    donorId: donor._id,
    name: donor.user?.name,
    avatar: donor.user?.avatar,
    bloodGroup: donor.bloodGroup,
    district: donor.district,
    upazila: donor.upazila,
    campus: donor.campus,
    group: donor.group,
    isVerified: donor.isVerified,
    totalDonations: donor.totalDonations,
    score,
    reasons,
    distanceKm,
    // A donor's phone is shown only if they chose to make it visible
    phone: donor.allowPhoneVisible ? donor.user?.phone : undefined,
    notified: !!entry,
    response: entry?.response,
  };
};

export const getMatches = asyncHandler(async (req, res) => {
  const r = await loadManageable(req);
  requireActive(r);

  const limit = clamp(req.query.limit, 1, 20, 10);
  const includeOtherDistricts = req.query.includeOtherDistricts === "true";
  const ranked = await findMatches(r, { limit, includeOtherDistricts });
  const entries = new Map(r.matchedDonors.map((m) => [String(m.donor), m]));

  res.json({
    success: true,
    request: { id: r._id, bloodGroup: r.bloodGroup, component: r.component, district: r.district },
    compatibleGroups: compatibleDonorGroups(r.bloodGroup, r.component),
    count: ranked.length,
    matches: ranked.map((m) => toMatchDto(m, entries)),
    note: NOTE,
  });
});

export const notifyMatches = asyncHandler(async (req, res) => {
  const r = await loadManageable(req);
  requireActive(r);

  const limit = clamp(req.body.limit, 1, 10, 10);
  const includeOtherDistricts = req.body.includeOtherDistricts === true || req.body.includeOtherDistricts === "true";
  const result = await notifyDonors(r, { limit, includeOtherDistricts });
  res.json({ success: true, ...result });
});

// A notified donor accepts or declines. Accepting is consent to share their phone
// with the requester of THIS request (shown only through getResponses).
export const respondToRequest = asyncHandler(async (req, res) => {
  const { response } = req.body;

  const donor = await DonorProfile.findOne({ user: req.user._id });
  if (!donor) throw new ApiError(403, "Create a donor profile first");

  const r = await BloodRequest.findById(req.params.id);
  if (!r) throw new ApiError(404, "Request not found");

  const entry = r.matchedDonors.find((m) => String(m.donor) === String(donor._id));
  if (!entry) throw new ApiError(403, "You were not matched to this request");
  if (!ACTIVE.includes(r.status)) throw new ApiError(409, "This request is closed");
  if (entry.response !== "pending") throw new ApiError(409, "You have already responded to this request");

  // Atomic: only a still-pending response on a still-open request can be changed
  const updated = await BloodRequest.updateOne(
    {
      _id: r._id,
      status: { $in: ACTIVE },
      matchedDonors: { $elemMatch: { donor: donor._id, response: "pending" } },
    },
    { $set: { "matchedDonors.$.response": response } }
  );
  if (updated.modifiedCount !== 1) {
    throw new ApiError(409, "Could not record your response. Refresh and try again.");
  }

  await Notification.updateMany(
    { user: req.user._id, relatedRequest: r._id, type: "donor_match" },
    { $set: { isRead: true } }
  );

  if (response === "accepted") {
    await Notification.create({
      user: r.requester,
      type: "request_update",
      title: "A donor accepted your request",
      message: `A matched donor can help with your ${r.bloodGroup} request at ${r.hospital}. Open your request to see their contact details.`,
      relatedRequest: r._id,
    });
  }

  res.json({ success: true, response });
});

export const getResponses = asyncHandler(async (req, res) => {
  const r = await loadManageable(req);

  const ids = r.matchedDonors.map((m) => m.donor);
  const profiles = await DonorProfile.find({ _id: { $in: ids } }).populate("user", "name phone avatar").lean();
  const byId = new Map(profiles.map((p) => [String(p._id), p]));

  const counts = { notified: r.matchedDonors.length, pending: 0, accepted: 0, declined: 0 };
  const accepted = [];
  for (const m of r.matchedDonors) {
    counts[m.response] += 1;
    if (m.response !== "accepted") continue;
    const p = byId.get(String(m.donor));
    if (!p) continue;
    accepted.push({
      donorId: p._id,
      name: p.user?.name,
      avatar: p.user?.avatar,
      bloodGroup: p.bloodGroup,
      district: p.district,
      upazila: p.upazila,
      isVerified: p.isVerified,
      phone: p.user?.phone, // shared because the donor accepted this request
    });
  }

  res.json({ success: true, requestId: r._id, status: r.status, counts, accepted });
});