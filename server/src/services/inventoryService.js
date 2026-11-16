import mongoose from "mongoose";
import InventoryBatch from "../models/InventoryBatch.js";

// Public-safe totals of usable stock for one bank
export const stockSummary = async (bankId) => {
  const rows = await InventoryBatch.aggregate([
    {
      $match: {
        bloodBank: new mongoose.Types.ObjectId(String(bankId)),
        status: "available",
        units: { $gt: 0 },
        expiresAt: { $gt: new Date() },
      },
    },
    { $group: { _id: { bloodGroup: "$bloodGroup", component: "$component" }, units: { $sum: "$units" } } },
    { $sort: { "_id.bloodGroup": 1, "_id.component": 1 } },
  ]);
  return rows.map((r) => ({ bloodGroup: r._id.bloodGroup, component: r._id.component, units: r.units }));
};

export const expireStaleBatches = async () => {
  const res = await InventoryBatch.updateMany(
    { status: { $in: ["available", "reserved"] }, expiresAt: { $lte: new Date() } },
    { $set: { status: "expired" } }
  );
  return res.modifiedCount;
};

export const startExpirySweep = (intervalMs = 60 * 60 * 1000) => {
  const run = async () => {
    try {
      const n = await expireStaleBatches();
      if (n) console.log(`🗓️  Marked ${n} batch(es) as expired`);
    } catch (err) {
      console.error("Expiry sweep failed:", err.message);
    }
  };
  run();
  setInterval(run, intervalMs).unref();
};