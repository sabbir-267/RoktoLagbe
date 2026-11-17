import { Router } from "express";
import { body, param, query } from "express-validator";
import rateLimit from "express-rate-limit";
import {
  createRequest, listRequests, listMine, getRequest, updateRequest, setStatus,
} from "../controllers/requestController.js";
import { protect, optionalAuth, requirePhone } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { BLOOD_GROUPS, normalizeBloodGroup } from "../utils/bloodGroup.js";
import { COMPONENTS } from "../utils/shelfLife.js";
import { normalizePhone } from "../utils/phone.js";

const router = Router();
const DAY = 24 * 60 * 60 * 1000;
const isBloodGroup = (v) => BLOOD_GROUPS.includes(normalizeBloodGroup(v));

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests created. Please try again later." },
});

const fields = (isCreate) => {
  const opt = (chain) => (isCreate ? chain : chain.optional());
  return [
    ...(isCreate
      ? [
          body("bloodGroup").custom(isBloodGroup).withMessage("Invalid blood group"),
          body("component").optional().isIn(COMPONENTS).withMessage(`Component must be one of: ${COMPONENTS.join(", ")}`),
          body("latitude").optional().isFloat({ min: -90, max: 90 }).withMessage("Invalid latitude"),
          body("longitude").optional().isFloat({ min: -180, max: 180 }).withMessage("Invalid longitude"),
        ]
      : []),
    opt(body("patientName"))
      .isString().withMessage("Patient name is required").bail()
      .trim().isLength({ min: 2, max: 80 }).withMessage("Patient name must be 2-80 characters"),
    opt(body("unitsNeeded"))
      .isInt({ min: 1, max: 20 }).withMessage("Units must be a whole number between 1 and 20"),
    opt(body("hospital"))
      .isString().withMessage("Hospital is required").bail()
      .trim().isLength({ min: 2, max: 120 }).withMessage("Hospital must be 2-120 characters"),
    opt(body("district"))
      .isString().withMessage("District is required").bail()
      .trim().notEmpty().withMessage("District is required").bail()
      .isLength({ max: 80 }).withMessage("District is too long"),
    opt(body("neededBy"))
      .isISO8601().withMessage("neededBy must be a date and time, e.g. 2026-11-20T10:00:00Z").bail()
      .custom((v) => new Date(v) > new Date()).withMessage("neededBy must be in the future").bail()
      .custom((v) => new Date(v) <= new Date(Date.now() + 60 * DAY)).withMessage("neededBy must be within 60 days"),
    body("contactPhone")
      .optional({ values: "falsy" })
      .custom((v) => /^01[3-9]\d{8}$/.test(normalizePhone(v)))
      .withMessage("Enter a valid Bangladeshi mobile number"),
    body("notes").optional({ values: "falsy" }).isString().trim().isLength({ max: 500 }).withMessage("Notes must be under 500 characters"),
  ];
};

const listRules = [
  query("bloodGroup").optional().isString().bail().custom(isBloodGroup).withMessage("Invalid blood group"),
  query("district").optional().isString().withMessage("district must be text").bail().isLength({ max: 80 }),
  query("component").optional().isIn(COMPONENTS),
  query("urgency").optional().isIn(["low", "medium", "high", "critical"]),
  query("status").optional().isIn(["open", "in_progress"]).withMessage("Public status must be open or in_progress"),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 50 }),
];

const mineRules = [
  query("status").optional().isIn(["open", "in_progress", "fulfilled", "cancelled", "expired"]),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 50 }),
];

const idRule = param("id").isMongoId().withMessage("Invalid request id");

const statusRules = [
  body("status").isIn(["open", "in_progress", "fulfilled", "cancelled"]).withMessage("Invalid status"),
  body("fulfilledUnits").optional().isInt({ min: 1, max: 20 }).withMessage("fulfilledUnits must be a whole number"),
];

router.get("/", optionalAuth, listRules, validate, listRequests);
router.get("/mine", protect, mineRules, validate, listMine);
router.post("/", protect, requirePhone, createLimiter, fields(true), validate, createRequest);
router.get("/:id", optionalAuth, idRule, validate, getRequest);
router.patch("/:id", protect, idRule, fields(false), validate, updateRequest);
router.patch("/:id/status", protect, idRule, statusRules, validate, setStatus);

export default router;