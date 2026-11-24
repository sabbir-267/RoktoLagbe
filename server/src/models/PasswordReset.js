import mongoose from "mongoose";

// One active reset code per phone number. MongoDB deletes the document
// automatically after expiresAt (TTL index), so old codes never pile up.
const passwordResetSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("PasswordReset", passwordResetSchema);
