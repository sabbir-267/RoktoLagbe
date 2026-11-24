import { Router } from "express";
import { body, param, query } from "express-validator";
import rateLimit from "express-rate-limit";
import {
  startConversation, listConversations, unreadCount, getConversation, sendMessage, markRead, setBlocked,
} from "../controllers/messageController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();
router.use(protect); // every chat route needs a login

// Limits run after protect, so they count per account rather than per IP
const perUser = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user._id),
    message: { success: false, message },
  });

const startLimiter = perUser(60 * 60 * 1000, Number(process.env.CHAT_START_LIMIT) || 30,
  "You've started a lot of new chats. Please try again later.");
const sendLimiter = perUser(60 * 1000, Number(process.env.CHAT_SEND_LIMIT) || 30,
  "You're sending messages too fast. Please slow down.");

const idRule = param("id").isMongoId().withMessage("Invalid conversation id");

router.get("/conversations", listConversations);
router.get("/unread-count", unreadCount);

router.post(
  "/conversations",
  startLimiter,
  [
    body(["userId", "donorId", "requestId"]).optional().isMongoId().withMessage("Invalid id"),
    body()
      .custom((b) => ["userId", "donorId", "requestId"].filter((k) => b[k] !== undefined).length === 1)
      .withMessage("Send exactly one of userId, donorId or requestId"),
  ],
  validate,
  startConversation
);

router.get(
  "/conversations/:id",
  [
    idRule,
    query("before").optional().isISO8601().withMessage("before must be a date"),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  getConversation
);

router.post(
  "/conversations/:id/messages",
  sendLimiter,
  [
    idRule,
    body("text")
      .isString().withMessage("Message must be text").bail()
      .trim().isLength({ min: 1, max: 2000 }).withMessage("Messages must be 1-2000 characters"),
  ],
  validate,
  sendMessage
);

router.patch("/conversations/:id/read", [idRule], validate, markRead);

router.patch(
  "/conversations/:id/block",
  [idRule, body("blocked").isBoolean({ strict: true }).withMessage("blocked must be true or false")],
  validate,
  setBlocked
);

export default router;
