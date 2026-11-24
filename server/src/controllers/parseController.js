// server/src/controllers/parseController.js
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseBloodRequestText } from "../services/aiParser.js";
import { parseWithRules } from "../services/ruleParser.js";

// PARSER_ENGINE: "auto" (default) uses the AI when ANTHROPIC_API_KEY is set and the free
// rule-based parser otherwise, or whenever the AI call fails. "rules" never calls the AI;
// "ai" never falls back.
const engineSetting = () => (process.env.PARSER_ENGINE || "auto").toLowerCase();

// Returns a DRAFT only. Nothing is saved; the user reviews the fields and then
// submits them through the normal POST /api/requests.
export const parseRequestText = asyncHandler(async (req, res) => {
  const setting = engineSetting();
  const useAi = setting === "ai" || (setting === "auto" && Boolean(process.env.ANTHROPIC_API_KEY));

  if (useAi) {
    try {
      const result = await parseBloodRequestText(req.body.text);
      return res.json({ success: true, ...result, engine: "ai", needsReview: true });
    } catch (err) {
      if (setting === "ai") throw err;
      console.error("AI parse unavailable, using the free parser instead:", err.message);
    }
  }

  const result = parseWithRules(req.body.text);
  res.json({ success: true, ...result, engine: "rules", needsReview: true });
});
