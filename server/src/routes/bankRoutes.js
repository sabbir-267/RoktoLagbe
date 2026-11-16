import { Router } from "express";
import { body, param, query } from "express-validator";
import {
  createBank, listBanks, getBank, updateBank, listStaff, assignStaff, removeStaff,
} from "../controllers/bankController.js";
import {
  getStock, addBatch, listBatches, issueUnits, setBatchStatus,
} from "../controllers/inventoryController.js";
import { protect, optionalAuth, authorize } from "../middleware/auth.js";
import { requireBankAccess } from "../middleware/bankAccess.js";
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
    opt(body("district")).isString().trim().notEmpty().isLength({ max: 80 }).withMessage("District is required"),
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

// Banks
router.get("/", optionalAuth, listRules, validate, listBanks);
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
router.post("/:id/inventory", protect, ...checkId, requireBankAccess, batchRules, validate, addBatch);
router.post(
  "/:id/inventory/:batchId/issue",
  protect, ...checkId, requireBankAccess, batchIdRule,
  body("units").isInt({ min: 1, max: 1000 }).withMessage("Units must be a whole number"),
  validate,
  issueUnits
);
router.patch(
  "/:id/inventory/:batchId",
  protect, ...checkId, requireBankAccess, batchIdRule,
  body("status").isIn(["available", "reserved", "expired"]).withMessage("Status must be available, reserved, or expired"),
  validate,
  setBatchStatus
);

export default router;