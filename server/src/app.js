import express from "express";
import { applySecurity } from "./config/security.js";
import healthRoutes from "./routes/healthRoutes.js";
import avatarRoutes from "./routes/avatarRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import donorRoutes from "./routes/donorRoutes.js";
import bankRoutes from "./routes/bankRoutes.js";
import requestRoutes from "./routes/requestRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import assistantRoutes from "./routes/assistantRoutes.js";
import complaintRoutes from "./routes/complaintRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import consultationRoutes from "./routes/consultationRoutes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();

applySecurity(app); // helmet, CORS, rate limit, body limits, operator rejection, logging

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/avatars", avatarRoutes);
app.use("/api/donors", donorRoutes);
app.use("/api/banks", bankRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/consultations", consultationRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;