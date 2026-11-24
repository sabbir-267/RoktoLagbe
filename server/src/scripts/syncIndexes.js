import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";

try {
  await connectDB();
  await User.syncIndexes();
  const idx = await User.collection.indexes();
  console.log(JSON.stringify(idx, null, 2));
} catch (err) {
  console.error("❌", err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}