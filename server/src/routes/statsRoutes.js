import { Router } from "express";
import DonorProfile from "../models/DonorProfile.js";
import BloodBank from "../models/BloodBank.js";
import BloodRequest from "../models/BloodRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { eligibleCutoff } from "../utils/eligibility.js";

const router = Router();

// Public headline numbers for the home page. Cached briefly so a busy home page
// doesn't run these counts on every visit.
const CACHE_MS = 60 * 1000;
let cached = null;

router.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!cached || Date.now() - cached.at > CACHE_MS) {
      const [donors, availableDonors, banks, fulfilled, open, districts] = await Promise.all([
        DonorProfile.countDocuments(),
        DonorProfile.countDocuments({
          isAvailable: true,
          $or: [{ lastDonationDate: null }, { lastDonationDate: { $lte: eligibleCutoff() } }],
        }),
        BloodBank.countDocuments({ isApproved: true }),
        BloodRequest.countDocuments({ status: "fulfilled" }),
        BloodRequest.countDocuments({ status: { $in: ["open", "in_progress"] } }),
        DonorProfile.distinct("district"),
      ]);
      cached = {
        at: Date.now(),
        stats: { donors, availableDonors, banks, fulfilled, open, districts: districts.length },
      };
    }
    res.set("Cache-Control", "public, max-age=60");
    res.json({ success: true, stats: cached.stats });
  })
);

export default router;
