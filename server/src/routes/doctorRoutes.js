import { Router } from "express";
import { body, query } from "express-validator";
import {
  listDoctors, applyDoctor, myDoctorProfile, updateMyDoctorProfile,
} from "../controllers/doctorController.js";
import { protect, authorize, requirePhone } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { DOCTOR_SPECIALTIES, DOCTOR_LANGUAGES, BMDC_PATTERN } from "../models/DoctorProfile.js";
import { canonicalDistrict } from "../utils/districts.js";

const router = Router();

const districtRule = (optional) => {
  const chain = body("district");
  return (optional ? chain.optional() : chain)
    .isString().withMessage("District is required").bail()
    .trim()
    .notEmpty().withMessage("District is required").bail()
    .custom((v) => !!canonicalDistrict(v)).withMessage("Choose a valid district");
};

const hospitalRule = (optional) => {
  const chain = body("hospital");
  return (optional ? chain.optional() : chain)
    .isString().withMessage("Hospital must be text").bail()
    .trim()
    .isLength({ min: 2, max: 120 }).withMessage("Hospital must be 2-120 characters");
};

const bioRule = body("bio")
  .optional({ values: "null" })
  .isString().withMessage("Bio must be text").bail()
  .trim()
  .isLength({ max: 500 }).withMessage("Bio must be at most 500 characters");

const languagesRule = [
  body("languages")
    .optional()
    .isArray({ min: 1, max: 2 }).withMessage("Choose at least one language"),
  body("languages.*").optional().isIn(DOCTOR_LANGUAGES).withMessage("Languages must be bn or en"),
];

router.get(
  "/",
  [
    query("specialty").optional().isIn(DOCTOR_SPECIALTIES).withMessage("Invalid specialty"),
    query("district").optional().isString().withMessage("district must be text").bail().isLength({ max: 60 }),
  ],
  validate,
  listDoctors
);

router.post(
  "/apply",
  protect,
  requirePhone,
  [
    body("bmdcNo")
      .isString().withMessage("BMDC registration number is required").bail()
      .trim()
      .isLength({ min: 3, max: 20 }).withMessage("BMDC registration number must be 3-20 characters").bail()
      .matches(BMDC_PATTERN).withMessage("BMDC registration number may only contain letters, digits and -"),
    body("specialty").isIn(DOCTOR_SPECIALTIES).withMessage("Choose a specialty"),
    hospitalRule(false),
    districtRule(false),
    bioRule,
    ...languagesRule,
  ],
  validate,
  applyDoctor
);

router.get("/me", protect, myDoctorProfile);

router.patch(
  "/me",
  protect,
  authorize("doctor"),
  [
    bioRule,
    hospitalRule(true),
    districtRule(true),
    ...languagesRule,
    body("acceptingQuestions").optional().isBoolean({ strict: true }).withMessage("acceptingQuestions must be true or false"),
    body()
      .custom((b) => ["bio", "hospital", "district", "languages", "acceptingQuestions"].some((k) => b[k] !== undefined))
      .withMessage("Nothing to update"),
  ],
  validate,
  updateMyDoctorProfile
);

export default router;
