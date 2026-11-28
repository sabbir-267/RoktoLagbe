import { Router } from "express";
import { body } from "express-validator";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import {
  register,
  login,
  googleLogin,
  linkGoogle,
  setPhone,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  sendVerification,
  verifyEmail,
  forgotPasswordEmail,
  resetPasswordEmail,
  enableTwoFactorLogin,
  verifyTwoFactorLogin,
} from "../controllers/authController.js";
import { setupTwoFactor, regenerateBackupCodes, twoFactorStatus } from "../controllers/twoFactorController.js";
import { readChallenge } from "../utils/token.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { normalizePhone } from "../utils/phone.js";


const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts, please try again later" },
});

// Stricter than authLimiter: each request can send a text message
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts, please try again later" },
});

// Verification emails get their own counter, so changing an email a few times
// never blocks the same person from resetting their password
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many emails requested, please try again later" },
});

const phoneRule = body("phone")
  .custom((v) => /^01[3-9]\d{8}$/.test(normalizePhone(v)))
  .withMessage("Enter a valid Bangladeshi mobile number");

// Login accepts { identifier } (phone or email). { phone } / { email } still work for older clients.
const loginIdOf = (b) => b.identifier ?? b.phone ?? b.email;
const isEmailLike = (v) => v.includes("@");
const identifierRule = body("identifier").custom((_, { req }) => {
  const v = loginIdOf(req.body);
  if (typeof v !== "string" || !v.trim()) throw new Error("Enter your phone number or email");
  const trimmed = v.trim();
  if (isEmailLike(trimmed)) {
    if (trimmed.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) throw new Error("Enter a valid email address");
  } else if (!/^01[3-9]\d{8}$/.test(normalizePhone(trimmed))) {
    throw new Error("Enter a valid Bangladeshi mobile number or email");
  }
  return true;
});

const credentialRule = body("credential")
  .isString()
  .notEmpty()
  .withMessage("Google credential is required");

router.post(
  "/register",
  authLimiter,
  [
    body("name").trim().isLength({ min: 2, max: 80 }).withMessage("Name must be 2-80 characters"),
    phoneRule,
    body("email").optional({ values: "falsy" }).isEmail().withMessage("Invalid email address"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  ],
  validate,
  register
);

router.post(
  "/login",
  authLimiter,
  [identifierRule, body("password").notEmpty().withMessage("Password is required")],
  validate,
  login
);

router.post("/forgot-password", resetLimiter, [phoneRule], validate, forgotPassword);

router.post(
  "/reset-password",
  resetLimiter,
  [
    phoneRule,
    body("otp").matches(/^\d{6}$/).withMessage("Enter the 6-digit code"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  ],
  validate,
  resetPassword
);

router.post("/google", authLimiter, [credentialRule], validate, googleLogin);
router.post("/google/link", authLimiter, protect, [credentialRule], validate, linkGoogle);
router.patch("/phone", protect, [phoneRule], validate, setPhone);

router.get("/me", protect, getMe);

// ---------- Two-step verification (controllers/twoFactorController.js) ----------
// Code guesses are limited per account (not per IP), so a 6-digit code can't be brute-forced
const codeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const id = readChallenge(req.body?.challenge)?.id || req.user?._id;
    return id ? `2fa:${id}` : `ip:${ipKeyGenerator(req.ip || "")}`;
  },
  message: { success: false, message: "Too many wrong codes. Please wait 15 minutes and log in again." },
});
const challengeRule = body("challenge").isString().notEmpty().withMessage("Please log in again");
const codeRule = body("code").isString().trim().isLength({ min: 6, max: 20 }).withMessage("Enter the code");

router.post("/2fa/setup", authLimiter, [challengeRule], validate, setupTwoFactor);
router.post("/2fa/enable", codeLimiter, [challengeRule, codeRule], validate, enableTwoFactorLogin);
router.post("/2fa/verify", codeLimiter, [challengeRule, codeRule], validate, verifyTwoFactorLogin);
router.get("/2fa/status", protect, twoFactorStatus);
router.post("/2fa/backup-codes", protect, codeLimiter, [codeRule], validate, regenerateBackupCodes);

// ---------- Account settings ----------
router.patch(
  "/me",
  protect,
  [body("name").isString().withMessage("Name is required").bail().trim().isLength({ min: 2, max: 80 }).withMessage("Name must be 2-80 characters")],
  validate,
  updateProfile
);

router.post(
  "/change-password",
  authLimiter,
  protect,
  [
    body("currentPassword").optional({ values: "falsy" }).isString().withMessage("Invalid current password").bail().isLength({ max: 200 }),
    body("newPassword")
      .isString()
      .withMessage("New password is required")
      .bail()
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters")
      .bail()
      .isLength({ max: 200 })
      .withMessage("Password must be at most 200 characters"),
  ],
  validate,
  changePassword
);

// ---------- Email verification ----------
router.post(
  "/email/send-verification",
  emailLimiter,
  protect,
  [body("email").optional({ values: "falsy" }).isEmail().withMessage("Enter a valid email address").bail().isLength({ max: 254 })],
  validate,
  sendVerification
);

router.post(
  "/email/verify",
  authLimiter,
  [body("token").isString().withMessage("Verification token is required")],
  validate,
  verifyEmail
);

// ---------- Password reset by email ----------
router.post(
  "/forgot-password/email",
  resetLimiter,
  [body("email").isEmail().withMessage("Enter a valid email address").bail().isLength({ max: 254 })],
  validate,
  forgotPasswordEmail
);

router.post(
  "/reset-password/email",
  resetLimiter,
  [
    body("token").isString().withMessage("Reset token is required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  ],
  validate,
  resetPasswordEmail
);

export default router;