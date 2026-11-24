import mongoose from "mongoose";

// One-time links sent by email (email verification and password reset).
// Only a SHA-256 hash of the token is stored, so a database leak can't be used to
// verify emails or reset passwords. One active token per user per purpose;
// MongoDB deletes expired ones automatically (TTL index).
const emailTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    purpose: { type: String, enum: ["verify_email", "reset_password"], required: true },
    tokenHash: { type: String, required: true, unique: true },
    email: { type: String, required: true }, // the address the link was sent to
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

emailTokenSchema.index({ user: 1, purpose: 1 }, { unique: true });
emailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("EmailToken", emailTokenSchema);
