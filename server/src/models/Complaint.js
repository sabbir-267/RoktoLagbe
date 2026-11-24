// models/Complaint.js
import crypto from "crypto";
import mongoose from "mongoose";

export const COMPLAINT_CATEGORIES = [
  "fake_request",
  "asked_for_money",
  "donor_behaviour",
  "requester_behaviour",
  "blood_bank",
  "app_problem",
  "other",
];
export const COMPLAINT_STATUSES = ["open", "in_review", "resolved", "dismissed"];

// Short code people can quote, e.g. "RL-7K3P9Q" (no 0/O/1/I to avoid misreading)
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const makeReference = () => {
  const bytes = crypto.randomBytes(6);
  let code = "";
  for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
  return `RL-${code}`;
};

// Only paths on this site: "/requests/123", "/donors?group=A%2B" (no scheme, no "//")
export const isSitePath = (v) =>
  typeof v === "string" &&
  v.length <= 300 &&
  v.startsWith("/") &&
  !v.includes("//") &&
  !v.includes("\\") &&
  !/^\/*[a-z][a-z0-9+.-]*:/i.test(v) &&
  !/[\s<>"'`]/.test(v);

const complaintSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, default: makeReference },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    // Contact details for guests (logged-in reporters are reached through their account)
    contactName: { type: String, trim: true, maxlength: 80 },
    contactPhone: { type: String, trim: true, maxlength: 20 },
    contactEmail: { type: String, trim: true, lowercase: true, maxlength: 120 },
    category: { type: String, enum: COMPLAINT_CATEGORIES, required: true },
    subject: { type: String, required: true, trim: true, minlength: 5, maxlength: 120 },
    message: { type: String, required: true, trim: true, minlength: 20, maxlength: 2000 },
    relatedUrl: {
      type: String,
      trim: true,
      maxlength: 300,
      validate: { validator: (v) => !v || isSitePath(v), message: "Related link must be a page on this site" },
    },
    status: { type: String, enum: COMPLAINT_STATUSES, default: "open", index: true },
    adminNote: { type: String, trim: true, maxlength: 1000, default: "" }, // shown to the reporter
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedAt: Date,
  },
  { timestamps: true }
);

complaintSchema.index({ status: 1, createdAt: -1 });

complaintSchema.pre("validate", function () {
  if (!this.reporter && !this.contactPhone && !this.contactEmail) {
    this.invalidate("contactPhone", "Give a phone number or email so we can reach you");
  }
});

export default mongoose.model("Complaint", complaintSchema);
