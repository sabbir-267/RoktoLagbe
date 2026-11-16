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
    role: { type: String, enum: ["user", "bank_staff", "admin"], default: "user" },
    bloodBank: { type: mongoose.Schema.Types.ObjectId, ref: "BloodBank" }, // for bank_staff
    isPhoneVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
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