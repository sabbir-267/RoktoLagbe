import { Server } from "socket.io";
import { userFromToken } from "../middleware/auth.js";
import { parseOrigins } from "../config/security.js";
import Conversation from "../models/Conversation.js";

let io = null;

const room = (userId) => `user:${userId}`;

// Real-time delivery for chat. Clients connect with { auth: { token } } and join a
// private room for their own user id; the server only ever emits to those rooms.
export const initSocket = (httpServer) => {
  const allowed = parseOrigins(process.env.CLIENT_URL);
  io = new Server(httpServer, {
    cors: { origin: (origin, cb) => cb(null, !origin || allowed.includes(origin)), credentials: true },
    maxHttpBufferSize: 16 * 1024, // clients only send tiny events; messages go through the REST API
  });

  io.use(async (socket, next) => {
    try {
      const user = await userFromToken(socket.handshake.auth?.token);
      socket.data.userId = String(user._id);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(room(socket.data.userId));

    // "typing" is relayed only to the other person in a conversation the sender belongs to
    socket.on("typing", async (payload) => {
      const { conversationId, to } = payload || {};
      if (!/^[a-f0-9]{24}$/.test(String(conversationId)) || !/^[a-f0-9]{24}$/.test(String(to))) return;
      try {
        const ok = await Conversation.exists({
          _id: conversationId,
          participants: { $all: [socket.data.userId, to] },
          blockedBy: { $size: 0 },
        });
        if (ok) io.to(room(to)).emit("typing", { conversationId });
      } catch {
        /* typing hints are best effort */
      }
    });
  });

  return io;
};

// Safe to call before the socket server exists (e.g. in tests): it just does nothing
export const emitToUser = (userId, event, data) => {
  io?.to(room(String(userId))).emit(event, data);
};
