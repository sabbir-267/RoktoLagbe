import { formatDate } from "./donors";

export function normalizeNotification(raw) {
  return {
    id: raw.id || raw._id,
    type: raw.type || "system",
    title: raw.title || "",
    message: raw.message || "",
    requestId: raw.requestId || "",
    isRead: Boolean(raw.isRead),
    createdAt: raw.createdAt || "",
  };
}

// Where tapping a notification goes. Requests are the only linked item for now.
export function notificationLink(n) {
  return n.requestId ? `/requests/${n.requestId}` : null;
}

// "Just now", "5 min ago", "3 hours ago", "2 days ago", then a plain date
export function timeAgo(value) {
  if (!value) return "";
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(value);
}