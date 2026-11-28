// models/Avatar.js
// Profile pictures, stored in MongoDB so they survive redeploys on hosts with no persistent disk.
// The browser crops and shrinks them to a small square first (about 10–40 KB each).
import mongoose from "mongoose";

const avatarSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    data: { type: Buffer, required: true },
    contentType: { type: String, enum: ["image/jpeg", "image/png", "image/webp"], required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Avatar", avatarSchema);
