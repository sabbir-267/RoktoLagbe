import { api } from "./api";

// Google sign-in: send the ID token ("credential") from the Google button
export const googleSignIn = (credential) => api.post("/auth/google", { credential }).then((r) => r.data);

// Google users have no phone yet; this adds one (only once)
export const addPhone = (phone) => api.patch("/auth/phone", { phone }).then((r) => r.data);

// Email verification
export const sendVerificationEmail = (email) =>
  api.post("/auth/email/send-verification", email ? { email } : {}).then((r) => r.data);
export const verifyEmailToken = (token) => api.post("/auth/email/verify", { token }).then((r) => r.data);

// Password reset by email
export const requestResetEmail = (email) =>
  api.post("/auth/forgot-password/email", { email }).then((r) => r.data);
export const resetPasswordWithToken = (token, password) =>
  api.post("/auth/reset-password/email", { token, password }).then((r) => r.data);

// Account settings
export const updateProfile = (name) => api.patch("/auth/me", { name }).then((r) => r.data);
// payload: { currentPassword?, newPassword }; the reply includes a fresh token
export const changePassword = (payload) => api.post("/auth/change-password", payload).then((r) => r.data);
