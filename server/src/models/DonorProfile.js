// models/DonorProfile.js
import mongoose from "mongoose";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const donorProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true, index: true },
    gender: { type: String, enum: ["male", "female", "other"] },
    dateOfBirth: { type: Date, required: true },
    weightKg: { type: Number, min: 30 },

    // Location (mirrors the reference site's filters)
    division: String,
    district: { type: String, required: true, index: true },
    upazila: String,
    area: String,
    location: {
  type: { type: String, enum: ["Point"] },        // no default
  coordinates: { type: [Number], default: undefined }, // [lng, lat]
},

    // Affiliation filters (campus / group)
    campus: { type: String, index: true },
    group: { type: String, index: true },

    // Availability & eligibility
    isAvailable: { type: Boolean, default: true, index: true },
    lastDonationDate: Date,
    totalDonations: { type: Number, default: 0 },
    medicalNotes: { type: String, select: false }, // private
    allowPhoneVisible: { type: Boolean, default: false },
    showOnLeaderboard: { type: Boolean, default: true }, // donors can opt out of the public leaderboard

    // Verification
    isVerified: { type: Boolean, default: false },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

donorProfileSchema.index({ location: "2dsphere" }, { sparse: true });
donorProfileSchema.index({ bloodGroup: 1, district: 1, isAvailable: 1 });

export default mongoose.model("DonorProfile", donorProfileSchema);