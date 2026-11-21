// server/src/controllers/parseController.js
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseBloodRequestText } from "../services/aiParser.js";

// Returns a DRAFT only. Nothing is saved; the user reviews the fields and then
// submits them through the normal POST /api/requests.
export const parseRequestText = asyncHandler(async (req, res) => {
  const result = await parseBloodRequestText(req.body.text);
  res.json({ success: true, ...result, needsReview: true });
});