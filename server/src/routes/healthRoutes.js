import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

router.get("/", (req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    success: true,
    app: "Rokto Lagbe API",
    uptime: process.uptime(),
    database: states[mongoose.connection.readyState],
    timestamp: new Date().toISOString(),
  });
});

export default router;