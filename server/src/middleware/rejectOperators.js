// server/src/middleware/rejectOperators.js
//
// Rejects JSON bodies that contain MongoDB operator keys ("$ne", "$gt", ...),
// dotted keys ("a.b"), or prototype-pollution keys. Our own bodies never need
// any of these, so an unexpected one is either a mistake or an attack.
//
// Only the body is checked. Query strings are safe already: Express 5 does not
// turn "district[$ne]=x" into an object, and every query field we read is
// type-checked before it reaches the database.

import { ApiError } from "../utils/ApiError.js";

const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_DEPTH = 10;

export const hasUnsafeKeys = (value, depth = 0) => {
  if (value === null || typeof value !== "object") return false;
  if (depth > MAX_DEPTH) return true; // absurdly deep nesting is rejected outright

  if (Array.isArray(value)) return value.some((item) => hasUnsafeKeys(item, depth + 1));

  return Object.keys(value).some(
    (key) => key.startsWith("$") || key.includes(".") || BAD_KEYS.has(key) || hasUnsafeKeys(value[key], depth + 1)
  );
};

export const rejectOperators = (req, res, next) => {
  if (hasUnsafeKeys(req.body)) return next(new ApiError(400, "Invalid request body"));
  next();
};