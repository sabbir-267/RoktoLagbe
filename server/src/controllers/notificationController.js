// server/src/controllers/notificationController.js
import Notification from "../models/Notification.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toDto = (n) => ({
  id: n._id,
  type: n.type,
  title: n.title,
  message: n.message,
  requestId: n.relatedRequest,
  link: n.link || null,
  isRead: n.isRead,
  createdAt: n.createdAt,
});

export const listMine = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);

  const filter = { user: req.user._id };
  if (req.query.unread === "true") filter.isRead = false;

  const [rows, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);

  res.json({
    success: true, page, limit, total,
    pages: Math.ceil(total / limit),
    unreadCount,
    notifications: rows.map(toDto),
  });
});

// Light endpoint the frontend can poll for the bell badge
export const unreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ user: req.user._id, isRead: false });
  res.json({ success: true, unreadCount: count });
});

export const markRead = asyncHandler(async (req, res) => {
  // The user filter means nobody can touch someone else's notification (it looks like 404)
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { $set: { isRead: true } },
    { new: true }
  );
  if (!n) throw new ApiError(404, "Notification not found");
  res.json({ success: true, notification: toDto(n) });
});

export const markAllRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany({ user: req.user._id, isRead: false }, { $set: { isRead: true } });
  res.json({ success: true, updated: result.modifiedCount });
});