// models/Notification.js
import mongoose from "mongoose";
import { isSitePath } from "./Complaint.js";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["donor_match", "request_update", "expiry_alert", "system", "consultation"], required: true },
    title: String,
    message: String,
    relatedRequest: { type: mongoose.Schema.Types.ObjectId, ref: "BloodRequest" },
    // A page on this site to open, e.g. /consultations/<id> (used when relatedRequest doesn't fit)
    link: {
      type: String,
      trim: true,
      validate: { validator: (v) => !v || isSitePath(v), message: "link must be a page on this site" },
    },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);