import { Router } from "express";
import { body, query } from "express-validator";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { chat, getWelcome } from "../controllers/assistantController.js";
import { optionalAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

// Per account when logged in, per IP for guests (AI replies cost money)
const chatLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: Number(process.env.ASSISTANT_LIMIT) || 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `user:${req.user._id}` : `ip:${ipKeyGenerator(req.ip)}`),
  message: { success: false, message: "You're sending messages too fast. Please wait a few minutes." },
});

router.get("/welcome", [query("lang").optional().isIn(["en", "bn"])], validate, getWelcome);

router.post(
  "/chat",
  optionalAuth,
  chatLimiter,
  [
    body("message").isString().withMessage("Message must be text").bail().trim().isLength({ min: 1, max: 1000 }).withMessage("Messages must be 1-1000 characters"),
    body("lang").optional().isIn(["en", "bn"]),
    body("history").optional().isArray({ max: 24 }).withMessage("History is too long"),
    body("history.*.role").isIn(["user", "assistant"]),
    body("history.*.content").isString().bail().isLength({ max: 4000 }),
    body("history.*.intent").optional({ values: "null" }).isString().isLength({ max: 60 }),
  ],
  validate,
  chat
);

export default router;
