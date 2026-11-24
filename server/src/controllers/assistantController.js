// server/src/controllers/assistantController.js
import { asyncHandler } from "../utils/asyncHandler.js";
import { replyOffline, welcome } from "../chatbot/engine.js";
import { replyWithClaude } from "../chatbot/claudeAssistant.js";

// ASSISTANT_ENGINE: "auto" (default) uses Claude when ANTHROPIC_API_KEY is set and the
// free offline assistant otherwise, or whenever the Claude call fails. "offline" never
// calls the API; "ai" never falls back.
const engineSetting = () => (process.env.ASSISTANT_ENGINE || "auto").toLowerCase();
const aiEnabled = () => {
  const s = engineSetting();
  return s === "ai" || (s === "auto" && Boolean(process.env.ANTHROPIC_API_KEY));
};

// GET /api/assistant/welcome?lang=bn
export const getWelcome = (req, res) => {
  const lang = req.query.lang === "bn" ? "bn" : "en";
  res.json({ success: true, ...welcome(lang), engine: aiEnabled() ? "ai" : "offline" });
};

// POST /api/assistant/chat   Body: { message, history?: [{ role, content, intent? }], lang? }
export const chat = asyncHandler(async (req, res) => {
  const { message, history = [], lang = "en" } = req.body;
  const args = { text: message.trim(), history, lang: lang === "bn" ? "bn" : "en", user: req.user };

  if (aiEnabled()) {
    try {
      const out = await replyWithClaude(args);
      return res.json({ success: true, engine: "ai", suggestions: [], ...out });
    } catch (err) {
      if (engineSetting() === "ai") throw err;
      // Log the error type only, never the user's message
      console.error("AI assistant unavailable, using the offline assistant:", err?.status ?? "", err?.message ?? "");
    }
  }

  const out = await replyOffline(args);
  res.json({ success: true, ...out });
});
