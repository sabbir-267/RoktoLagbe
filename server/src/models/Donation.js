// models/Donation.js
import mongoose from "mongoose";

const donationSchema = new mongoose.Schema(
  {
    donor: { type: mongoose.Schema.Types.ObjectId, ref: "DonorProfile", required: true, index: true },
    request: { type: mongoose.Schema.Types.ObjectId, ref: "BloodRequest" },
    bloodBank: { type: mongoose.Schema.Types.ObjectId, ref: "BloodBank" },
    donatedAt: { type: Date, required: true },
    units: { type: Number, default: 1 },
    status: { type: String, enum: ["pending_verification", "verified", "rejected"], default: "pending_verification" },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("Donation", donationSchema);