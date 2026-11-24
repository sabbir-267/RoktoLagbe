import { Router } from "express";
import { param, query } from "express-validator";
import { listMine, unreadCount, markRead, markAllRead } from "../controllers/notificationController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.use(protect); // every notification route needs a login

router.get(
  "/",
  [
    query("unread").optional().isIn(["true", "false"]),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  listMine
);
router.get("/unread-count", unreadCount);
router.patch("/read-all", markAllRead);
router.patch("/:id/read", param("id").isMongoId().withMessage("Invalid notification id"), validate, markRead);

export default router;