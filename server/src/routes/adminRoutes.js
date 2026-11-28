import { Router } from "express";
import { body, param, query } from "express-validator";
import {
  getStats, listUsers, updateUser, listAllBanks, setBankApproval, listAllDonors, getDonorDonations,
  listDoctorApplications, reviewDoctor,
} from "../controllers/adminController.js";
import { setVisibility } from "../controllers/consultationController.js";
import { adminResetTwoFactor } from "../controllers/twoFactorController.js";
import { DOCTOR_STATUSES } from "../models/DoctorProfile.js";
import { protect, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { BLOOD_GROUPS, normalizeBloodGroup } from "../utils/bloodGroup.js";

const router = Router();

router.use(protect, authorize("admin")); // every route here is admin-only

const pageRules = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("q").optional().isString().withMessage("q must be text").bail().isLength({ max: 80 }),
];
const idRule = param("id").isMongoId().withMessage("Invalid id");

router.get("/stats", getStats);

router.get(
  "/users",
  [
    ...pageRules,
    query("role").optional().isIn(["user", "bank_staff", "admin", "doctor"]),
    query("status").optional().isIn(["active", "inactive"]),
  ],
  validate,
  listUsers
);

router.patch(
  "/users/:id",
  [
    idRule,
    body("role").optional().isIn(["user", "admin"]).withMessage("Role must be user or admin (assign bank staff from a blood bank)"),
    body("isActive").optional().isBoolean({ strict: true }).withMessage("isActive must be true or false"),
    body().custom((b) => b.role !== undefined || b.isActive !== undefined).withMessage("Nothing to update"),
  ],
  validate,
  updateUser
);

router.get(
  "/banks",
  [...pageRules, query("status").optional().isIn(["pending", "approved"])],
  validate,
  listAllBanks
);

router.patch(
  "/banks/:id/approval",
  [idRule, body("isApproved").isBoolean({ strict: true }).withMessage("isApproved must be true or false")],
  validate,
  setBankApproval
);

router.get(
  "/donors",
  [
    ...pageRules,
    query("verified").optional().isIn(["true", "false"]),
    query("bloodGroup")
      .optional()
      .isString()
      .bail()
      .custom((v) => BLOOD_GROUPS.includes(normalizeBloodGroup(v)))
      .withMessage("Invalid blood group"),
  ],
  validate,
  listAllDonors
);
router.get("/donors/:id/donations", [idRule], validate, getDonorDonations);
router.post("/users/:id/reset-2fa", [idRule], validate, adminResetTwoFactor);

router.get(
  "/doctors",
  [...pageRules, query("status").optional().isIn(DOCTOR_STATUSES).withMessage("Invalid status")],
  validate,
  listDoctorApplications
);

router.patch(
  "/doctors/:id",
  [
    idRule,
    body("status").isIn(["approved", "rejected", "suspended"]).withMessage("Status must be approved, rejected or suspended"),
    body("reviewNote")
      .optional({ values: "null" })
      .isString().withMessage("Note must be text").bail()
      .trim()
      .isLength({ max: 300 }).withMessage("Note must be at most 300 characters"),
  ],
  validate,
  reviewDoctor
);

router.patch(
  "/consultations/:id/visibility",
  [idRule, body("hiddenFromPublic").isBoolean({ strict: true }).withMessage("hiddenFromPublic must be true or false")],
  validate,
  setVisibility
);

export default router;
