import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requiresTwoFactor } from "../utils/twoFactor.js";

// A token signed before the last password reset must stop working
// (iat is in seconds, passwordChangedAt in milliseconds)
const issuedBeforePasswordChange = (decoded, user) =>
  !!user.passwordChangedAt && decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000);

// Shared by HTTP requests and the chat socket: returns the user for a token, or throws a 401
export const userFromToken = async (token) => {
  if (!token) throw new ApiError(401, "Not authenticated");

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }
  if (decoded.typ) throw new ApiError(401, "Invalid or expired token"); // e.g. a two-step challenge ticket

  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) throw new ApiError(401, "User no longer exists or is deactivated");
  if (issuedBeforePasswordChange(decoded, user)) {
    throw new ApiError(401, "Your password was changed. Please log in again.");
  }
  // Admin, doctor and bank staff sessions must have passed two-step verification. This also
  // catches sessions from before it was required, and users whose role was just raised.
  if (requiresTwoFactor(user) && !decoded.mfa) {
    throw new ApiError(401, "Your account needs two-step verification. Please log in again.");
  }
  user.$locals.mfa = !!decoded.mfa;
  return user;
};

export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  req.user = await userFromToken(token);
  next();
});

export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "You do not have permission to do this"));
    }
    next();
  };

// Attaches req.user if a valid token is sent; otherwise continues as a guest
export const optionalAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = decoded.typ ? null : await User.findById(decoded.id);
      if (user?.isActive && !issuedBeforePasswordChange(decoded, user) && (decoded.mfa || !requiresTwoFactor(user))) {
        req.user = user;
      }
    } catch {
      /* bad token → treat as guest */
    }
  }
  next();
});

export const requirePhone = (req, res, next) => {
  if (!req.user.phone) {
    return next(new ApiError(403, "Please add your phone number first"));
  }
  next();
};

// Donors must prove they own their email before they can be listed
export const requireVerifiedEmail = (req, res, next) => {
  if (!req.user.email) {
    return next(new ApiError(403, "Add and verify your email address to become a donor"));
  }
  if (!req.user.isEmailVerified) {
    return next(new ApiError(403, "Please verify your email address first. Check your inbox for the link."));
  }
  next();
};
