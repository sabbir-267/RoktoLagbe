import jwt from "jsonwebtoken";

// Session token. `mfa: true` records that the second step (authenticator code) was passed;
// accounts that require two-step verification can't use a session without it (middleware/auth.js).
export const signToken = (user, { mfa = false } = {}) =>
  jwt.sign({ id: user._id, role: user.role, ...(mfa ? { mfa: true } : {}) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// Short-lived ticket between "password OK" and "code OK". It is NOT a session: auth.js rejects it.
const CHALLENGE_TYP = "2fa-challenge";
export const signChallenge = (user) =>
  jwt.sign({ id: user._id, typ: CHALLENGE_TYP }, process.env.JWT_SECRET, { expiresIn: "10m" });

export const readChallenge = (token) => {
  try {
    const decoded = jwt.verify(String(token || ""), process.env.JWT_SECRET);
    return decoded.typ === CHALLENGE_TYP ? decoded : null;
  } catch {
    return null;
  }
};
