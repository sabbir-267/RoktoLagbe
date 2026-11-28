// utils/totp.js
// Time-based one-time passwords (RFC 6238), the 6-digit codes shown by authenticator apps
// (Google Authenticator, Microsoft Authenticator, Authy, ...). No external service is involved.
import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const STEP_SECONDS = 30;
const DIGITS = 6;

export const base32Encode = (buf) => {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
};

export const base32Decode = (str) => {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
};

export const generateSecret = () => base32Encode(crypto.randomBytes(20)); // 160 bits

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

export const totpAt = (secret, step) => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return String(code).padStart(DIGITS, "0");
};

// Returns the matching time step (allowing one step of clock drift either way), or null
export const verifyTotp = (secret, code, now = Date.now()) => {
  const clean = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const step = currentStep(now);
  for (const s of [step, step - 1, step + 1]) {
    const expected = totpAt(secret, s);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) return s;
  }
  return null;
};

export const otpauthUrl = ({ secret, account, issuer = "RoktoLagbe" }) =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}` +
  `&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
