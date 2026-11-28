// models/Donation.js
import mongoose from "mongoose";

const donationSchema = new mongoose.Schema(
  {
    donor: { type: mongoose.Schema.Types.ObjectId, ref: "DonorProfile", required: true, index: true },
    request: { type: mongoose.Schema.Types.ObjectId, ref: "BloodRequest" },
    bloodBank: { type: mongoose.Schema.Types.ObjectId, ref: "BloodBank" },
    donatedAt: { type: Date, required: true },
    units: { type: Number, default: 1 },
    // bank: recorded by blood bank staff · request: confirmed by the requester the donor gave blood to
    // self: the donor entered the date themselves (shown as "self-reported", not counted on the leaderboard)
    source: { type: String, enum: ["bank", "request", "self"], default: "bank" },
    status: {
      type: String,
      enum: ["pending_verification", "verified", "rejected", "self_reported"],
      default: "pending_verification",
    },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // The donor's lastDonationDate before this record changed it, so a mistaken confirmation can be undone
    previousLastDonation: { type: Date, select: false },
    countedInTotal: { type: Boolean, default: true }, // whether it added 1 to DonorProfile.totalDonations
  },
  { timestamps: true }
);

export default mongoose.model("Donation", donationSchema);