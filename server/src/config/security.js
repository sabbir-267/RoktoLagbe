// server/src/config/security.js
//
// Everything that protects the API as a whole, in one place:
//   - helmet security headers
//   - CORS limited to the origins in CLIENT_URL (comma-separated, so you can
//     list production and preview frontends)
//   - a global per-IP rate limit (sensitive routes also have their own limits)
//   - small JSON bodies (100 kb), Express 5 empty-body fix, operator rejection
//   - request logging
//
// Behind a hosting proxy (Render, Railway, Fly...) "trust proxy" must be on,
// otherwise every visitor looks like the same IP and the rate limiter blocks
// everyone together. It is enabled automatically when NODE_ENV=production
// and assumes ONE proxy in front of the app.

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { rejectOperators } from "../middleware/rejectOperators.js";

export const parseOrigins = (value = "") =>
  String(value)
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);

export const applySecurity = (app, options = {}) => {
  const env = options.env ?? process.env.NODE_ENV;
  const production = env === "production";
  const allowed = parseOrigins(options.clientUrls ?? process.env.CLIENT_URL);
  // Mobile networks often put many users behind one IP, so the global limit is generous.
  // Per-user limits protect the sensitive actions instead.
  const globalLimit = options.globalLimit ?? (Number(process.env.GLOBAL_RATE_LIMIT) || (production ? 600 : 5000));

  if (production) app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      // Requests with no Origin header (Postman, curl, server-to-server) are allowed.
      // Browsers always send one, and only the listed origins get CORS headers.
      origin: (origin, callback) => callback(null, !origin || allowed.includes(origin)),
      credentials: true,
    })
  );
  app.use(morgan(production ? "combined" : "dev"));

  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: globalLimit,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => req.path === "/health", // so uptime monitors never get blocked
      message: { success: false, message: "Too many requests, please slow down" },
    })
  );

  app.use(express.json({ limit: "100kb" }));
  app.use((req, res, next) => {
    req.body ??= {}; // Express 5 leaves req.body undefined when no body is sent
    next();
  });
  app.use(rejectOperators);
};