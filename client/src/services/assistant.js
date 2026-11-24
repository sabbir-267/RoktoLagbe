import { api } from "./api";

// Greeting + starter suggestions. lang: "en" | "bn"
export const getAssistantWelcome = (lang) => api.get("/assistant/welcome", { params: { lang } }).then((r) => r.data);

// history: [{ role: "user" | "assistant", content, intent? }] (oldest first, max 24)
export const sendAssistantMessage = ({ message, lang, history }) =>
  api.post("/assistant/chat", { message, lang, history }).then((r) => r.data);
