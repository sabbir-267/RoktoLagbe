import { Router } from "express";
import { body, param, query } from "express-validator";
import rateLimit from "express-rate-limit";
import {
  createConsultation, myConsultations, doctorQueue, publicAnswers, getConsultation,
  claimConsultation, releaseConsultation, postMessage, closeConsultation, setShare,
} from "../controllers/consultationController.js";
import { protect, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { CONSULTATION_CATEGORIES, PATIENT_SEXES } from "../models/Consultation.js";

const router = Router();

// Limits run after protect, so they count per account rather than per IP
const perUser = (windowMs, limit, message, extra = {}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user._id),
    message: { success: false, message },
    ...extra,
  });

const askLimiter = perUser(24 * 60 * 60 * 1000, Number(process.env.CONSULT_CREATE_LIMIT) || 5,
  "You've asked several questions today. Please try again tomorrow.",
  { skipFailedRequests: true }); // a rejected (invalid) form doesn't use up the quota
const replyLimiter = perUser(10 * 60 * 1000, Number(process.env.CONSULT_MESSAGE_LIMIT) || 30,
  "You're sending messages too fast. Please slow down.");

const idRule = param("id").isMongoId().withMessage("Invalid id");

const text = (field, min, max, label) =>
  body(field)
    .isString().withMessage(`${label} must be text`).bail()
    .trim()
    .isLength({ min, max }).withMessage(`${label} must be ${min}-${max} characters`);

// ---------- Public ----------

router.get(
  "/public",
  [
    query("q").optional().isString().withMessage("q must be text").bail().isLength({ max: 80 }),
    query("category").optional().isIn(CONSULTATION_CATEGORIES).withMessage("Invalid category"),
    query("page").optional().isInt({ min: 1, max: 1000 }),
  ],
  validate,
  publicAnswers
);

// ---------- Logged in ----------

router.use(protect);

router.post(
  "/",
  askLimiter,
  [
    body("category").isIn(CONSULTATION_CATEGORIES).withMessage("Choose a category"),
    text("subject", 5, 120, "Subject"),
    text("question", 20, 3000, "Question"),
    body("patientAge")
      .optional({ values: "null" })
      .if((v) => v !== "") // an empty form field means "not given"
      .isInt({ min: 0, max: 120 }).withMessage("Age must be a whole number from 0 to 120")
      .toInt(),
    body("patientSex").optional({ values: "falsy" }).isIn(PATIENT_SEXES).withMessage("Invalid sex"),
    body("shareAnonymously").optional().isBoolean({ strict: true }).withMessage("shareAnonymously must be true or false"),
  ],
  validate,
  createConsultation
);

router.get("/mine", myConsultations);

router.get(
  "/queue",
  authorize("doctor"),
  [query("category").optional().isIn(CONSULTATION_CATEGORIES).withMessage("Invalid category")],
  validate,
  doctorQueue
);

router.get("/:id", [idRule], validate, getConsultation);

router.post("/:id/claim", authorize("doctor"), [idRule], validate, claimConsultation);
router.post("/:id/release", authorize("doctor"), [idRule], validate, releaseConsultation);

router.post(
  "/:id/messages",
  replyLimiter,
  [idRule, text("text", 1, 3000, "Message")],
  validate,
  postMessage
);

router.post("/:id/close", [idRule], validate, closeConsultation);

router.patch(
  "/:id/share",
  [idRule, body("shareAnonymously").isBoolean({ strict: true }).withMessage("shareAnonymously must be true or false")],
  validate,
  setShare
);

export default router;
