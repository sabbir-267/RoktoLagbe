import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { normalizePhone } from "../utils/phone.js";
import { signToken } from "../utils/token.js";

const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  phone: u.phone,
  email: u.email,
  avatar: u.avatar,
  role: u.role,
  needsPhone: !u.phone,
});

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

  res.status(201).json({ success: true, token: signToken(user), user: publicUser(user) });
});

export const login = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;
  const user = await User.findOne({ phone: normalizePhone(phone) }).select("+passwordHash");

  // Google-only accounts have no passwordHash, so they can't pass this check
  const ok = user && user.passwordHash && (await bcrypt.compare(password, user.passwordHash));
  if (!ok || !user.isActive) throw new ApiError(401, "Invalid phone or password");

  res.json({ success: true, token: signToken(user), user: publicUser(user) });
});

export const googleLogin = asyncHandler(async (req, res) => {
  const payload = await verifyGoogleCredential(req.body.credential);
  const email = payload.email.toLowerCase();

  let user = await User.findOne({ googleId: payload.sub });
  let isNewUser = false;

  if (!user) {
    // Never auto-link to an existing account by email (our emails are unverified)
    if (await User.findOne({ email })) {
      throw new ApiError(
        409,
        "An account with this email already exists. Log in with your phone number, then link Google from your profile."
      );
    }
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
  res.json({ success: true, user: publicUser(req.user) });
});