import { Router } from "express";
import { body, param, query } from "express-validator";
import rateLimit from "express-rate-limit";
import {
  createRequest, listRequests, listMine, getRequest, updateRequest, setStatus,
} from "../controllers/requestController.js";
import { parseRequestText } from "../controllers/parseController.js";
import { getMatches, notifyMatches, respondToRequest, getResponses } from "../controllers/matchController.js";
import { tripAction, updateTripLocation, getTrips } from "../controllers/tripController.js";
import { protect, optionalAuth, requirePhone } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { BLOOD_GROUPS, normalizeBloodGroup } from "../utils/bloodGroup.js";
import { COMPONENTS } from "../utils/shelfLife.js";
import { normalizePhone } from "../utils/phone.js";

const router = Router();
const DAY = 24 * 60 * 60 * 1000;
const isBloodGroup = (v) => BLOOD_GROUPS.includes(normalizeBloodGroup(v));

// Production default is 10 per hour; set REQUEST_CREATE_LIMIT=1000 in .env for development/tests
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.REQUEST_CREATE_LIMIT) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests created. Please try again later." },
});

// AI parsing costs money, so it is limited per user. Set AI_PARSE_LIMIT=1000 in .env for development.
const parseLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.AI_PARSE_LIMIT) || 10,
  keyGenerator: (req) => String(req.user._id), // must run after protect
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many AI requests. Please try again later." },
});

// Notifying donors is limited per user so nobody can spam donors. Set MATCH_NOTIFY_LIMIT=1000 for development.
const notifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.MATCH_NOTIFY_LIMIT) || 10,
  keyGenerator: (req) => String(req.user._id), // must run after protect
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many notification attempts. Please try again later." },
});

// Live trip location updates: per user. Set TRIP_LOCATION_LIMIT=1000 in .env for development/tests.
const tripLocationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.TRIP_LOCATION_LIMIT) || 40,
  keyGenerator: (req) => String(req.user._id), // must run after protect
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many location updates. Please slow down." },
});

const fields = (isCreate) => {
  const opt = (chain) => (isCreate ? chain : chain.optional());
  return [
    ...(isCreate
      ? [
          body("bloodGroup").custom(isBloodGroup).withMessage("Invalid blood group"),
          body("component").optional().isIn(COMPONENTS).withMessage(`Component must be one of: ${COMPONENTS.join(", ")}`),
          body("rawText").optional({ values: "falsy" }).isString().isLength({ max: 1000 }).withMessage("rawText is too long"),
          body("parsedFromText").optional().isBoolean().withMessage("parsedFromText must be true or false"),
        ]
      : []),
    // Hospital pin: on create, or set/fixed later by PATCH
    body("latitude").optional().not().isArray().bail().isFloat({ min: -90, max: 90 }).withMessage("Invalid latitude"),
    body("longitude").optional().not().isArray().bail().isFloat({ min: -180, max: 180 }).withMessage("Invalid longitude"),
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

const matchRules = [
  query("limit").optional().isInt({ min: 1, max: 20 }).withMessage("limit must be between 1 and 20"),
  query("includeOtherDistricts").optional().isIn(["true", "false"]),
];

const notifyRules = [
  body("limit").optional().isInt({ min: 1, max: 10 }).withMessage("limit must be between 1 and 10"),
  body("includeOtherDistricts").optional().isBoolean().withMessage("includeOtherDistricts must be true or false"),
];

const tripActionRules = [
  body("action").isIn(["start", "arrived", "stop"]).withMessage("action must be start, arrived or stop"),
];

const tripLocationRules = [
  body("latitude").exists({ values: "null" }).withMessage("latitude is required").bail()
    .not().isArray().withMessage("Invalid latitude").bail()
    .isFloat({ min: -90, max: 90 }).withMessage("Invalid latitude"),
  body("longitude").exists({ values: "null" }).withMessage("longitude is required").bail()
    .not().isArray().withMessage("Invalid longitude").bail()
    .isFloat({ min: -180, max: 180 }).withMessage("Invalid longitude"),
  body("accuracy").optional({ values: "null" })
    .not().isArray().withMessage("accuracy must be 0-5000 metres").bail()
    .isFloat({ min: 0, max: 5000 }).withMessage("accuracy must be 0-5000 metres"),
];

const respondRules = [body("response").isIn(["accepted", "declined"]).withMessage("response must be accepted or declined")];

// Fixed paths (/mine, /parse) must stay above the /:id routes
router.get("/", optionalAuth, listRules, validate, listRequests);
router.get("/mine", protect, mineRules, validate, listMine);
router.post(
  "/parse",
  protect,
  parseLimiter,
  body("text")
    .isString().withMessage("text is required").bail()
    .trim().isLength({ min: 10, max: 1000 }).withMessage("Message must be 10-1000 characters"),
  validate,
  parseRequestText
);
router.post("/", protect, requirePhone, createLimiter, fields(true), validate, createRequest);

// Donor matching (6C)
router.get("/:id/matches", protect, idRule, matchRules, validate, getMatches);
router.post("/:id/notify", protect, notifyLimiter, idRule, notifyRules, validate, notifyMatches);
router.get("/:id/responses", protect, idRule, validate, getResponses);
router.post("/:id/respond", protect, idRule, respondRules, validate, respondToRequest);

// Live trip tracking (docs/maps-and-live-tracking.md §2)
router.post("/:id/trip", protect, idRule, tripActionRules, validate, tripAction);
router.put("/:id/trip/location", protect, tripLocationLimiter, idRule, tripLocationRules, validate, updateTripLocation);
router.get("/:id/trips", protect, idRule, validate, getTrips);

router.get("/:id", optionalAuth, idRule, validate, getRequest);
router.patch("/:id", protect, idRule, fields(false), validate, updateRequest);
router.patch("/:id/status", protect, idRule, statusRules, validate, setStatus);

export default router;