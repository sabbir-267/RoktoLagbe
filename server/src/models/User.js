import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: {
      type: String,
      trim: true,
      match: /^(\+8801|01)[3-9]\d{8}$/, // Bangladeshi mobile format; optional for Google signups
    },
    email: { type: String, lowercase: true, trim: true, sparse: true, unique: true },
    passwordHash: { type: String, select: false }, // absent for Google-only accounts
    googleId: { type: String, sparse: true, unique: true },
    avatar: String,
    isEmailVerified: { type: Boolean, default: false },
    passwordChangedAt: Date, // tokens issued before this are rejected (set on password reset)
    role: { type: String, enum: ["user", "bank_staff", "admin", "doctor"], default: "user" }, // doctor: approved via DoctorProfile
    bloodBank: { type: mongoose.Schema.Types.ObjectId, ref: "BloodBank" }, // for bank_staff
    isPhoneVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    // Two-step verification (authenticator app). Required for the roles in utils/twoFactor.js.
    twoFactor: {
      enabled: { type: Boolean, default: false },
      enabledAt: Date,
      secret: { type: String, select: false }, // encrypted (utils/secretBox.js)
      pendingSecret: { type: String, select: false }, // during setup, until the first code is confirmed
      backupCodes: { type: [String], select: false, default: undefined }, // sha256 hashes, each usable once
      lastStep: { type: Number, select: false }, // last accepted time step, so a code can't be reused
    },
  },
  { timestamps: true }
);

// Unique only when a phone exists, so many Google users can have no phone yet
userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: "string" } } }
);

// Every account needs at least one way to sign in
userSchema.pre("validate", async function () {
  if (!this.phone && !this.googleId) {
    this.invalidate("phone", "Phone number is required");
  }
});

export default mongoose.model("User", userSchema);