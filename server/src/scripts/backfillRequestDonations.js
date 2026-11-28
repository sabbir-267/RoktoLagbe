// server/src/scripts/backfillRequestDonations.js
//
// One-off repair: requests marked "fulfilled" before donations were recorded automatically.
// For every fulfilled request, each donor who said yes and has no recorded donation for it gets
// one (dated when the request was fulfilled): last donation date, history, total and leaderboard.
//
//   node src/scripts/backfillRequestDonations.js           dry run, changes nothing
//   node src/scripts/backfillRequestDonations.js --apply   records the donations

import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import BloodRequest from "../models/BloodRequest.js";
import DonorProfile from "../models/DonorProfile.js";
import { recordRequestDonation } from "../controllers/requestDonationController.js";

const APPLY = process.argv.includes("--apply");
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "-");

await connectDB();
let found = 0;
let done = 0;
try {
  const requests = await BloodRequest.find({
    status: "fulfilled",
    matchedDonors: { $elemMatch: { response: "accepted", donation: { $exists: false } } },
  });
  for (const r of requests) {
    for (const m of r.matchedDonors) {
      if (m.response !== "accepted" || m.donation) continue;
      found += 1;
      const p = await DonorProfile.findById(m.donor).populate("user", "name").lean();
      const label = `request ${r._id} (${r.bloodGroup}, fulfilled ${day(r.updatedAt)}) → donor ${p?.user?.name || m.donor} (last ${day(p?.lastDonationDate)}, total ${p?.totalDonations ?? 0})`;
      if (!p) {
        console.log(`skip  ${label}: donor profile no longer exists`);
        continue;
      }
      if (!APPLY) {
        console.log(`would record  ${label}`);
        continue;
      }
      try {
        const { fresh } = await recordRequestDonation(r, m.donor, r.updatedAt, r.requester);
        done += 1;
        console.log(`recorded  ${label} ⇒ last ${day(fresh.lastDonationDate)}, total ${fresh.totalDonations}`);
      } catch (err) {
        console.log(`failed  ${label}: ${err.message}`);
      }
    }
  }
  console.log(APPLY ? `\n${done} of ${found} donations recorded.` : `\nDry run: ${found} donation(s) would be recorded. Run with --apply to record them.`);
} finally {
  await mongoose.disconnect();
}
