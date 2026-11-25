import { Router } from "express";
import mongoose from "mongoose";
import { emailMode } from "../services/emailService.js";

const router = Router();

router.get("/", (req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    success: true,
    app: "Rokto Lagbe API",
    uptime: process.uptime(),
    database: states[mongoose.connection.readyState],
    email: emailMode(), // "relay" | "smtp" | "off" (never the settings themselves)
    timestamp: new Date().toISOString(),
  });
});

export default router;