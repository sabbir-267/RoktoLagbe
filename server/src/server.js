import "dotenv/config"; // must be first so env vars load before other imports use them
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { startExpirySweep } from "./services/inventoryService.js";

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
};

await connectDB();
    startExpirySweep();
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

start();