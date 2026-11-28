// controllers/avatarController.js
// Upload, serve and remove profile pictures. User.avatar holds the picture's address:
// "/api/avatars/<userId>?v=<time>" for uploaded pictures (the version changes on every upload,
// so browsers can cache each one forever), or a Google picture URL for Google sign-ins.
import mongoose from "mongoose";
import Avatar from "../models/Avatar.js";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const AVATAR_MAX_BYTES = 300 * 1024;

// Trust the file's first bytes, not the Content-Type header the browser claims
const sniff = (buf) => {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
};

// PUT /api/avatars/me   Body: the image bytes (Content-Type image/jpeg, image/png or image/webp)
export const uploadAvatar = asyncHandler(async (req, res) => {
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    throw new ApiError(400, "Choose a JPG, PNG or WebP picture");
  }
  const type = sniff(buf);
  if (!type) throw new ApiError(400, "That file is not a JPG, PNG or WebP picture");

  await Avatar.findOneAndUpdate(
    { user: req.user._id },
    { $set: { data: buf, contentType: type } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  const avatar = `/api/avatars/${req.user._id}?v=${Date.now().toString(36)}`;
  await User.updateOne({ _id: req.user._id }, { $set: { avatar } });
  res.json({ success: true, avatar });
});

// DELETE /api/avatars/me   Back to the initials placeholder
export const removeAvatar = asyncHandler(async (req, res) => {
  await Avatar.deleteOne({ user: req.user._id });
  await User.updateOne({ _id: req.user._id }, { $unset: { avatar: 1 } });
  res.json({ success: true, avatar: null });
});

// GET /api/avatars/:userId   Public, like a name: the picture is shown wherever the person appears
export const getAvatar = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) throw new ApiError(404, "No picture");
  const a = await Avatar.findOne({ user: req.params.userId }).select("data contentType updatedAt").lean();
  if (!a) throw new ApiError(404, "No picture");

  const etag = `"${a.updatedAt.getTime().toString(36)}"`;
  // The site and the API run on different addresses, so the browser must be allowed to show it there
  res.set({
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Cache-Control": req.query.v ? "public, max-age=31536000, immutable" : "public, max-age=300",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  });
  if (req.headers["if-none-match"] === etag) return res.status(304).end();
  res.type(a.contentType).send(a.data.buffer ? Buffer.from(a.data.buffer) : a.data);
});
