// server/src/services/smsService.js
//
// The one place that sends text messages. Out of the box it only prints the
// message to the server console, which is enough for development.
//
// For production, connect a Bangladeshi SMS gateway inside sendViaProvider()
// and set SMS_ENABLED=true in .env. Until then, password reset reports
// "not available" in production instead of pretending to send a code.

import { ApiError } from "../utils/ApiError.js";

const isProd = () => process.env.NODE_ENV === "production";

export const smsAvailable = () => !isProd() || process.env.SMS_ENABLED === "true";

// TODO(production): call your SMS provider's HTTP API here.
// eslint-disable-next-line no-unused-vars
const sendViaProvider = async (to, message) => {
  throw new ApiError(503, "No SMS provider is connected on this server");
};

export const sendSms = async (to, message) => {
  if (!isProd()) {
    console.log(`📱 [DEV SMS to ${to}] ${message}`);
    return;
  }
  await sendViaProvider(to, message);
};
