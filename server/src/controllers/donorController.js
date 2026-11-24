import DonorProfile from "../models/DonorProfile.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { normalizeBloodGroup } from "../utils/bloodGroup.js";
import { isEligibleNow, nextEligibleDate, eligibleCutoff } from "../utils/eligibility.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exactCI = (s) => new RegExp(`^${escapeRegex(s.trim())}$`, "i");

// Single place that decides what the outside world may see
const toDonorDto = (d, viewer) => {
  const isOwner = !!viewer && !!d.user?._id && d.user._id.equals(viewer._id);
  const showPhone = !!viewer && (d.allowPhoneVisible || isOwner);
  const eligible = isEligibleNow(d.lastDonationDate);
  return {
    id: d._id,
    name: d.user?.name,
    avatar: d.user?.avatar,
    bloodGroup: d.bloodGroup,
    gender: d.gender,
    division: d.division,
    district: d.district,
    upazila: d.upazila,
    area: d.area,
    campus: d.campus,
    group: d.group,
    // A donor only counts as available while they are also eligible to donate
    isAvailable: d.isAvailable && eligible,
    availabilityOn: isOwner ? d.isAvailable : undefined, // the donor's own switch
    isVerified: d.isVerified,
    totalDonations: d.totalDonations,
    lastDonationDate: d.lastDonationDate,
    isEligible: eligible,
    nextEligibleDate: nextEligibleDate(d.lastDonationDate),
    allowPhoneVisible: isOwner ? d.allowPhoneVisible : undefined,
    showOnLeaderboard: isOwner ? d.showOnLeaderboard !== false : undefined,
    phone: showPhone ? d.user?.phone : undefined,
    dateOfBirth: isOwner ? d.dateOfBirth : undefined,
    weightKg: isOwner ? d.weightKg : undefined,
  };
};

const USER_FIELDS = "name phone avatar";
const SETTABLE = [
  "gender", "weightKg", "dateOfBirth", "lastDonationDate", "allowPhoneVisible", "showOnLeaderboard",
  "division", "district", "upazila", "area", "campus", "group",
];

export const upsertMyProfile = asyncHandler(async (req, res) => {
  const bloodGroup = normalizeBloodGroup(req.body.bloodGroup);
  const { latitude, longitude } = req.body;
  if ((latitude === undefined) !== (longitude === undefined)) {
    throw new ApiError(400, "Provide both latitude and longitude, or neither");
  }

  let profile = await DonorProfile.findOne({ user: req.user._id });
  const isNew = !profile;

  if (isNew) {
    profile = new DonorProfile({ user: req.user._id, bloodGroup });
  } else if (profile.bloodGroup !== bloodGroup) {
    throw new ApiError(400, "Blood group cannot be changed after the profile is created");
  }

  for (const key of SETTABLE) {
    if (req.body[key] !== undefined) profile.set(key, req.body[key]);
  }
  if (latitude !== undefined) {
    profile.location = { type: "Point", coordinates: [Number(longitude), Number(latitude)] };
  }

  await profile.save();
  await profile.populate("user", USER_FIELDS);
  res.status(isNew ? 201 : 200).json({ success: true, donor: toDonorDto(profile, req.user) });
});

export const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await DonorProfile.findOne({ user: req.user._id }).populate("user", USER_FIELDS);
  if (!profile) throw new ApiError(404, "You have not created a donor profile yet");
  res.json({ success: true, donor: toDonorDto(profile, req.user) });
});

export const setAvailability = asyncHandler(async (req, res) => {
  const profile = await DonorProfile.findOne({ user: req.user._id }).populate("user", USER_FIELDS);
  if (!profile) throw new ApiError(404, "You have not created a donor profile yet");
  profile.isAvailable = req.body.isAvailable === true || req.body.isAvailable === "true";
  await profile.save();
  res.json({ success: true, donor: toDonorDto(profile, req.user) });
});

export const searchDonors = asyncHandler(async (req, res) => {
  const { bloodGroup, district, upazila, campus, group, available, eligibleOnly } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);

  const filter = {};
  if (bloodGroup) filter.bloodGroup = normalizeBloodGroup(bloodGroup);
  if (district) filter.district = exactCI(district);
  if (upazila) filter.upazila = exactCI(upazila);
  if (campus) filter.campus = exactCI(campus);
  if (group) filter.group = exactCI(group);
  if (available === "true") filter.isAvailable = true;
  // "Available" implies eligible, so the available filter also applies the donation gap
  if (eligibleOnly === "true" || available === "true") {
    filter.$or = [{ lastDonationDate: null }, { lastDonationDate: { $lte: eligibleCutoff() } }];
  }

  const [donors, total] = await Promise.all([
    DonorProfile.find(filter)
      .populate("user", USER_FIELDS)
      .sort({ isVerified: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    DonorProfile.countDocuments(filter),
  ]);

  res.json({
    success: true,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
    donors: donors.map((d) => toDonorDto(d, req.user)),
  });
});

export const getDonor = asyncHandler(async (req, res) => {
  const donor = await DonorProfile.findById(req.params.id).populate("user", USER_FIELDS);
  if (!donor) throw new ApiError(404, "Donor not found");
  res.json({ success: true, donor: toDonorDto(donor, req.user) });
});

export const verifyDonor = asyncHandler(async (req, res) => {
  const donor = await DonorProfile.findById(req.params.id).populate("user", USER_FIELDS);
  if (!donor) throw new ApiError(404, "Donor not found");
  donor.isVerified = req.body?.isVerified !== false; // default true
  donor.verifiedBy = donor.isVerified ? req.user._id : undefined;
  await donor.save();
  res.json({ success: true, donor: toDonorDto(donor, req.user) });
});