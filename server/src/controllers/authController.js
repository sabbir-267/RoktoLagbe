import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import PasswordReset from "../models/PasswordReset.js";
import EmailToken from "../models/EmailToken.js";
import { sendSms, smsAvailable } from "../services/smsService.js";
import {
  emailAvailable,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../services/emailService.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { normalizePhone } from "../utils/phone.js";
import { signToken } from "../utils/token.js";

// `extra` carries fields that depend on data not always loaded, e.g. { hasPassword }
// (passwordHash is select:false, so it can only be reported where it was actually checked)
const publicUser = (u, extra = {}) => ({
  id: u._id,
  name: u.name,
  phone: u.phone,
  email: u.email,
  avatar: u.avatar,
  role: u.role,
  bloodBank: u.bloodBank || null, // id of the bank a bank_staff member works at
  isEmailVerified: !!u.isEmailVerified,
  needsPhone: !u.phone,
  ...extra,
});

// True when the account can log in with a password (Google-only accounts have none)
const userHasPassword = async (userId) =>
  !!(await User.exists({ _id: userId, passwordHash: { $type: "string", $ne: "" } }));

// ---------- One-time email links ----------
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_LINK_TTL_MS = 10 * 60 * 1000; // 10 minutes
const EMAIL_RESEND_MS = 60 * 1000; // at most one email per minute per user and purpose

const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

// Creates (or replaces) the user's token for this purpose and returns the raw token for the link
const issueEmailToken = async (user, purpose, ttlMs) => {
  const token = crypto.randomBytes(32).toString("hex");
  await EmailToken.findOneAndUpdate(
    { user: user._id, purpose },
    { tokenHash: sha256(token), email: user.email, expiresAt: new Date(Date.now() + ttlMs) },
    { upsert: true, setDefaultsOnInsert: true }
  );
  return token;
};

const sentRecently = async (userId, purpose) => {
  const existing = await EmailToken.findOne({ user: userId, purpose });
  return !!existing && existing.expiresAt > new Date() && Date.now() - existing.updatedAt.getTime() < EMAIL_RESEND_MS;
};

// Returns the token record only if it is valid, unexpired and still matches the user's email
const findValidToken = async (token, purpose) => {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return null;
  const record = await EmailToken.findOne({ tokenHash: sha256(token), purpose });
  if (!record || record.expiresAt <= new Date()) return null;
  return record;
};

const deliverVerificationEmail = async (user) => {
  const token = await issueEmailToken(user, "verify_email", VERIFY_TTL_MS);
  try {
    await sendVerificationEmail(user.email, user.name, token);
  } catch (err) {
    await EmailToken.deleteOne({ user: user._id, purpose: "verify_email" });
    throw err;
  }
};

let googleClient;
const verifyGoogleCredential = async (credential) => {
  if (!process.env.GOOGLE_CLIENT_ID) throw new ApiError(500, "Google login is not configured");
  try {
    googleClient ??= new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email_verified) throw new Error("Email not verified");
    return payload;
  } catch {
    throw new ApiError(401, "Invalid Google credential");
  }
};

export const register = asyncHandler(async (req, res) => {
  const { name, phone, email, password } = req.body; // role is deliberately ignored
  const normalized = normalizePhone(phone);

  if (await User.findOne({ phone: normalized })) {
    throw new ApiError(409, "Phone number already registered");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name,
    phone: normalized,
    email: email || undefined,
    passwordHash,
  });

  // Registration succeeds even if the email can't be sent; they can resend from the dashboard
  let emailSent = false;
  if (user.email && emailAvailable()) {
    try {
      await deliverVerificationEmail(user);
      emailSent = true;
    } catch (err) {
      console.error("Verification email after register failed:", err.message);
    }
  }

  res.status(201).json({ success: true, token: signToken(user), user: publicUser(user), emailSent });
});

export const login = asyncHandler(async (req, res) => {
  const { password } = req.body;
  // The route validator guarantees this is a non-empty string (phone or email)
  const identifier = String(req.body.identifier ?? req.body.phone ?? req.body.email).trim();
  const query = identifier.includes("@")
    ? { email: identifier.toLowerCase() }
    : { phone: normalizePhone(identifier) };
  const user = await User.findOne(query).select("+passwordHash");

  // Google-only accounts have no passwordHash, so they can't pass this check
  const ok = user && user.passwordHash && (await bcrypt.compare(password, user.passwordHash));
  if (!ok || !user.isActive) throw new ApiError(401, "Invalid phone/email or password");

  res.json({ success: true, token: signToken(user), user: publicUser(user) });
});

export const googleLogin = asyncHandler(async (req, res) => {
  const payload = await verifyGoogleCredential(req.body.credential);
  const email = payload.email.toLowerCase();

  let user = await User.findOne({ googleId: payload.sub });
  let isNewUser = false;

  if (!user) {
    const sameEmail = await User.findOne({ email });
    if (sameEmail) {
      // Safe to link only when BOTH sides proved ownership of the inbox:
      // Google says email_verified, and this user clicked our verification link.
      if (!sameEmail.isEmailVerified) {
        throw new ApiError(
          409,
          "An account with this email already exists. Log in with your password and verify your email first, then you can use Google sign-in."
        );
      }
      if (sameEmail.googleId) {
        throw new ApiError(409, "This email is linked to a different Google account");
      }
      sameEmail.googleId = payload.sub;
      sameEmail.avatar = sameEmail.avatar || payload.picture;
      await sameEmail.save();
      user = sameEmail;
    }
  }

  if (!user) {
    user = await User.create({
      name: payload.name || email.split("@")[0],
      email,
      googleId: payload.sub,
      avatar: payload.picture,
      isEmailVerified: true,
    });
    isNewUser = true;
  }

  if (!user.isActive) throw new ApiError(401, "Account is deactivated");

  res.status(isNewUser ? 201 : 200).json({
    success: true,
    token: signToken(user),
    user: publicUser(user),
    isNewUser,
  });
});

export const linkGoogle = asyncHandler(async (req, res) => {
  const payload = await verifyGoogleCredential(req.body.credential);

  const owner = await User.findOne({ googleId: payload.sub });
  if (owner) {
    if (owner._id.equals(req.user._id)) throw new ApiError(409, "Google is already linked");
    throw new ApiError(409, "This Google account is linked to another user");
  }

  req.user.googleId = payload.sub;
  req.user.avatar = req.user.avatar || payload.picture;
  if (req.user.email && req.user.email === payload.email.toLowerCase()) {
    req.user.isEmailVerified = true;
  }
  await req.user.save();

  res.json({ success: true, user: publicUser(req.user) });
});

export const setPhone = asyncHandler(async (req, res) => {
  if (req.user.phone) {
    throw new ApiError(403, "Phone number cannot be changed here");
  }
  const normalized = normalizePhone(req.body.phone);
  if (await User.findOne({ phone: normalized })) {
    throw new ApiError(409, "Phone number already registered");
  }
  req.user.phone = normalized;
  await req.user.save();
  res.json({ success: true, user: publicUser(req.user) });
});

export const getMe = asyncHandler(async (req, res) => {
  const hasPassword = await userHasPassword(req.user._id);
  res.json({ success: true, user: publicUser(req.user, { hasPassword }) });
});

// ---------- Account settings ----------

// PATCH /api/auth/me   Body: { name }
export const updateProfile = asyncHandler(async (req, res) => {
  req.user.name = req.body.name; // trimmed and length-checked by the route validator
  await req.user.save();
  const hasPassword = await userHasPassword(req.user._id);
  res.json({ success: true, user: publicUser(req.user, { hasPassword }) });
});

// Same shape as the validate middleware, so the client can show the message under the field
const fieldError = (res, field, message) =>
  res.status(400).json({ success: false, message, errors: [{ field, message }] });

// POST /api/auth/change-password   Body: { currentPassword?, newPassword }
// Accounts that already have a password must confirm it; Google-only accounts may set a first one.
// Other sessions are logged out; this one gets a fresh token.
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+passwordHash");
  if (!user || !user.isActive) throw new ApiError(401, "User no longer exists or is deactivated");

  const hadPassword = !!user.passwordHash;
  if (hadPassword) {
    // 400 (not 401) so the client doesn't treat a typo as an expired session
    if (typeof currentPassword !== "string" || !currentPassword) {
      return fieldError(res, "currentPassword", "Enter your current password");
    }
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return fieldError(res, "currentPassword", "Current password is incorrect");
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      return fieldError(res, "newPassword", "New password must be different from your current password");
    }
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  // auth.js rejects tokens whose iat (whole seconds) is < passwordChangedAt in seconds.
  // Rounding down to the whole second keeps the token signed below valid (its iat is >= this second)
  // while every token issued in an earlier second, i.e. every other session, stops working.
  user.passwordChangedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
  await user.save();
  // Any pending reset links/codes were for the old password
  await EmailToken.deleteMany({ user: user._id, purpose: "reset_password" });
  if (user.phone) await PasswordReset.deleteOne({ phone: user.phone });

  res.json({
    success: true,
    token: signToken(user),
    user: publicUser(user, { hasPassword: true }),
    message: hadPassword ? "Password changed" : "Password set. You can now also log in with your password.",
  });
});

// ---------- Password reset (phone + 6-digit code) ----------
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

// Codes are short-lived and attempt-limited, so a keyed hash is enough here
const hashCode = (phone, code) =>
  crypto.createHmac("sha256", process.env.JWT_SECRET).update(`${phone}:${code}`).digest("hex");

const sameHash = (a, b) => {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Always answers the same way, so nobody can use this to find out which phone numbers have accounts
export const forgotPassword = asyncHandler(async (req, res) => {
  if (!smsAvailable()) throw new ApiError(503, "Password reset is not available right now");

  const phone = normalizePhone(req.body.phone);
  const reply = () => res.json({ success: true, message: "If this number has an account, a code has been sent." });

  const user = await User.findOne({ phone, isActive: true });
  if (!user) return reply();

  const existing = await PasswordReset.findOne({ phone });
  if (existing && Date.now() - existing.updatedAt.getTime() < OTP_RESEND_MS) return reply();

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await PasswordReset.findOneAndUpdate(
    { phone },
    { codeHash: hashCode(phone, code), attempts: 0, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  try {
    await sendSms(phone, `Your RoktoLagbe password reset code is ${code}. It expires in 10 minutes.`);
  } catch (err) {
    await PasswordReset.deleteOne({ phone });
    throw err;
  }
  reply();
});

export const resetPassword = asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const { otp, password } = req.body;
  const invalid = new ApiError(400, "That code is wrong or has expired");

  const record = await PasswordReset.findOne({ phone });
  if (!record || record.expiresAt <= new Date() || record.attempts >= OTP_MAX_ATTEMPTS) throw invalid;

  if (!sameHash(record.codeHash, hashCode(phone, otp))) {
    await PasswordReset.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
    throw invalid;
  }

  const user = await User.findOne({ phone, isActive: true });
  if (!user) throw invalid;

  user.passwordHash = await bcrypt.hash(password, 12);
  user.isPhoneVerified = true; // they just proved they own this number
  user.passwordChangedAt = new Date(); // logs out sessions created before the reset
  await user.save();
  await PasswordReset.deleteOne({ _id: record._id });

  res.json({ success: true, message: "Password updated" });
});

// ---------- Email verification ----------

// POST /api/auth/email/send-verification   (logged in)
// Body (optional): { email } to add or change the email first.
export const sendVerification = asyncHandler(async (req, res) => {
  if (!emailAvailable()) throw new ApiError(503, "Email is not available right now");
  const user = req.user;
  const newEmail = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";

  if (newEmail && newEmail !== user.email) {
    if (await User.exists({ email: newEmail, _id: { $ne: user._id } })) {
      throw new ApiError(409, "This email is already used by another account");
    }
    user.email = newEmail;
    user.isEmailVerified = false;
    await user.save();
    await EmailToken.deleteMany({ user: user._id }); // links sent to the old address stop working
  }

  if (!user.email) throw new ApiError(400, "Add an email address first");
  if (user.isEmailVerified) {
    return res.json({ success: true, message: "Your email is already verified", user: publicUser(user) });
  }
  if (await sentRecently(user._id, "verify_email")) {
    throw new ApiError(429, "We just sent you an email. Please wait a minute before asking again.");
  }

  await deliverVerificationEmail(user);
  res.json({ success: true, message: `Verification email sent to ${user.email}`, user: publicUser(user) });
});

// POST /api/auth/email/verify   Body: { token }   (public: the link may be opened on another device)
export const verifyEmail = asyncHandler(async (req, res) => {
  const invalid = new ApiError(400, "This verification link is invalid or has expired");
  const record = await findValidToken(req.body.token, "verify_email");
  if (!record) throw invalid;

  const user = await User.findById(record.user);
  if (!user || !user.isActive || user.email !== record.email) {
    await EmailToken.deleteOne({ _id: record._id });
    throw invalid;
  }

  user.isEmailVerified = true;
  await user.save();
  await EmailToken.deleteOne({ _id: record._id });

  res.json({ success: true, message: "Email verified", user: publicUser(user) });
});

// ---------- Password reset by email link ----------

// POST /api/auth/forgot-password/email   Body: { email }
// Always answers the same way, so nobody can use this to find out which emails have accounts.
// Only VERIFIED emails get a link: an unverified address may belong to someone else.
export const forgotPasswordEmail = asyncHandler(async (req, res) => {
  if (!emailAvailable()) throw new ApiError(503, "Password reset by email is not available right now");

  const email = String(req.body.email).trim().toLowerCase();
  const reply = () =>
    res.json({ success: true, message: "If this email belongs to a verified account, a reset link has been sent." });

  const user = await User.findOne({ email, isActive: true, isEmailVerified: true });
  if (!user) return reply();
  if (await sentRecently(user._id, "reset_password")) return reply();

  const token = await issueEmailToken(user, "reset_password", RESET_LINK_TTL_MS);
  try {
    await sendPasswordResetEmail(user.email, user.name, token);
  } catch (err) {
    // Answer the same way so the response doesn't reveal that the account exists
    await EmailToken.deleteOne({ user: user._id, purpose: "reset_password" });
    console.error("Password reset email failed:", err.message);
  }
  reply();
});

// POST /api/auth/reset-password/email   Body: { token, password }
export const resetPasswordEmail = asyncHandler(async (req, res) => {
  const invalid = new ApiError(400, "This reset link is invalid or has expired");
  const record = await findValidToken(req.body.token, "reset_password");
  if (!record) throw invalid;

  const user = await User.findById(record.user);
  if (!user || !user.isActive || !user.isEmailVerified || user.email !== record.email) {
    await EmailToken.deleteOne({ _id: record._id });
    throw invalid;
  }

  user.passwordHash = await bcrypt.hash(req.body.password, 12);
  user.passwordChangedAt = new Date(); // logs out sessions created before the reset
  await user.save();
  await EmailToken.deleteOne({ _id: record._id });
  if (user.phone) await PasswordReset.deleteOne({ phone: user.phone }); // pending SMS code no longer needed

  res.json({
    success: true,
    message: "Password updated. You can now log in with your phone number or email and new password.",
  });
});
