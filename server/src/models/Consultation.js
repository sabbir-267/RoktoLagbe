// models/Consultation.js
// A health question from a user, answered privately by one volunteer doctor.
// Private by default; shown (without the asker) in the public FAQ only when the asker
// chose shareAnonymously and an admin hasn't hidden it.
import mongoose from "mongoose";

export const CONSULTATION_CATEGORIES = [
  "donation_eligibility",
  "after_donation",
  "transfusion",
  "thalassemia",
  "pregnancy",
  "medicines",
  "other",
];
export const CONSULTATION_STATUSES = ["open", "claimed", "answered", "closed"];
export const PATIENT_SEXES = ["male", "female", "other"];

const messageSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    from: { type: String, enum: ["asker", "doctor"], required: true },
    text: { type: String, required: true, trim: true, minlength: 1, maxlength: 3000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const consultationSchema = new mongoose.Schema(
  {
    asker: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, enum: CONSULTATION_CATEGORIES, required: true },
    subject: { type: String, required: true, trim: true, minlength: 5, maxlength: 120 },
    question: { type: String, required: true, trim: true, minlength: 20, maxlength: 3000 },
    patientAge: { type: Number, min: 0, max: 120 },
    patientSex: { type: String, enum: PATIENT_SEXES },
    shareAnonymously: { type: Boolean, default: false },
    hiddenFromPublic: { type: Boolean, default: false }, // admin moderation of the public FAQ
    status: { type: String, enum: CONSULTATION_STATUSES, default: "open" },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    messages: { type: [messageSchema], default: [] }, // the question itself is NOT a message
    claimedAt: Date,
    answeredAt: Date,
    closedAt: Date,
    lastActivityAt: { type: Date, default: Date.now },
    // When each side last opened the thread (drives unreadForMe in lists)
    askerSeenAt: Date,
    doctorSeenAt: Date,
  },
  { timestamps: true }
);

consultationSchema.index({ asker: 1, lastActivityAt: -1 });
consultationSchema.index({ status: 1, createdAt: -1 });
consultationSchema.index({ doctor: 1, lastActivityAt: -1 });
// Public FAQ: shared, not hidden, answered/closed, newest answer first
consultationSchema.index({ shareAnonymously: 1, hiddenFromPublic: 1, status: 1, answeredAt: -1 });

export default mongoose.model("Consultation", consultationSchema);
