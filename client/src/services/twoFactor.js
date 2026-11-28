import { api } from "./api";

// Finishing a login that needs two-step verification (see server controllers/twoFactorController.js)
export const startTwoFactorSetup = (challenge) => api.post("/auth/2fa/setup", { challenge }).then((r) => r.data);
export const enableTwoFactor = (challenge, code) => api.post("/auth/2fa/enable", { challenge, code }).then((r) => r.data);
export const verifyTwoFactor = (challenge, code) => api.post("/auth/2fa/verify", { challenge, code }).then((r) => r.data);

// Logged in
export const getTwoFactorStatus = () => api.get("/auth/2fa/status").then((r) => r.data);
export const newBackupCodes = (code) => api.post("/auth/2fa/backup-codes", { code }).then((r) => r.data);
