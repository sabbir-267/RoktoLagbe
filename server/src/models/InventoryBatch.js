// models/InventoryBatch.js
import mongoose from "mongoose";

const inventoryBatchSchema = new mongoose.Schema(
  {
    bloodBank: { type: mongoose.Schema.Types.ObjectId, ref: "BloodBank", required: true, index: true },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      required: true,
    },
    component: {
      type: String,
      enum: ["whole_blood", "red_cells", "platelets", "plasma"],
      default: "whole_blood",
    },
    units: { type: Number, required: true, min: 0 },
    collectedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ["available", "reserved", "expired", "used"], default: "available" },
    sourceDonation: { type: mongoose.Schema.Types.ObjectId, ref: "Donation" },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

inventoryBatchSchema.index({ bloodBank: 1, bloodGroup: 1, status: 1, expiresAt: 1 });

export default mongoose.model("InventoryBatch", inventoryBatchSchema);