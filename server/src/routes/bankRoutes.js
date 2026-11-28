import { Router } from "express";
import { body, param, query } from "express-validator";
import {
  createBank, listBanks, getBank, updateBank, listStaff, assignStaff, removeStaff, applyForBank, getMyBank,
} from "../controllers/bankController.js";
import {
  getStock, addBatch, listBatches, issueUnits, setBatchStatus,
} from "../controllers/inventoryController.js";
import { recordDonation, listBankDonations, lookupDonor } from "../controllers/donationController.js";
import { protect, optionalAuth, authorize, requirePhone } from "../middleware/auth.js";
import { requireBankAccess, requireVerifiedBankStaff } from "../middleware/bankAccess.js";
import { validate } from "../middleware/validate.js";
import { BLOOD_GROUPS, normalizeBloodGroup } from "../utils/bloodGroup.js";
import { COMPONENTS } from "../utils/shelfLife.js";
import { normalizePhone } from "../utils/phone.js";

const router = Router();

const PHONE_RE = /^\+?[\d\s-]{6,20}$/; // banks may use landlines
const isBloodGroup = (v) => BLOOD_GROUPS.includes(normalizeBloodGroup(v));

// id params are validated BEFORE access checks
const checkId = [param("id").isMongoId().withMessage("Invalid blood bank id"), validate];
const batchIdRule = param("batchId").isMongoId().withMessage("Invalid batch id");
const userIdRule = param("userId").isMongoId().withMessage("Invalid user id");

const bankFields = (isCreate) => {
  const opt = (chain) => (isCreate ? chain : chain.optional());
  return [
    opt(body("name")).trim().isLength({ min: 2, max: 120 }).withMessage("Name must be 2-120 characters"),
    opt(body("phone")).custom((v) => PHONE_RE.test(String(v))).withMessage("Enter a valid phone number"),
    opt(body("district"))
  .isString().withMessage("District is required").bail()
  .trim().notEmpty().withMessage("District is required").bail()
  .isLength({ max: 80 }).withMessage("District is too long"),

    body("licenseNo").optional({ values: "falsy" }).isString().trim().isLength({ max: 60 }).withMessage("License number is too long"),
    body("email").optional({ values: "falsy" }).isEmail().withMessage("Invalid email address"),
    ...["division", "address", "openingHours"].map((f) =>
      body(f).optional({ values: "falsy" }).isString().trim().isLength({ max: 200 }).withMessage(`${f} is too long`)
    ),
    body("is24Hours").optional().isBoolean().withMessage("is24Hours must be true or false"),
    body("latitude").optional().isFloat({ min: -90, max: 90 }).withMessage("Invalid latitude"),
    body("longitude").optional().isFloat({ min: -180, max: 180 }).withMessage("Invalid longitude"),
  ];
};

const listRules = [
  ...["district", "division", "q"].map((f) =>
    query(f).optional().isString().withMessage(`${f} must be text`).bail().isLength({ max: 80 })
  ),
  query("is24Hours").optional().isIn(["true", "false"]),
  query("hasBloodGroup").optional().isString().bail().custom(isBloodGroup).withMessage("Invalid blood group"),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 50 }),
];

const batchRules = [
  body("bloodGroup").custom(isBloodGroup).withMessage("Invalid blood group"),
  body("component").optional().isIn(COMPONENTS).withMessage(`Component must be one of: ${COMPONENTS.join(", ")}`),
  body("units").isInt({ min: 1, max: 1000 }).withMessage("Units must be a whole number between 1 and 1000"),
  body("collectedAt")
    .optional({ values: "falsy" })
    .isISO8601().withMessage("Invalid collection date").bail()
    .custom((v) => new Date(v) <= new Date()).withMessage("Collection date cannot be in the future"),
  body("expiresAt").optional({ values: "falsy" }).isISO8601().withMessage("Invalid expiry date"),
];

const inventoryListRules = [
  query("status").optional().isIn(["available", "reserved", "expired", "used"]),
  query("bloodGroup").optional().isString().bail().custom(isBloodGroup).withMessage("Invalid blood group"),
  query("component").optional().isIn(COMPONENTS),
  query("expiringInDays").optional().isInt({ min: 1, max: 365 }),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
];

const staffRules = [
  body("phone")
    .custom((v) => /^01[3-9]\d{8}$/.test(normalizePhone(v)))
    .withMessage("Enter a valid Bangladeshi mobile number"),
];

const DONATION_BACKDATE_DAYS = 30;

const donationRules = [
  ...staffRules,
  body("donatedAt")
    .optional({ values: "falsy" })
    .isISO8601().withMessage("Invalid donation date").bail()
    .custom((v) => new Date(v) <= new Date()).withMessage("Donation date cannot be in the future").bail()
    .custom((v) => {
      // Whole days, so a date-only value from 30 days ago still passes
      const cutoff = new Date(Date.now() - DONATION_BACKDATE_DAYS * 24 * 60 * 60 * 1000);
      cutoff.setUTCHours(0, 0, 0, 0);
      return new Date(v) >= cutoff;
    })
    .withMessage(`Donation date cannot be more than ${DONATION_BACKDATE_DAYS} days ago`),
  body("units").optional().isInt({ min: 1, max: 2 }).withMessage("Units must be 1 or 2").toInt(),
  body("addToStock").optional().isBoolean().withMessage("addToStock must be true or false").toBoolean(),
  body("component").optional().isIn(COMPONENTS).withMessage(`Component must be one of: ${COMPONENTS.join(", ")}`),
];

const lookupRules = [
  query("phone")
    .isString().withMessage("Phone number is required").bail()
    .custom((v) => /^01[3-9]\d{8}$/.test(normalizePhone(v)))
    .withMessage("Enter a valid Bangladeshi mobile number"),
];

const pageRules = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
];

// Banks
router.get("/", optionalAuth, listRules, validate, listBanks);
// Static paths must come before "/:id"
router.post("/apply", protect, requirePhone, bankFields(true), validate, applyForBank);
router.get("/mine", protect, getMyBank);
router.post("/", protect, authorize("admin"), bankFields(true), validate, createBank);
router.get("/:id", optionalAuth, ...checkId, getBank);
router.patch("/:id", protect, ...checkId, requireBankAccess, bankFields(false), validate, updateBank);

// Staff
router.get("/:id/staff", protect, ...checkId, requireBankAccess, listStaff);
router.post("/:id/staff", protect, authorize("admin"), ...checkId, staffRules, validate, assignStaff);
router.delete("/:id/staff/:userId", protect, authorize("admin"), ...checkId, userIdRule, validate, removeStaff);

// Inventory
router.get("/:id/stock", optionalAuth, ...checkId, getStock);
router.get("/:id/inventory", protect, ...checkId, requireBankAccess, inventoryListRules, validate, listBatches);
router.post("/:id/inventory", protect, ...checkId, requireVerifiedBankStaff, batchRules, validate, addBatch);
router.post(
  "/:id/inventory/:batchId/issue",
  protect, ...checkId, requireVerifiedBankStaff, batchIdRule,
  body("units").isInt({ min: 1, max: 1000 }).withMessage("Units must be a whole number"),
  validate,
  issueUnits
);
router.patch(
  "/:id/inventory/:batchId",
  protect, ...checkId, requireVerifiedBankStaff, batchIdRule,
  body("status").isIn(["available", "reserved", "expired"]).withMessage("Status must be available, reserved, or expired"),
  validate,
  setBatchStatus
);

// Donations
router.get("/:id/donors/lookup", protect, ...checkId, requireVerifiedBankStaff, lookupRules, validate, lookupDonor);
router.get("/:id/donations", protect, ...checkId, requireBankAccess, pageRules, validate, listBankDonations);
router.post("/:id/donations", protect, ...checkId, requireVerifiedBankStaff, donationRules, validate, recordDonation);

export default router;