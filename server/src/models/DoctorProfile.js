// models/DoctorProfile.js
// A volunteer doctor's application / profile for "Ask a doctor" (docs/doctor-consultation.md).
// The user's role only becomes "doctor" once an admin approves the profile.
import mongoose from "mongoose";

export const DOCTOR_SPECIALTIES = [
  "hematology",
  "transfusion_medicine",
  "internal_medicine",
  "pediatrics",
  "gynecology",
  "surgery",
  "general_practice",
  "other",
];
export const DOCTOR_STATUSES = ["pending", "approved", "rejected", "suspended"];
export const DOCTOR_LANGUAGES = ["bn", "en"];
export const BMDC_PATTERN = /^[A-Za-z0-9-]+$/;

const doctorProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    // Bangladesh Medical & Dental Council registration number (stored upper-case)
    bmdcNo: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 20,
      match: BMDC_PATTERN,
      unique: true,
    },
    specialty: { type: String, enum: DOCTOR_SPECIALTIES, required: true },
    hospital: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    district: { type: String, required: true, trim: true },
    bio: { type: String, trim: true, maxlength: 500, default: "" },
    languages: {
      type: [{ type: String, enum: DOCTOR_LANGUAGES }],
      default: () => ["bn", "en"],
    },
    status: { type: String, enum: DOCTOR_STATUSES, default: "pending" },
    reviewNote: { type: String, trim: true, maxlength: 300, default: "" }, // shown to the applicant
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    acceptingQuestions: { type: Boolean, default: true },
    answeredCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

doctorProfileSchema.index({ status: 1, answeredCount: -1 });

export default mongoose.model("DoctorProfile", doctorProfileSchema);
