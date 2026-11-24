import { Router } from "express";
import { body, param, query } from "express-validator";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import {
  createComplaint, myComplaints, listComplaints, updateComplaint,
} from "../controllers/complaintController.js";
import { protect, authorize, optionalAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { COMPLAINT_CATEGORIES, COMPLAINT_STATUSES, isSitePath } from "../models/Complaint.js";
import { normalizePhone } from "../utils/phone.js";

const router = Router();

// Runs after optionalAuth: counts per account when logged in, per IP for guests
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.COMPLAINT_LIMIT) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true, // a rejected (invalid) form doesn't use up the quota
  keyGenerator: (req) => (req.user ? `user:${req.user._id}` : `ip:${ipKeyGenerator(req.ip || "")}`),
  message: { success: false, message: "You've sent several complaints recently. Please try again later." },
});

const text = (field, min, max, label) =>
  body(field)
    .isString().withMessage(`${label} must be text`).bail()
    .trim()
    .isLength({ min, max }).withMessage(`${label} must be ${min}-${max} characters`);

const optionalText = (field, max, label) =>
  body(field)
    .optional({ values: "falsy" })
    .isString().withMessage(`${label} must be text`).bail()
    .trim()
    .isLength({ max }).withMessage(`${label} must be at most ${max} characters`);

router.post(
  "/",
  optionalAuth,
  createLimiter,
  [
    body("category").isIn(COMPLAINT_CATEGORIES).withMessage("Choose a category"),
    text("subject", 5, 120, "Subject"),
    text("message", 20, 2000, "Message"),
    body("relatedUrl")
      .optional({ values: "falsy" })
      .isString().withMessage("Related link must be text").bail()
      .trim()
      .custom(isSitePath).withMessage("Related link must be a page on this site, like /requests/123"),
    optionalText("contactName", 80, "Name"),
    body("contactPhone")
      .optional({ values: "falsy" })
      .isString().bail()
      .custom((v) => /^01[3-9]\d{8}$/.test(normalizePhone(v)))
      .withMessage("Enter a valid Bangladeshi mobile number"),
    body("contactEmail")
      .optional({ values: "falsy" })
      .isString().bail()
      .trim()
      .isEmail().withMessage("Enter a valid email address")
      .isLength({ max: 120 }),
    body().custom((b, { req }) => {
      if (req.user) return true;
      if (str(b.contactPhone) || str(b.contactEmail)) return true;
      throw new Error("Give a phone number or email so we can reach you");
    }),
  ],
  validate,
  createComplaint
);

router.get("/mine", protect, myComplaints);

router.get(
  "/",
  protect,
  authorize("admin"),
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("q").optional().isString().withMessage("q must be text").bail().isLength({ max: 80 }),
    query("status").optional().isIn(COMPLAINT_STATUSES),
    query("category").optional().isIn(COMPLAINT_CATEGORIES),
  ],
  validate,
  listComplaints
);

router.patch(
  "/:id",
  protect,
  authorize("admin"),
  [
    param("id").isMongoId().withMessage("Invalid id"),
    body("status").optional().isIn(COMPLAINT_STATUSES).withMessage("Invalid status"),
    body("adminNote")
      .optional()
      .isString().withMessage("Reply must be text").bail()
      .trim()
      .isLength({ max: 1000 }).withMessage("Reply must be at most 1000 characters"),
    body().custom((b) => b.status !== undefined || b.adminNote !== undefined).withMessage("Nothing to update"),
  ],
  validate,
  updateComplaint
);

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

export default router;
