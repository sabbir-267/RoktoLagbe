// models/BloodBank.js
import mongoose from "mongoose";

const bloodBankSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    licenseNo: { type: String, unique: true, sparse: true },
    phone: { type: String, required: true },
    email: String,
    division: String,
    district: { type: String, required: true, index: true },
    address: String,
    location: {
  type: { type: String, enum: ["Point"] },        // no default
  coordinates: { type: [Number], default: undefined }, // [lng, lat]
},
    openingHours: String,
    is24Hours: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: false }, // admin approval
  },
  { timestamps: true }
);

bloodBankSchema.index({ location: "2dsphere" }, { sparse: true });

export default mongoose.model("BloodBank", bloodBankSchema);