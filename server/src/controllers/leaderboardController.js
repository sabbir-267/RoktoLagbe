import Donation from "../models/Donation.js";
import DonorProfile from "../models/DonorProfile.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { normalizeBloodGroup } from "../utils/bloodGroup.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Bangladesh time (UTC+6, no daylight saving), so "this month" flips at local midnight
const BD_OFFSET_MS = 6 * 60 * 60 * 1000;
const periodStart = (period) => {
  if (period === "all") return null;
  const local = new Date(Date.now() + BD_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = period === "month" ? local.getUTCMonth() : 0;
  return new Date(Date.UTC(y, m, 1) - BD_OFFSET_MS);
};

// GET /api/donors/leaderboard?period=month|year|all&district=&bloodGroup=&limit=
// Only donations recorded and verified by a blood bank count, so nobody can raise their own score.
export const getLeaderboard = asyncHandler(async (req, res) => {
  const period = req.query.period || "year";
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 3), 100);
  const since = periodStart(period);

  const match = { status: "verified" };
  if (since) match.donatedAt = { $gte: since };

  const donorFilter = { "d.showOnLeaderboard": { $ne: false } };
  if (typeof req.query.district === "string" && req.query.district.trim()) {
    donorFilter["d.district"] = new RegExp(`^${escapeRegex(req.query.district.trim())}$`, "i");
  }
  if (req.query.bloodGroup) donorFilter["d.bloodGroup"] = normalizeBloodGroup(req.query.bloodGroup);

  // Every ranked donor, best first. The number of donors is small enough to rank in one pass.
  const ranked = await Donation.aggregate([
    { $match: match },
    { $group: { _id: "$donor", donations: { $sum: 1 }, units: { $sum: "$units" }, lastAt: { $max: "$donatedAt" } } },
    { $lookup: { from: "donorprofiles", localField: "_id", foreignField: "_id", as: "d" } },
    { $unwind: "$d" },
    { $match: donorFilter },
    { $lookup: { from: "users", localField: "d.user", foreignField: "_id", as: "u" } },
    { $unwind: "$u" },
    { $match: { "u.isActive": { $ne: false } } },
    // Ties: more units first, then whoever reached the score earlier
    { $sort: { donations: -1, units: -1, lastAt: 1 } },
    { $limit: 5000 },
    {
      $project: {
        donations: 1, units: 1, lastAt: 1,
        userId: "$u._id", name: "$u.name", avatar: "$u.avatar",
        bloodGroup: "$d.bloodGroup", district: "$d.district", isVerified: "$d.isVerified",
      },
    },
  ]);

  // Standard competition ranking: equal scores share a rank (1, 2, 2, 4)
  let rank = 0;
  const rows = ranked.map((r, i) => {
    const prev = ranked[i - 1];
    if (!prev || prev.donations !== r.donations || prev.units !== r.units) rank = i + 1;
    return {
      rank,
      donorId: r._id,
      name: r.name,
      avatar: r.avatar,
      bloodGroup: r.bloodGroup,
      district: r.district,
      isVerified: !!r.isVerified,
      donations: r.donations,
      units: r.units,
      lastDonationAt: r.lastAt,
      _userId: String(r.userId),
    };
  });

  let me = null;
  if (req.user) {
    const mine = rows.find((r) => r._userId === String(req.user._id));
    if (mine) {
      me = { rank: mine.rank, donations: mine.donations, units: mine.units, onBoard: true };
    } else {
      const profile = await DonorProfile.findOne({ user: req.user._id }).select("showOnLeaderboard");
      me = profile ? { rank: null, donations: 0, units: 0, onBoard: false, optedOut: profile.showOnLeaderboard === false } : null;
    }
  }

  // The user id is only used above to find "me"; it is never sent to the browser
  const strip = (r) => {
    const out = { ...r };
    delete out._userId;
    return out;
  };
  res.json({
    success: true,
    period,
    since,
    totals: {
      donors: rows.length,
      donations: rows.reduce((n, r) => n + r.donations, 0),
      units: rows.reduce((n, r) => n + r.units, 0),
    },
    leaders: rows.slice(0, limit).map(strip),
    me,
  });
});
