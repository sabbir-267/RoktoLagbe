import BloodRequest from "../models/BloodRequest.js";

export const REQUEST_GRACE_MS = 24 * 60 * 60 * 1000;

export const expireStaleRequests = async () => {
  const res = await BloodRequest.updateMany(
    {
      status: { $in: ["open", "in_progress"] },
      neededBy: { $lte: new Date(Date.now() - REQUEST_GRACE_MS) },
    },
    { $set: { status: "expired" } }
  );
  return res.modifiedCount;
};

export const startRequestExpirySweep = (intervalMs = 60 * 60 * 1000) => {
  const run = async () => {
    try {
      const n = await expireStaleRequests();
      if (n) console.log(`🗓️  Marked ${n} request(s) as expired`);
    } catch (err) {
      console.error("Request expiry sweep failed:", err.message);
    }
  };
  run();
  setInterval(run, intervalMs).unref();
};