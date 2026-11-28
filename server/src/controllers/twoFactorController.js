// controllers/twoFactorController.js
//
// Two-step verification with an authenticator app, required for admins, doctors and bank staff
// (utils/twoFactor.js). Flow:
//   1. POST /api/auth/login (or /google) with the right password → instead of a session token the
//      reply has { twoFactor: "verify" | "setup", challenge } (a 10-minute ticket, not a session).
//   2a. "setup" (first time): POST /2fa/setup { challenge } → QR code data; then
//       POST /2fa/enable { challenge, code } → session token + 10 one-time backup codes.
//   2b. "verify": POST /2fa/verify { challenge, code } (6-digit app code or a backup code) → session token.
// An admin can reset someone's two-step verification (lost phone); they set it up again next login.

import crypto from "node:crypto";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { signToken, signChallenge, readChallenge } from "../utils/token.js";
import { generateSecret, verifyTotp, otpauthUrl } from "../utils/totp.js";
import { seal, open } from "../utils/secretBox.js";
import { requiresTwoFactor } from "../utils/twoFactor.js";

const SECRET_FIELDS = "+twoFactor.secret +twoFactor.pendingSecret +twoFactor.backupCodes +twoFactor.lastStep";
const BACKUP_CODE_COUNT = 10;

const hashCode = (code) =>
  crypto.createHash("sha256").update(String(code).toLowerCase().replace(/[^a-z0-9]/g, "")).digest("hex");

// 10 codes like "k7fq-2m9x" (no look-alike characters)
const newBackupCodes = () => {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: BACKUP_CODE_COUNT }, () => {
    const bytes = crypto.randomBytes(8);
    const s = Array.from(bytes, (b) => chars[b % chars.length]).join("");
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
};

// Login replies go through here: a session for normal accounts, a two-step challenge for the rest.
// `publicUser` is passed in by authController so the reply shape stays in one place.
export const sessionOrChallenge = (user, publicUser, extra = {}) => {
  if (!requiresTwoFactor(user)) {
    return { success: true, token: signToken(user), user: publicUser(user, extra) };
  }
  return {
    success: true,
    twoFactor: user.twoFactor?.enabled ? "verify" : "setup",
    challenge: signChallenge(user),
    user: { name: user.name, role: user.role },
  };
};

const userFromChallenge = async (challenge) => {
  const decoded = readChallenge(challenge);
  if (!decoded) throw new ApiError(401, "This sign-in step expired. Please log in again.");
  const user = await User.findById(decoded.id).select(SECRET_FIELDS);
  if (!user || !user.isActive) throw new ApiError(401, "User no longer exists or is deactivated");
  return user;
};

const accountLabel = (user) => user.email || user.phone || user.name;

// POST /api/auth/2fa/setup   Body: { challenge }  → a new secret to scan
export const setupTwoFactor = asyncHandler(async (req, res) => {
  const user = await userFromChallenge(req.body.challenge);
  if (user.twoFactor?.enabled) throw new ApiError(409, "Two-step verification is already set up. Enter the code from your app.");

  const secret = generateSecret();
  user.set("twoFactor.pendingSecret", seal(secret));
  await user.save();
  res.json({
    success: true,
    secret, // for typing in by hand when the QR code can't be scanned
    otpauthUrl: otpauthUrl({ secret, account: accountLabel(user) }),
  });
});

const finishLogin = (res, user, publicUser, extra = {}) =>
  res.json({ success: true, token: signToken(user, { mfa: true }), user: publicUser(user, extra) });

// POST /api/auth/2fa/enable   Body: { challenge, code }  → session + backup codes (shown once)
export const enableTwoFactor = (publicUser) =>
  asyncHandler(async (req, res) => {
    const user = await userFromChallenge(req.body.challenge);
    if (user.twoFactor?.enabled) throw new ApiError(409, "Two-step verification is already set up");
    if (!user.twoFactor?.pendingSecret) throw new ApiError(400, "Start the setup again");

    const secret = open(user.twoFactor.pendingSecret);
    const step = verifyTotp(secret, req.body.code);
    if (step === null) throw new ApiError(400, "That code is not right. Check the time on your phone and try the newest code.");

    const codes = newBackupCodes();
    user.set("twoFactor", {
      enabled: true,
      enabledAt: new Date(),
      secret: seal(secret),
      pendingSecret: undefined,
      backupCodes: codes.map(hashCode),
      lastStep: step,
    });
    await user.save();
    res.json({ success: true, token: signToken(user, { mfa: true }), user: publicUser(user), backupCodes: codes });
  });

// POST /api/auth/2fa/verify   Body: { challenge, code }  (app code or a backup code)
export const verifyTwoFactor = (publicUser, extraFor) =>
  asyncHandler(async (req, res) => {
    const user = await userFromChallenge(req.body.challenge);
    if (!user.twoFactor?.enabled || !user.twoFactor.secret) {
      throw new ApiError(409, "Two-step verification isn't set up yet. Please log in again.");
    }
    const code = String(req.body.code || "").trim();

    if (/^\d{6}$/.test(code.replace(/\s+/g, ""))) {
      const step = verifyTotp(open(user.twoFactor.secret), code);
      if (step === null) throw new ApiError(400, "That code is not right. Try the newest code from your app.");
      // Each code works once, so someone who sees it over your shoulder can't reuse it
      const updated = await User.updateOne(
        { _id: user._id, $or: [{ "twoFactor.lastStep": { $lt: step } }, { "twoFactor.lastStep": { $exists: false } }] },
        { $set: { "twoFactor.lastStep": step } }
      );
      if (!updated.modifiedCount) throw new ApiError(400, "That code was already used. Wait for the next one.");
    } else {
      // Backup code: remove it atomically so it can only be used once
      const used = await User.updateOne(
        { _id: user._id, "twoFactor.backupCodes": hashCode(code) },
        { $pull: { "twoFactor.backupCodes": hashCode(code) } }
      );
      if (!used.modifiedCount) throw new ApiError(400, "That code is not right");
    }
    return finishLogin(res, user, publicUser, extraFor ? await extraFor(user) : {});
  });

// POST /api/auth/2fa/backup-codes   Body: { code }  (logged in) → a fresh set; the old ones stop working
export const regenerateBackupCodes = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(SECRET_FIELDS);
  if (!user?.twoFactor?.enabled) throw new ApiError(409, "Two-step verification is not set up");
  if (verifyTotp(open(user.twoFactor.secret), req.body.code) === null) {
    throw new ApiError(400, "That code is not right. Enter the current code from your app.");
  }
  const codes = newBackupCodes();
  user.set("twoFactor.backupCodes", codes.map(hashCode));
  await user.save();
  res.json({ success: true, backupCodes: codes });
});

// GET /api/auth/2fa/status   (logged in)
export const twoFactorStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("+twoFactor.backupCodes");
  res.json({
    success: true,
    required: requiresTwoFactor(user),
    enabled: !!user.twoFactor?.enabled,
    enabledAt: user.twoFactor?.enabledAt || null,
    backupCodesLeft: user.twoFactor?.backupCodes?.length || 0,
  });
});

// POST /api/admin/users/:id/reset-2fa   (admin) For someone who lost their phone and backup codes
export const adminResetTwoFactor = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) {
    throw new ApiError(400, "You can't reset your own two-step verification. Ask another admin.");
  }
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found");
  user.set("twoFactor", { enabled: false });
  await user.save();
  try {
    await Notification.create({
      user: user._id,
      type: "system",
      title: "Two-step verification was reset",
      message:
        "An administrator reset your two-step verification. Next time you log in you'll set up your authenticator app again. If you didn't ask for this, contact us right away.",
    });
  } catch (err) {
    console.error("2FA reset notification failed:", err.message);
  }
  res.json({ success: true, user: { id: user._id, twoFactorEnabled: false } });
});
