// models/Notification.js
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["donor_match", "request_update", "expiry_alert", "system"], required: true },
    title: String,
    message: String,
    relatedRequest: { type: mongoose.Schema.Types.ObjectId, ref: "BloodRequest" },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);