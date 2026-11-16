import { Router } from "express";
import { body, param, query } from "express-validator";
import rateLimit from "express-rate-limit";
import {
  upsertMyProfile, getMyProfile, setAvailability,
  searchDonors, getDonor, verifyDonor,
} from "../controllers/donorController.js";
import { protect, optionalAuth, requirePhone, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { BLOOD_GROUPS, normalizeBloodGroup } from "../utils/bloodGroup.js";
import { ageFromDob } from "../utils/eligibility.js";

const router = Router();

const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many searches, please slow down" },
});

const optionalText = (f) =>
  body(f).optional({ values: "falsy" }).isString().trim().isLength({ max: 80 }).withMessage(`${f} is too long`);

const profileRules = [
  body("bloodGroup")
    .custom((v) => BLOOD_GROUPS.includes(normalizeBloodGroup(v)))
    .withMessage("Invalid blood group"),
  body("dateOfBirth")
    .isISO8601().withMessage("Date of birth required (YYYY-MM-DD)").bail()
    .custom((v) => { const a = ageFromDob(v); return a >= 18 && a <= 65; })
    .withMessage("Donors must be between 18 and 65 years old"),
  body("gender").optional().isIn(["male", "female", "other"]).withMessage("Invalid gender"),
  body("weightKg").optional().isFloat({ min: 45, max: 250 }).withMessage("Weight must be at least 45 kg"),
  body("district").isString().trim().notEmpty().isLength({ max: 80 }).withMessage("District is required"),
  ...["division", "upazila", "area", "campus", "group"].map(optionalText),
  body("latitude").optional().isFloat({ min: -90, max: 90 }).withMessage("Invalid latitude"),
  body("longitude").optional().isFloat({ min: -180, max: 180 }).withMessage("Invalid longitude"),
  body("allowPhoneVisible").optional().isBoolean().withMessage("allowPhoneVisible must be true or false"),
  body("lastDonationDate")
    .optional({ values: "falsy" })
    .isISO8601().withMessage("Invalid date").bail()
    .custom((v) => new Date(v) <= new Date()).withMessage("Last donation date cannot be in the future"),
];

const searchRules = [
  query("bloodGroup")
    .optional()
    .isString().bail()
    .custom((v) => BLOOD_GROUPS.includes(normalizeBloodGroup(v)))
    .withMessage("Invalid blood group"),
  ...["district", "upazila", "campus", "group"].map((f) =>
    query(f).optional().isString().withMessage(`${f} must be text`).bail().isLength({ max: 80 })
  ),
  query("available").optional().isIn(["true", "false"]),
  query("eligibleOnly").optional().isIn(["true", "false"]),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 50 }),
];

const idRule = param("id").isMongoId().withMessage("Invalid donor id");

router.get("/", searchLimiter, optionalAuth, searchRules, validate, searchDonors);

router.get("/me", protect, getMyProfile);
router.put("/me", protect, requirePhone, profileRules, validate, upsertMyProfile);
router.patch(
  "/me/availability",
  protect,
  requirePhone,
  body("isAvailable").isBoolean().withMessage("isAvailable must be true or false"),
  validate,
  setAvailability
);

router.patch("/:id/verify", protect, authorize("admin", "bank_staff"), idRule, validate, verifyDonor);
router.get("/:id", optionalAuth, idRule, validate, getDonor);

export default router;