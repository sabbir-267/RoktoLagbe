import User from "../models/User.js";
import BloodBank from "../models/BloodBank.js";
import DonorProfile from "../models/DonorProfile.js";
import BloodRequest from "../models/BloodRequest.js";
import InventoryBatch from "../models/InventoryBatch.js";
import Complaint from "../models/Complaint.js";
import DoctorProfile from "../models/DoctorProfile.js";
import Consultation from "../models/Consultation.js";
import { toDoctorOwn } from "./doctorController.js";
import { notifyConsultation } from "../services/consultationNotify.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { normalizeBloodGroup } from "../utils/bloodGroup.js";
import { eligibleCutoff, isEligibleNow } from "../utils/eligibility.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const str = (v) => (typeof v === "string" ? v.trim() : "");

const pageParams = (req, defaultLimit = 20) => ({
  page: Math.max(parseInt(req.query.page, 10) || 1, 1),
  limit: Math.min(Math.max(parseInt(req.query.limit, 10) || defaultLimit, 1), 100),
});

const paged = (page, limit, total) => ({ page, limit, total, pages: Math.ceil(total / limit) });

const toAdminUser = (u) => ({
  id: u._id,
  name: u.name,
  phone: u.phone,
  email: u.email,
  role: u.role,
  isActive: u.isActive,
  isEmailVerified: !!u.isEmailVerified,
  hasGoogle: !!u.googleId,
  bloodBank: u.bloodBank ? { id: u.bloodBank._id ?? u.bloodBank, name: u.bloodBank.name } : null,
  createdAt: u.createdAt,
});

// ---------- Overview ----------

// GET /api/admin/stats
export const getStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const [users, admins, bankStaff, inactiveUsers, donors, verifiedDonors, availableDonors,
    approvedBanks, pendingBanks, requestsByStatus, unitsByGroup, openComplaints, inReviewComplaints] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: "admin" }),
    User.countDocuments({ role: "bank_staff" }),
    User.countDocuments({ isActive: false }),
    DonorProfile.countDocuments(),
    DonorProfile.countDocuments({ isVerified: true }),
    DonorProfile.countDocuments({
      isAvailable: true,
      $or: [{ lastDonationDate: null }, { lastDonationDate: { $lte: eligibleCutoff() } }],
    }),
    BloodBank.countDocuments({ isApproved: true }),
    BloodBank.countDocuments({ isApproved: false }),
    BloodRequest.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    InventoryBatch.aggregate([
      { $match: { status: "available", units: { $gt: 0 }, expiresAt: { $gt: now } } },
      { $group: { _id: "$bloodGroup", units: { $sum: "$units" } } },
    ]),
    Complaint.countDocuments({ status: "open" }),
    Complaint.countDocuments({ status: "in_review" }),
  ]);
  const [approvedDoctors, pendingDoctors, openConsultations, answeredConsultations] = await Promise.all([
    DoctorProfile.countDocuments({ status: "approved" }),
    DoctorProfile.countDocuments({ status: "pending" }),
    Consultation.countDocuments({ status: "open" }),
    Consultation.countDocuments({ status: "answered" }),
  ]);

  const requests = Object.fromEntries(requestsByStatus.map((r) => [r._id, r.count]));
  const stock = Object.fromEntries(unitsByGroup.map((r) => [r._id, r.units]));

  res.json({
    success: true,
    stats: {
      users: { total: users, admins, bankStaff, inactive: inactiveUsers },
      donors: { total: donors, verified: verifiedDonors, available: availableDonors },
      banks: { approved: approvedBanks, pending: pendingBanks },
      requests,
      stock,
      complaints: { open: openComplaints, inReview: inReviewComplaints },
      doctors: { approved: approvedDoctors, pending: pendingDoctors },
      consultations: { open: openConsultations, answered: answeredConsultations },
    },
  });
});

// ---------- Users ----------

// GET /api/admin/users?q=&role=&status=active|inactive&page=
export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit } = pageParams(req);
  const filter = {};
  const q = str(req.query.q);
  if (q) {
    const re = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: re }, { phone: re }, { email: re }];
  }
  if (str(req.query.role)) filter.role = req.query.role;
  if (req.query.status === "active") filter.isActive = true;
  if (req.query.status === "inactive") filter.isActive = false;

  const [rows, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("bloodBank", "name"),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, ...paged(page, limit, total), users: rows.map(toAdminUser) });
});

// PATCH /api/admin/users/:id   Body: { role?: "user"|"admin", isActive?: boolean }
// Bank staff are assigned from the blood bank screen, because they need a bank.
export const updateUser = asyncHandler(async (req, res) => {
  if (req.user._id.equals(req.params.id)) {
    throw new ApiError(400, "You cannot change your own role or status");
  }
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found");

  const { role, isActive } = req.body;
  // Doctor accounts are managed from the Doctors tab, which keeps the DoctorProfile in step
  if (role !== undefined && user.role === "doctor") {
    throw new ApiError(409, "This account is a volunteer doctor. Suspend them from the Doctors tab to change their role.");
  }
  if (role !== undefined) {
    user.role = role;
    user.bloodBank = undefined; // "user" and "admin" are never tied to a bank
  }
  if (isActive !== undefined) user.isActive = isActive;

  await user.save();
  await user.populate("bloodBank", "name");
  res.json({ success: true, user: toAdminUser(user) });
});

// ---------- Blood banks ----------

// GET /api/admin/banks?status=pending|approved&q=&page=
export const listAllBanks = asyncHandler(async (req, res) => {
  const { page, limit } = pageParams(req);
  const filter = {};
  if (req.query.status === "pending") filter.isApproved = false;
  if (req.query.status === "approved") filter.isApproved = true;
  const q = str(req.query.q);
  if (q) {
    const re = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: re }, { district: re }, { licenseNo: re }];
  }

  const [rows, total] = await Promise.all([
    BloodBank.find(filter).sort({ isApproved: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    BloodBank.countDocuments(filter),
  ]);

  const staffCounts = await User.aggregate([
    { $match: { role: "bank_staff", bloodBank: { $in: rows.map((b) => b._id) } } },
    { $group: { _id: "$bloodBank", count: { $sum: 1 } } },
  ]);
  const countOf = Object.fromEntries(staffCounts.map((s) => [String(s._id), s.count]));

  res.json({
    success: true,
    ...paged(page, limit, total),
    banks: rows.map((b) => ({
      id: b._id,
      name: b.name,
      licenseNo: b.licenseNo,
      phone: b.phone,
      email: b.email,
      division: b.division,
      district: b.district,
      address: b.address,
      openingHours: b.openingHours,
      is24Hours: b.is24Hours,
      isApproved: b.isApproved,
      staffCount: countOf[String(b._id)] || 0,
      createdAt: b.createdAt,
    })),
  });
});

// PATCH /api/admin/banks/:id/approval   Body: { isApproved: boolean }
export const setBankApproval = asyncHandler(async (req, res) => {
  const bank = await BloodBank.findById(req.params.id);
  if (!bank) throw new ApiError(404, "Blood bank not found");
  bank.isApproved = req.body.isApproved;
  await bank.save();
  res.json({ success: true, bank: { id: bank._id, name: bank.name, isApproved: bank.isApproved } });
});

// ---------- Donors ----------

// GET /api/admin/donors?verified=true|false&bloodGroup=&q=&page=
export const listAllDonors = asyncHandler(async (req, res) => {
  const { page, limit } = pageParams(req);
  const filter = {};
  if (req.query.verified === "true") filter.isVerified = true;
  if (req.query.verified === "false") filter.isVerified = false;
  if (str(req.query.bloodGroup)) filter.bloodGroup = normalizeBloodGroup(req.query.bloodGroup);

  const q = str(req.query.q);
  if (q) {
    const re = new RegExp(escapeRegex(q), "i");
    const userIds = await User.find({ $or: [{ name: re }, { phone: re }, { email: re }] }).distinct("_id");
    filter.$or = [{ user: { $in: userIds } }, { district: re }];
  }

  const [rows, total] = await Promise.all([
    DonorProfile.find(filter)
      .sort({ isVerified: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("user", "name phone email isActive"),
    DonorProfile.countDocuments(filter),
  ]);

  res.json({
    success: true,
    ...paged(page, limit, total),
    donors: rows.map((d) => ({
      id: d._id,
      name: d.user?.name,
      phone: d.user?.phone,
      email: d.user?.email,
      userActive: d.user?.isActive,
      bloodGroup: d.bloodGroup,
      district: d.district,
      upazila: d.upazila,
      isAvailable: d.isAvailable && isEligibleNow(d.lastDonationDate),
      isVerified: d.isVerified,
      totalDonations: d.totalDonations,
      lastDonationDate: d.lastDonationDate,
      createdAt: d.createdAt,
    })),
  });
});

// ---------- Doctors ----------

const DOCTOR_STATUS_TEXT = {
  approved: "approved. You can now answer questions from the doctor portal",
  rejected: "not approved",
  suspended: "suspended",
};

// GET /api/admin/doctors?status=&q=&page=
export const listDoctorApplications = asyncHandler(async (req, res) => {
  const { page, limit } = pageParams(req);
  const filter = {};
  if (str(req.query.status)) filter.status = req.query.status;
  const q = str(req.query.q);
  if (q) {
    const re = new RegExp(escapeRegex(q), "i");
    const userIds = await User.find({ $or: [{ name: re }, { phone: re }, { email: re }] }).distinct("_id");
    filter.$or = [{ user: { $in: userIds } }, { bmdcNo: re }, { hospital: re }, { district: re }];
  }

  const [rows, total] = await Promise.all([
    DoctorProfile.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("user", "name avatar phone email"),
    DoctorProfile.countDocuments(filter),
  ]);
  res.json({
    success: true,
    ...paged(page, limit, total),
    doctors: rows.map((p) => ({
      ...toDoctorOwn(p),
      user: p.user ? { id: p.user._id, name: p.user.name, phone: p.user.phone, email: p.user.email } : null,
    })),
  });
});

// PATCH /api/admin/doctors/:id   Body: { status: approved|rejected|suspended, reviewNote? }
// approved → role "doctor"; rejected/suspended → role back to "user" (only if it was "doctor")
export const reviewDoctor = asyncHandler(async (req, res) => {
  const profile = await DoctorProfile.findById(req.params.id);
  if (!profile) throw new ApiError(404, "Doctor application not found");
  const user = await User.findById(profile.user);
  if (!user) throw new ApiError(404, "The applicant's account no longer exists");
  if (user._id.equals(req.user._id)) throw new ApiError(400, "You cannot review your own application");

  const { status, reviewNote } = req.body;
  if (status === "approved" && !["user", "doctor"].includes(user.role)) {
    throw new ApiError(409, "Only a regular member account can be approved as a doctor (this one is an admin or bank staff)");
  }

  profile.status = status;
  if (reviewNote !== undefined) profile.reviewNote = str(reviewNote);
  profile.reviewedBy = req.user._id;
  profile.reviewedAt = new Date();
  await profile.save();

  if (status === "approved" && user.role !== "doctor") {
    user.role = "doctor";
    user.bloodBank = undefined;
    await user.save();
  } else if (status !== "approved" && user.role === "doctor") {
    user.role = "user";
    await user.save();
  }

  if (status !== "approved") {
    // Questions they took but never answered go back to the queue for other doctors
    await Consultation.updateMany(
      { doctor: user._id, status: "claimed" },
      { $set: { status: "open", lastActivityAt: new Date() }, $unset: { doctor: 1, claimedAt: 1, doctorSeenAt: 1 } }
    ).catch((err) => console.error("Releasing a doctor's questions failed:", err.message));
  }

  await notifyConsultation(user._id, {
    title: "Your doctor application",
    message:
      `Your volunteer doctor profile was ${DOCTOR_STATUS_TEXT[status]}.` +
      (profile.reviewNote ? ` Note from the admin: ${profile.reviewNote}` : ""),
    link: status === "approved" ? "/doctor-portal" : "/doctors/join",
  });

  await profile.populate("user", "name avatar phone email");
  res.json({
    success: true,
    doctor: {
      ...toDoctorOwn(profile),
      user: { id: profile.user._id, name: profile.user.name, phone: profile.user.phone, email: profile.user.email },
    },
  });
});
