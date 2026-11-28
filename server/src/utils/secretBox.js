// utils/secretBox.js
// Encrypts small secrets (two-step verification keys) before they are stored in the database.
// Key: TWO_FACTOR_KEY if set, otherwise derived from JWT_SECRET. Changing it makes existing
// two-step setups unreadable (an admin can then reset them so people set up again).
import crypto from "node:crypto";

const key = () =>
  crypto.createHash("sha256").update(process.env.TWO_FACTOR_KEY || `${process.env.JWT_SECRET}:two-factor`).digest();

export const seal = (text) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
};

export const open = (sealed) => {
  const [iv, tag, enc] = String(sealed).split(".").map((s) => Buffer.from(s, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
};
