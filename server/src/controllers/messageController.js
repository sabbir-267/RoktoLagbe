import Conversation, { pairKeyOf } from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import DonorProfile from "../models/DonorProfile.js";
import BloodRequest from "../models/BloodRequest.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { emitToUser } from "../services/socket.js";

const PREVIEW_LEN = 140;

const otherOf = (conv, me) => conv.participants.find((p) => String(p._id ?? p) !== String(me));

const unreadFor = (conv, userId) => conv.unread?.get(String(userId)) || 0;

const toMessageDto = (m) => ({
  id: m._id,
  conversationId: m.conversation,
  sender: m.sender,
  text: m.text,
  createdAt: m.createdAt,
});

// participants must be populated with "name avatar isActive"
const toConversationDto = (conv, me) => {
  const other = otherOf(conv, me._id);
  const blockedByMe = conv.blockedBy.some((u) => String(u) === String(me._id));
  return {
    id: conv._id,
    other: other
      ? { id: other._id, name: other.name, avatar: other.avatar, isActive: other.isActive !== false }
      : null,
    relatedRequest: conv.relatedRequest || null,
    lastMessage: conv.lastMessage?.at
      ? { text: conv.lastMessage.text, sender: conv.lastMessage.sender, at: conv.lastMessage.at }
      : null,
    unread: unreadFor(conv, me._id),
    blockedByMe,
    blockedByOther: !blockedByMe && conv.blockedBy.length > 0,
    updatedAt: conv.updatedAt,
  };
};

const PARTICIPANT_FIELDS = "name avatar isActive";

// Loads a conversation only if the user is in it (404 otherwise, so ids can't be probed)
const loadOwn = async (id, user) => {
  const conv = await Conversation.findOne({ _id: id, participants: user._id }).populate(
    "participants",
    PARTICIPANT_FIELDS
  );
  if (!conv) throw new ApiError(404, "Conversation not found");
  return conv;
};

// POST /api/messages/conversations   Body: exactly one of { userId, donorId, requestId }
// Finds or creates the chat with that person. Donors and requesters are resolved to their account,
// so people can talk without either side sharing a phone number.
export const startConversation = asyncHandler(async (req, res) => {
  const { userId, donorId, requestId } = req.body;
  let targetId;
  let relatedRequest;

  if (donorId) {
    const donor = await DonorProfile.findById(donorId).select("user");
    if (!donor) throw new ApiError(404, "Donor not found");
    targetId = donor.user;
  } else if (requestId) {
    const request = await BloodRequest.findById(requestId).select("requester");
    if (!request) throw new ApiError(404, "Request not found");
    targetId = request.requester;
    relatedRequest = request._id;
  } else {
    targetId = userId;
  }

  if (String(targetId) === String(req.user._id)) throw new ApiError(400, "You can't message yourself");
  const target = await User.findOne({ _id: targetId, isActive: true }).select("_id");
  if (!target) throw new ApiError(404, "This person can't receive messages");

  const conv = await Conversation.findOneAndUpdate(
    { pairKey: pairKeyOf(req.user._id, target._id) },
    {
      $setOnInsert: {
        participants: [req.user._id, target._id],
        startedBy: req.user._id,
        ...(relatedRequest ? { relatedRequest } : {}),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).populate("participants", PARTICIPANT_FIELDS);

  res.json({ success: true, conversation: toConversationDto(conv, req.user) });
});

// GET /api/messages/conversations   Newest activity first. Empty chats you were invited to are hidden.
export const listConversations = asyncHandler(async (req, res) => {
  const convs = await Conversation.find({
    participants: req.user._id,
    $or: [{ "lastMessage.at": { $exists: true } }, { startedBy: req.user._id }],
  })
    .sort({ "lastMessage.at": -1, updatedAt: -1 })
    .limit(100)
    .populate("participants", PARTICIPANT_FIELDS);

  res.json({ success: true, conversations: convs.map((c) => toConversationDto(c, req.user)) });
});

// GET /api/messages/unread-count
export const unreadCount = asyncHandler(async (req, res) => {
  const key = `unread.${req.user._id}`;
  const [row] = await Conversation.aggregate([
    { $match: { participants: req.user._id, [key]: { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: `$${key}` } } },
  ]);
  res.json({ success: true, unreadCount: row?.total || 0 });
});

// GET /api/messages/conversations/:id?before=<ISO date>&limit=
export const getConversation = asyncHandler(async (req, res) => {
  const conv = await loadOwn(req.params.id, req.user);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
  const filter = { conversation: conv._id };
  if (req.query.before) filter.createdAt = { $lt: new Date(req.query.before) };

  const rows = await Message.find(filter).sort({ createdAt: -1 }).limit(limit + 1);
  const hasMore = rows.length > limit;
  const messages = rows.slice(0, limit).reverse().map(toMessageDto);

  res.json({ success: true, conversation: toConversationDto(conv, req.user), messages, hasMore });
});

// POST /api/messages/conversations/:id/messages   Body: { text }
export const sendMessage = asyncHandler(async (req, res) => {
  const conv = await loadOwn(req.params.id, req.user);
  if (conv.blockedBy.length) {
    throw new ApiError(403, "Messages can't be sent in this conversation");
  }
  const other = otherOf(conv, req.user._id);
  if (!other || other.isActive === false) throw new ApiError(403, "This person can't receive messages");

  const text = req.body.text.trim();
  const message = await Message.create({ conversation: conv._id, sender: req.user._id, text });

  const updated = await Conversation.findByIdAndUpdate(
    conv._id,
    {
      $set: {
        lastMessage: { text: text.slice(0, PREVIEW_LEN), sender: req.user._id, at: message.createdAt },
        [`unread.${req.user._id}`]: 0,
      },
      $inc: { [`unread.${other._id}`]: 1 },
    },
    { new: true }
  ).populate("participants", PARTICIPANT_FIELDS);

  const dto = toMessageDto(message);
  emitToUser(other._id, "message:new", {
    message: dto,
    conversation: toConversationDto(updated, other),
  });
  // The sender's other tabs/devices stay in sync too
  emitToUser(req.user._id, "message:new", {
    message: dto,
    conversation: toConversationDto(updated, req.user),
  });

  res.status(201).json({ success: true, message: dto });
});

// PATCH /api/messages/conversations/:id/read
export const markRead = asyncHandler(async (req, res) => {
  const conv = await loadOwn(req.params.id, req.user);
  if (unreadFor(conv, req.user._id) > 0) {
    await Conversation.updateOne({ _id: conv._id }, { $set: { [`unread.${req.user._id}`]: 0 } });
  }
  emitToUser(req.user._id, "conversation:read", { conversationId: conv._id });
  res.json({ success: true });
});

// PATCH /api/messages/conversations/:id/block   Body: { blocked: boolean }
export const setBlocked = asyncHandler(async (req, res) => {
  const conv = await loadOwn(req.params.id, req.user);
  const op = req.body.blocked ? "$addToSet" : "$pull";
  const updated = await Conversation.findByIdAndUpdate(
    conv._id,
    { [op]: { blockedBy: req.user._id } },
    { new: true }
  ).populate("participants", PARTICIPANT_FIELDS);

  const other = otherOf(updated, req.user._id);
  if (other) emitToUser(other._id, "conversation:update", { conversation: toConversationDto(updated, other) });
  res.json({ success: true, conversation: toConversationDto(updated, req.user) });
});

