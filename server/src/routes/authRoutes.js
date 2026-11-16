import { Router } from "express";
import { body } from "express-validator";
import rateLimit from "express-rate-limit";
import {
  register,
  login,
  googleLogin,
  linkGoogle,
  setPhone,
  getMe,
} from "../controllers/authController.js";
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

const phoneRule = body("phone")
  .custom((v) => /^01[3-9]\d{8}$/.test(normalizePhone(v)))
  .withMessage("Enter a valid Bangladeshi mobile number");

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
  [phoneRule, body("password").notEmpty().withMessage("Password is required")],
  validate,
  login
);

router.post("/google", authLimiter, [credentialRule], validate, googleLogin);
router.post("/google/link", authLimiter, protect, [credentialRule], validate, linkGoogle);
router.patch("/phone", protect, [phoneRule], validate, setPhone);

router.get("/me", protect, getMe);



export default router;