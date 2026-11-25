import DoctorProfile from "../models/DoctorProfile.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { canonicalDistrict } from "../utils/districts.js";

const str = (v) => (typeof v === "string" ? v.trim() : "");

const cleanLanguages = (v) => {
  const list = Array.isArray(v) ? v : [];
  const out = ["bn", "en"].filter((l) => list.includes(l));
  return out.length ? out : ["bn", "en"];
};

// What anyone may see. Never includes the doctor's phone or email.
// `p.user` must be populated with at least name and avatar.
export const toDoctorPublic = (p) => ({
  id: p._id,
  userId: p.user?._id ?? p.user,
  name: p.user?.name,
  avatar: p.user?.avatar || null,
  specialty: p.specialty,
  hospital: p.hospital,
  district: p.district,
  bio: p.bio || "",
  languages: p.languages?.length ? [...p.languages] : ["bn", "en"],
  answeredCount: p.answeredCount || 0,
  acceptingQuestions: !!p.acceptingQuestions,
});

// What the doctor (and admins) see about the application
export const toDoctorOwn = (p) => ({
  ...toDoctorPublic(p),
  bmdcNo: p.bmdcNo,
  status: p.status,
  reviewNote: p.reviewNote || "",
  createdAt: p.createdAt,
});

const duplicateBmdc = (err) => err?.code === 11000 && /bmdcNo/.test(String(err.message));

// GET /api/doctors?specialty=&district=   (public)
export const listDoctors = asyncHandler(async (req, res) => {
  const filter = { status: "approved" };
  if (str(req.query.specialty)) filter.specialty = req.query.specialty;
  if (str(req.query.district)) filter.district = canonicalDistrict(req.query.district) || str(req.query.district);

  const rows = await DoctorProfile.find(filter)
    .sort({ answeredCount: -1 })
    .limit(500)
    .populate({ path: "user", select: "name avatar role isActive" });

  const doctors = rows
    .filter((p) => p.user && p.user.isActive && p.user.role === "doctor")
    .sort((a, b) => (b.answeredCount || 0) - (a.answeredCount || 0) || String(a.user.name).localeCompare(String(b.user.name)))
    .map(toDoctorPublic);
  res.json({ success: true, doctors });
});

// POST /api/doctors/apply   (role user, has phone)
export const applyDoctor = asyncHandler(async (req, res) => {
  if (req.user.role !== "user") {
    throw new ApiError(409, "Only regular member accounts can apply to volunteer as a doctor");
  }
  const { bmdcNo, specialty, hospital, district, bio, languages } = req.body;
  const fields = {
    bmdcNo: str(bmdcNo).toUpperCase(),
    specialty,
    hospital: str(hospital),
    district: canonicalDistrict(district),
    bio: str(bio),
    languages: cleanLanguages(languages),
  };

  const existing = await DoctorProfile.findOne({ user: req.user._id });
  if (existing && existing.status !== "rejected") {
    throw new ApiError(409, "You have already applied to volunteer as a doctor");
  }

  let profile;
  try {
    if (existing) {
      // A rejected applicant may re-apply: the same profile goes back to "pending"
      existing.set({ ...fields, status: "pending", reviewNote: "", reviewedBy: undefined, reviewedAt: undefined });
      profile = await existing.save();
    } else {
      profile = await DoctorProfile.create({ ...fields, user: req.user._id });
    }
  } catch (err) {
    if (duplicateBmdc(err)) throw new ApiError(409, "This BMDC registration number is already registered");
    if (err?.code === 11000) throw new ApiError(409, "You have already applied to volunteer as a doctor");
    throw err;
  }

  await profile.populate({ path: "user", select: "name avatar" });
  res.status(201).json({ success: true, doctor: toDoctorOwn(profile) });
});

// GET /api/doctors/me
export const myDoctorProfile = asyncHandler(async (req, res) => {
  const profile = await DoctorProfile.findOne({ user: req.user._id }).populate({ path: "user", select: "name avatar" });
  res.json({ success: true, doctor: profile ? toDoctorOwn(profile) : null });
});

// PATCH /api/doctors/me   (role doctor)
export const updateMyDoctorProfile = asyncHandler(async (req, res) => {
  const profile = await DoctorProfile.findOne({ user: req.user._id, status: "approved" });
  if (!profile) throw new ApiError(404, "Doctor profile not found");

  const { bio, hospital, district, languages, acceptingQuestions } = req.body;
  if (bio !== undefined) profile.bio = str(bio);
  if (hospital !== undefined) profile.hospital = str(hospital);
  if (district !== undefined) profile.district = canonicalDistrict(district);
  if (languages !== undefined) profile.languages = cleanLanguages(languages);
  if (acceptingQuestions !== undefined) profile.acceptingQuestions = acceptingQuestions;
  await profile.save();

  await profile.populate({ path: "user", select: "name avatar" });
  res.json({ success: true, doctor: toDoctorOwn(profile) });
});
