// server/src/scripts/helpers/twoFactorLogin.js
//
// Test helper: logs in through the API and, for accounts that need two-step verification
// (admin / doctor / bank staff), completes the second step with a code computed from the
// account's secret in the database.
//   - Throwaway test accounts (name starting "ZZ ") without a setup get a test secret.
//   - Real accounts must already have set up two-step verification; the helper only reads it.

import jwt from "jsonwebtoken";
import User from "../../models/User.js";
import { generateSecret, totpAt, currentStep } from "../../utils/totp.js";
import { seal, open } from "../../utils/secretBox.js";

export const loginThrough2fa = async (api, body) => {
  const first = await api("POST", "/api/auth/login", null, body);
  if (first.status !== 200 || !first.data?.twoFactor) return first;

  const { id } = jwt.decode(first.data.challenge);
  const user = await User.findById(id).select("+twoFactor.secret");
  let secret;
  if (user.twoFactor?.enabled && user.twoFactor.secret) {
    secret = open(user.twoFactor.secret);
  } else if (/^ZZ /.test(user.name)) {
    secret = generateSecret();
    user.set("twoFactor", { enabled: true, enabledAt: new Date(), secret: seal(secret), backupCodes: [] });
    await user.save();
  } else {
    throw new Error(`${user.name} must set up two-step verification on the website before tests can log in as them`);
  }

  // A code can be used once per 30 s; if this one was just used, the next one is accepted too
  const step = currentStep();
  for (const s of [step, step + 1]) {
    const r = await api("POST", "/api/auth/2fa/verify", null, { challenge: first.data.challenge, code: totpAt(secret, s) });
    if (r.status === 200) return r;
    if (!/already used/.test(r.data?.message || "")) return r;
  }
  return { status: 400, data: { message: "Could not complete two-step verification" } };
};
