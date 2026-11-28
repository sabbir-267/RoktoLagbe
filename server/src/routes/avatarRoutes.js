import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { getAvatar, uploadAvatar, removeAvatar, AVATAR_MAX_BYTES } from "../controllers/avatarController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

// Counted per account (runs after protect)
const changeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user._id),
  message: { success: false, message: "You've changed your picture a lot. Please try again later." },
});

const imageBody = express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: AVATAR_MAX_BYTES });

router.put("/me", protect, changeLimiter, imageBody, uploadAvatar);
router.delete("/me", protect, changeLimiter, removeAvatar);
router.get("/:userId", getAvatar);

export default router;
