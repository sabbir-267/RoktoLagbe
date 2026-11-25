// services/consultationNotify.js
// In-app notifications (+ socket push) for "Ask a doctor". Best effort: a failure here is
// logged and swallowed so it never fails the action that triggered it.
import Notification from "../models/Notification.js";
import { emitToUser } from "./socket.js";

export const notifyConsultation = async (userIds, { title, message, link }) => {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean).map(String))];
  if (!ids.length) return 0;
  try {
    const docs = await Notification.insertMany(
      ids.map((user) => ({ user, type: "consultation", title, message, link }))
    );
    for (const n of docs) {
      try {
        emitToUser(n.user, "notification:new", { type: "consultation", link, notificationId: n._id });
      } catch {
        /* socket pushes are best effort */
      }
    }
    return docs.length;
  } catch (err) {
    console.error("Consultation notification failed:", err.message);
    return 0;
  }
};
