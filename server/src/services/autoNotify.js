// server/src/services/autoNotify.js
//
// Runs when a blood request is posted: alerts the best matching donors without the
// requester having to press "Notify". Uses notifyDonors(), so every safeguard there
// still applies (compatible, available, eligible, active account, never the requester,
// at most 20 per request, at most one alert per donor per 24 hours).
//
//   - How many donors depends on urgency (more for critical requests).
//   - Urgent requests with nobody in the district also look in other districts.
//   - Urgent requests also email a few of the alerted donors (verified email, opted in),
//     in the background, because free email quotas are small (~100/day).
//   - The requester gets a notification saying how many donors were alerted.
//
// AUTO_NOTIFY=false turns it off (the manual "Notify" button keeps working).

import BloodRequest from "../models/BloodRequest.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { notifyDonors } from "./matchingService.js";
import { emitToUser } from "./socket.js";
import { emailAvailable, sendDonorAlertEmail } from "./emailService.js";

const LIMIT_BY_URGENCY = { critical: 10, high: 8, medium: 5, low: 3 };
const EMAIL_BY_URGENCY = { critical: 5, high: 3 }; // medium/low: in-app only
const URGENT = ["critical", "high"];

export const autoNotifyEnabled = () => (process.env.AUTO_NOTIFY || "true").toLowerCase() !== "false";

const emailDonors = async (request, donors) => {
  const max = EMAIL_BY_URGENCY[request.urgency] || 0;
  if (!max || !donors.length || !emailAvailable()) return 0;

  const optedIn = donors.filter((d) => d.emailAlerts !== false);
  const users = await User.find({
    _id: { $in: optedIn.map((d) => d.user._id) },
    isActive: true,
    isEmailVerified: true,
    email: { $exists: true, $ne: "" },
  }).select("name email");

  let sent = 0;
  for (const u of users.slice(0, max)) {
    try {
      await sendDonorAlertEmail(u.email, u.name, request);
      sent++;
    } catch (err) {
      console.error("Donor alert email failed:", err.message); // never the address
    }
  }
  return sent;
};

// Returns { notified, widened } quickly; emails continue in the background
export const autoNotifyForRequest = async (request) => {
  if (!autoNotifyEnabled()) return { notified: 0, widened: false, skipped: true };

  const limit = LIMIT_BY_URGENCY[request.urgency] || 5;
  let result = await notifyDonors(request, { limit });
  let widened = false;

  // Nobody nearby for an urgent request: look further, but alert fewer people
  if (!result.notified.length && URGENT.includes(request.urgency)) {
    const fresh = await BloodRequest.findById(request._id); // matchedDonors changed
    result = await notifyDonors(fresh, { limit: Math.ceil(limit / 2), includeOtherDistricts: true });
    widened = result.notified.length > 0;
  }

  const notified = result.notified.length;
  await BloodRequest.updateOne(
    { _id: request._id },
    { $set: { autoNotify: { at: new Date(), notified, widened, emailed: 0 } } }
  );

  await Notification.create({
    user: request.requester,
    type: "request_update",
    title: notified ? `${notified} matching donor${notified === 1 ? "" : "s"} alerted` : "No matching donors available right now",
    message: notified
      ? `We alerted ${notified} compatible donor${notified === 1 ? "" : "s"}${widened ? " (including nearby districts)" : ` in ${request.district}`} about your ${request.bloodGroup} request. You'll be notified when someone responds.`
      : `No available, eligible ${request.bloodGroup}-compatible donors were found yet. Share your request, check blood banks, or try "Notify donors" again later.`,
    relatedRequest: request._id,
  });
  emitToUser(request.requester, "notification:new", { type: "request_update", requestId: request._id });

  // Email alerts can take a few seconds each: don't make the requester wait
  if (notified && URGENT.includes(request.urgency)) {
    emailDonors(request, result.notifiedDonors)
      .then((emailed) => emailed && BloodRequest.updateOne({ _id: request._id }, { $set: { "autoNotify.emailed": emailed } }))
      .catch((err) => console.error("Donor alert emails failed:", err.message));
  }

  return { notified, widened };
};
