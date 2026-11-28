import { API_ORIGIN } from "../services/api";

// Uploaded pictures are stored as "/api/avatars/<id>?v=…" (served by the API, which may be on
// another address in production); Google pictures are full https URLs.
export const avatarSrc = (url) => {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("/api/")) return `${API_ORIGIN}${url}`;
  return /^https:\/\//.test(url) ? url : null;
};

export const initialsOf = (name) =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";
