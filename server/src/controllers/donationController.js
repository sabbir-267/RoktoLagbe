import BloodBank from "../models/BloodBank.js";
import Donation from "../models/Donation.js";
import DonorProfile from "../models/DonorProfile.js";
import InventoryBatch from "../models/InventoryBatch.js";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { normalizePhone } from "../utils/phone.js";
import { isEligibleNow, nextEligibleDate } from "../utils/eligibility.js";
import { defaultExpiry } from "../utils/shelfLife.js";

const DAY = 24 * 60 * 60 * 1000;
const NO_PROFILE = "No donor profile for this phone number";

const fmtDate = (d) => new Date(d).toISOString().slice(0, 10);

// Same message whether the phone has no account or no donor profile, so staff can't probe for accounts
const findDonorByPhone = async (phone) => {
  const user = await User.findOne({ phone: normalizePhone(phone) }).select("name phone");
  const donor = user && (await DonorProfile.findOne({ user: user._id }));
  if (!donor) throw new ApiError(404, NO_PROFILE);
  return { user, donor };
};

// Same shape as inventoryController's batch DTO
const toBatchDto = (b) => ({
  id: b._id,
  bloodGroup: b.bloodGroup,
  component: b.component,
  units: b.units,
  collectedAt: b.collectedAt,
  expiresAt: b.expiresAt,
  status: b.status,
  daysLeft: Math.ceil((new Date(b.expiresAt) - Date.now()) / DAY),
});

// Undo the profile changes made by recordDonation, using the document as it was before
const restoreProfile = (prev) => {
  const set = { isVerified: prev.isVerified };
  const unset = {};
  if (prev.lastDonationDate) set.lastDonationDate = prev.lastDonationDate;
  else unset.lastDonationDate = 1;
  if (prev.verifiedBy) set.verifiedBy = prev.verifiedBy;
  else unset.verifiedBy = 1;

  const update = { $inc: { totalDonations: -1 }, $set: set };
  if (Object.keys(unset).length) update.$unset = unset;
  return DonorProfile.updateOne({ _id: prev._id }, update);
};

const logRollbackError = (err) => console.error("Donation rollback failed:", err.message);

// GET /api/banks/:id/donors/lookup?phone=   Minimal preview so staff can confirm the right person
export const lookupDonor = asyncHandler(async (req, res) => {
  const { user, donor } = await findDonorByPhone(req.query.phone);
  res.json({
    success: true,
    donor: {
      name: user.name,
      bloodGroup: donor.bloodGroup,
      isEligible: isEligibleNow(donor.lastDonationDate),
      nextEligibleDate: nextEligibleDate(donor.lastDonationDate),
      lastDonationDate: donor.lastDonationDate || null,
      totalDonations: donor.totalDonations,
    },
  });
});

// POST /api/banks/:id/donations   A bank records (and so verifies) a donation it witnessed
export const recordDonation = asyncHandler(async (req, res) => {
  const bank = await BloodBank.findById(req.params.id).select("_id");
  if (!bank) throw new ApiError(404, "Blood bank not found");

  const donatedAt = req.body.donatedAt ? new Date(req.body.donatedAt) : new Date();
  const units = req.body.units ?? 1;
  const addToStock = req.body.addToStock !== false;
  const component = req.body.component || "whole_blood";

  const expiresAt = defaultExpiry(donatedAt, component);
  if (addToStock && expiresAt <= new Date()) {
    throw new ApiError(400, "A unit collected on that date has already expired; untick \"Add to stock\" to record the donation only");
  }

  const { user, donor } = await findDonorByPhone(req.body.phone);

  // The eligibility check and the profile update are one atomic step, so a double submit can't record twice.
  // The gap applies on both sides because a backdated donation may come before the last recorded one.
  const gapMs = nextEligibleDate(donatedAt) - donatedAt;
  const prev = await DonorProfile.findOneAndUpdate(
    {
      _id: donor._id,
      $or: [
        { lastDonationDate: null },
        { lastDonationDate: { $lte: new Date(donatedAt.getTime() - gapMs) } },
        { lastDonationDate: { $gte: new Date(donatedAt.getTime() + gapMs) } },
      ],
    },
    {
      $max: { lastDonationDate: donatedAt },
      $inc: { totalDonations: 1 },
      $set: { isVerified: true, verifiedBy: req.user._id },
    }
  );
  if (!prev) {
    const fresh = await DonorProfile.findById(donor._id).select("lastDonationDate");
    const last = fresh?.lastDonationDate;
    throw new ApiError(
      409,
      last
        ? `This donor last donated on ${fmtDate(last)} and is not eligible again until ${fmtDate(nextEligibleDate(last))}`
        : "This donor's record changed, please look them up again"
    );
  }

  let donation;
  try {
    donation = await Donation.create({
      donor: donor._id,
      bloodBank: bank._id,
      donatedAt,
      units,
      status: "verified",
      verifiedBy: req.user._id,
    });
  } catch (err) {
    await restoreProfile(prev).catch(logRollbackError);
    throw err;
  }

  let batch;
  if (addToStock) {
    try {
      batch = await InventoryBatch.create({
        bloodBank: bank._id,
        bloodGroup: donor.bloodGroup,
        component,
        units,
        collectedAt: donatedAt,
        expiresAt,
        sourceDonation: donation._id,
        addedBy: req.user._id,
      });
    } catch (err) {
      await Promise.all([
        Donation.deleteOne({ _id: donation._id }).catch(logRollbackError),
        restoreProfile(prev).catch(logRollbackError),
      ]);
      throw err;
    }
  }

  res.status(201).json({
    success: true,
    donation: {
      id: donation._id,
      donatedAt: donation.donatedAt,
      units: donation.units,
      bloodGroup: donor.bloodGroup,
      donorName: user.name,
    },
    ...(batch && { batch: toBatchDto(batch) }),
  });
});

// GET /api/banks/:id/donations   Recent donations recorded at this bank
export const listBankDonations = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const filter = { bloodBank: req.params.id };

  const [donations, total] = await Promise.all([
    Donation.find(filter)
      .sort({ donatedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: "donor", select: "bloodGroup user", populate: { path: "user", select: "name phone" } }),
    Donation.countDocuments(filter),
  ]);

  res.json({
    success: true,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
    donations: donations.map((d) => ({
      id: d._id,
      donorName: d.donor?.user?.name || "Deleted donor",
      bloodGroup: d.donor?.bloodGroup,
      phone: d.donor?.user?.phone,
      units: d.units,
      donatedAt: d.donatedAt,
      status: d.status,
    })),
  });
});

// GET /api/donors/me/donations   The logged-in donor's own history
export const listMyDonations = asyncHandler(async (req, res) => {
  const profile = await DonorProfile.findOne({ user: req.user._id }).select("_id");
  if (!profile) return res.json({ success: true, donations: [] });

  const donations = await Donation.find({ donor: profile._id })
    .sort({ donatedAt: -1, _id: -1 })
    .limit(50)
    .populate("bloodBank", "name district");

  res.json({
    success: true,
    donations: donations.map((d) => ({
      id: d._id,
      bankName: d.bloodBank?.name || null,
      bankDistrict: d.bloodBank?.district || null,
      donatedAt: d.donatedAt,
      units: d.units,
      status: d.status,
    })),
  });
});
