import "dotenv/config"; // must be first so env vars load before other imports use them
import mongoose from "mongoose";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { checkEnv } from "./config/env.js";
import { startExpirySweep } from "./services/inventoryService.js";
import { startRequestExpirySweep } from "./services/requestService.js";
import { initSocket } from "./services/socket.js";

const PORT = process.env.PORT || 5000;

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

const start = async () => {
  try {
    checkEnv(); // exits with a clear message if the configuration is unsafe
    await connectDB();
    startExpirySweep();
    startRequestExpirySweep();

    const server = app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
    initSocket(server); // real-time chat on the same port

    // Hosting platforms send SIGTERM on every deploy: finish in-flight requests, then exit cleanly
    const shutdown = (signal) => {
      console.log(`${signal} received, shutting down`);
      server.close(async () => {
        await mongoose.disconnect();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
};

start();