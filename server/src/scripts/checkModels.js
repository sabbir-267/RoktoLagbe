import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import DonorProfile from "../models/DonorProfile.js";
import BloodBank from "../models/BloodBank.js";
import InventoryBatch from "../models/InventoryBatch.js";
import BloodRequest from "../models/BloodRequest.js";
import Donation from "../models/Donation.js";
import Notification from "../models/Notification.js";

const models = [User, DonorProfile, BloodBank, InventoryBatch, BloodRequest, Donation, Notification];

try {
  await connectDB();
  for (const m of models) {
    await m.init(); // builds indexes
    console.log(`✔ ${m.modelName} ready`);
  }

  // Geo sanity test: saving WITHOUT coordinates must not throw
  const bank = await BloodBank.create({ name: "Test Bank", phone: "01700000000", district: "Dhaka" });
  console.log("✔ Geo-less document saved (geo fix works)");
  await BloodBank.deleteOne({ _id: bank._id });
} catch (err) {
  console.error("❌", err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}