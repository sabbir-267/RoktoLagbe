import { api } from "./api";

// Sends the already-resized picture as raw bytes (see utils/imageResize.js)
export const uploadAvatar = (blob) =>
  api.put("/avatars/me", blob, { headers: { "Content-Type": blob.type } }).then((r) => r.data);

export const removeAvatar = () => api.delete("/avatars/me").then((r) => r.data);
