// server/src/chatbot/actions.js
//
// Live-data "skills" the assistant can use. Both the offline assistant and the
// Claude-powered one call these, so answers about donors, stock and requests always
// come from the real database. They return plain data, never private details:
// no donor names or phone numbers, only counts and public bank/request info.

import DonorProfile from "../models/DonorProfile.js";
import BloodBank from "../models/BloodBank.js";
import BloodRequest from "../models/BloodRequest.js";
import InventoryBatch from "../models/InventoryBatch.js";
import { BLOOD_GROUPS, normalizeBloodGroup } from "../utils/bloodGroup.js";
import { compatibleDonorGroups } from "../utils/compatibility.js";
import { eligibleCutoff, isEligibleNow, nextEligibleDate } from "../utils/eligibility.js";
import { canonicalDistrict } from "../utils/districts.js";

const cleanGroup = (g) => {
  const v = normalizeBloodGroup(g ?? "");
  return BLOOD_GROUPS.includes(v) ? v : null;
};
const cleanDistrict = (d) => (d ? canonicalDistrict(d) || null : null);
const exactCI = (s) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");

const eligibleAvailable = () => ({
  isAvailable: true,
  $or: [{ lastDonationDate: null }, { lastDonationDate: { $lte: eligibleCutoff() } }],
});

const donorLink = (group, district) => {
  const q = new URLSearchParams();
  if (group) q.set("bloodGroup", group);
  if (district) q.set("district", district);
  return `/donors${q.toString() ? `?${q}` : ""}`;
};

// How many donors are available right now for a blood group (and optionally a district)
export const findDonors = async ({ bloodGroup, district } = {}) => {
  const group = cleanGroup(bloodGroup);
  if (!group) return { error: "missing_blood_group" };
  const place = cleanDistrict(district);
  const where = place ? { district: exactCI(place) } : {};
  const compatible = compatibleDonorGroups(group).filter((g) => g !== group);

  const [exact, compatibleCount] = await Promise.all([
    DonorProfile.countDocuments({ ...where, ...eligibleAvailable(), bloodGroup: group }),
    compatible.length
      ? DonorProfile.countDocuments({ ...where, ...eligibleAvailable(), bloodGroup: { $in: compatible } })
      : 0,
  ]);
  return {
    bloodGroup: group,
    district: place,
    availableExact: exact,
    availableCompatible: compatibleCount,
    compatibleGroups: compatible,
    link: donorLink(group, place),
  };
};

// Approved blood banks that currently hold usable units of a group
export const bankStock = async ({ bloodGroup, district } = {}) => {
  const group = cleanGroup(bloodGroup);
  if (!group) return { error: "missing_blood_group" };
  const place = cleanDistrict(district);

  const rows = await InventoryBatch.aggregate([
    { $match: { bloodGroup: group, status: "available", units: { $gt: 0 }, expiresAt: { $gt: new Date() } } },
    { $group: { _id: "$bloodBank", units: { $sum: "$units" } } },
    { $lookup: { from: "bloodbanks", localField: "_id", foreignField: "_id", as: "b" } },
    { $unwind: "$b" },
    { $match: { "b.isApproved": true, ...(place ? { "b.district": exactCI(place) } : {}) } },
    { $sort: { units: -1 } },
    { $limit: 5 },
  ]);
  return {
    bloodGroup: group,
    district: place,
    banks: rows.map((r) => ({
      name: r.b.name,
      district: r.b.district,
      phone: r.b.phone,
      is24Hours: !!r.b.is24Hours,
      units: r.units,
      link: `/blood-banks/${r._id}`,
    })),
    link: `/blood-banks?hasBloodGroup=${encodeURIComponent(group)}${place ? `&district=${encodeURIComponent(place)}` : ""}`,
  };
};

// Open blood requests, most urgent first
export const openRequests = async ({ bloodGroup, district } = {}) => {
  const group = cleanGroup(bloodGroup);
  const place = cleanDistrict(district);
  const filter = { status: { $in: ["open", "in_progress"] }, neededBy: { $gt: new Date(Date.now() - 6 * 3600e3) } };
  if (group) filter.bloodGroup = group;
  if (place) filter.district = exactCI(place);

  const [total, rows] = await Promise.all([
    BloodRequest.countDocuments(filter),
    BloodRequest.find(filter).sort({ neededBy: 1 }).limit(3).select("bloodGroup hospital district unitsNeeded neededBy urgency"),
  ]);
  const q = new URLSearchParams();
  if (group) q.set("bloodGroup", group);
  if (place) q.set("district", place);
  return {
    bloodGroup: group,
    district: place,
    total,
    requests: rows.map((r) => ({
      bloodGroup: r.bloodGroup,
      hospital: r.hospital,
      district: r.district,
      unitsNeeded: r.unitsNeeded,
      neededBy: r.neededBy,
      urgency: r.urgency,
      link: `/requests/${r._id}`,
    })),
    link: `/requests${q.toString() ? `?${q}` : ""}`,
  };
};

// The logged-in person's own donor status
export const myEligibility = async ({ user } = {}) => {
  if (!user) return { loggedIn: false };
  const p = await DonorProfile.findOne({ user: user._id }).select("bloodGroup lastDonationDate totalDonations isAvailable");
  if (!p) return { loggedIn: true, hasProfile: false };
  return {
    loggedIn: true,
    hasProfile: true,
    bloodGroup: p.bloodGroup,
    lastDonationDate: p.lastDonationDate || null,
    eligibleNow: isEligibleNow(p.lastDonationDate),
    nextEligibleDate: nextEligibleDate(p.lastDonationDate),
    totalDonations: p.totalDonations || 0,
    availabilitySwitchOn: p.isAvailable !== false,
  };
};

// Red-cell compatibility for one group, both directions
export const compatibility = async ({ bloodGroup } = {}) => {
  const group = cleanGroup(bloodGroup);
  if (!group) return { error: "missing_blood_group" };
  return {
    bloodGroup: group,
    canReceiveFrom: compatibleDonorGroups(group),
    canGiveTo: BLOOD_GROUPS.filter((r) => compatibleDonorGroups(r).includes(group)),
    note: "Red cells / whole blood. Platelets and plasma follow different rules; the hospital always cross-matches.",
  };
};

export const ACTIONS = { find_donors: findDonors, bank_stock: bankStock, open_requests: openRequests, my_eligibility: myEligibility, compatibility };
