import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// A private chat between exactly two users
const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: ObjectId, ref: "User" }],
      validate: [(v) => v.length === 2, "A conversation has exactly two people"],
    },
    // Sorted "<idA>:<idB>" so the same pair always maps to one conversation
    pairKey: { type: String, required: true, unique: true },
    startedBy: { type: ObjectId, ref: "User" },
    relatedRequest: { type: ObjectId, ref: "BloodRequest" }, // where the chat was started from, if anywhere
    lastMessage: {
      text: String,
      sender: { type: ObjectId, ref: "User" },
      at: Date,
    },
    // Unread count per user id
    unread: { type: Map, of: Number, default: {} },
    blockedBy: [{ type: ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1, "lastMessage.at": -1 });

export const pairKeyOf = (a, b) => [String(a), String(b)].sort().join(":");

export default mongoose.model("Conversation", conversationSchema);
