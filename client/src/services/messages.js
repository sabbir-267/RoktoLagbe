import { api } from "./api";

export const listConversations = () => api.get("/messages/conversations").then((r) => r.data);

export const getMessagesUnread = () => api.get("/messages/unread-count").then((r) => r.data);

// target: { userId } | { donorId } | { requestId }
export const startConversation = (target) => api.post("/messages/conversations", target).then((r) => r.data);

export const getConversation = (id, params) =>
  api.get(`/messages/conversations/${id}`, { params }).then((r) => r.data);

export const sendMessage = (id, text) =>
  api.post(`/messages/conversations/${id}/messages`, { text }).then((r) => r.data);

export const markConversationRead = (id) => api.patch(`/messages/conversations/${id}/read`).then((r) => r.data);

export const setConversationBlocked = (id, blocked) =>
  api.patch(`/messages/conversations/${id}/block`, { blocked }).then((r) => r.data);
