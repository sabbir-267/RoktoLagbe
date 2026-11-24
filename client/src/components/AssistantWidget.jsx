import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bot, RotateCcw, RotateCw, Send, Sparkles, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import useT from "../i18n/useT";
import dict from "../i18n/assistant";
import { getAssistantWelcome, sendAssistantMessage } from "../services/assistant";
import { parseError } from "../utils/errors";
import LightMarkdown from "./assistant/LightMarkdown";

// Floating "AI consultant" chat. The conversation lives in sessionStorage so it survives
// navigation and reloads in this tab, and is dropped on logout or "New chat".

const STORAGE_KEY = "rokto_assistant_chat";
const MAX_LEN = 1000;
const HISTORY_TURNS = 12; // messages sent as context (server accepts up to 24)
const HISTORY_CHARS = 4000; // server limit per history entry

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// owner: the user id the chat belongs to (null for guests); sid changes on every reset so
// replies that arrive after a reset are ignored.
const emptyChat = (owner = null) => ({ sid: newId(), owner, engine: null, welcomeLang: null, messages: [] });

const loadChat = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.messages) && saved.sid) return saved;
  } catch {
    /* storage blocked or bad JSON */
  }
  return emptyChat();
};

const isPhone = () => typeof window !== "undefined" && window.matchMedia?.("(max-width: 639px)").matches;

function TypingDots({ label }) {
  return (
    <div className="flex">
      <span className="flex gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100" role="status" aria-label={label}>
        {[0, 150, 300].map((d) => (
          <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: `${d}ms` }} />
        ))}
      </span>
    </div>
  );
}

export default function AssistantWidget() {
  const { t } = useT(dict);
  const { lang } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState(loadChat);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const launcherRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Logging out (or switching account) clears the chat; a guest chat carries over into a login.
  const uid = user ? String(user.id ?? user._id ?? "me") : null;
  if (!authLoading && chat.owner !== uid) {
    setChat(chat.owner ? emptyChat(uid) : { ...chat, owner: uid });
  }

  // Persist
  useEffect(() => {
    try {
      if (chat.messages.length) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(chat));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage blocked: the chat still works for this page */
    }
  }, [chat]);

  // Welcome message on first open, and again in the new language while nothing has been asked yet
  const hasUserMessage = chat.messages.some((m) => m.role === "user");
  const needWelcome = open && !hasUserMessage && chat.welcomeLang !== lang;
  const sid = chat.sid;
  useEffect(() => {
    if (!needWelcome) return undefined;
    let cancelled = false;
    const apply = (patch) =>
      setChat((c) => (cancelled || c.sid !== sid || c.messages.some((m) => m.role === "user") ? c : { ...c, ...patch, welcomeLang: lang }));
    getAssistantWelcome(lang)
      .then((data) =>
        apply({
          engine: data.engine || null,
          messages: [{ id: newId(), role: "assistant", welcome: true, content: data.reply || "", suggestions: data.suggestions || [] }],
        })
      )
      .catch(() => apply({ messages: [{ id: newId(), role: "assistant", error: "welcome", errorKey: "welcomeError" }] }));
    return () => {
      cancelled = true;
    };
  }, [needWelcome, lang, sid]);

  // Focus the box when opened
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the newest message in view
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, chat.messages, pending, needWelcome]);

  const close = () => {
    setOpen(false);
    launcherRef.current?.focus();
  };

  const onNavigate = () => {
    if (isPhone()) setOpen(false);
  };

  const reset = () => {
    setChat(emptyChat(uid));
    setInput("");
    setPending(false);
    inputRef.current?.focus();
  };

  async function send(raw, { retry = false } = {}) {
    const message = String(raw || "").trim().slice(0, MAX_LEN);
    if (!message || pending) return;

    let base = chat.messages.filter((m) => !m.error);
    // A retry resends the user message that is already in the list
    const last = base[base.length - 1];
    if (retry && last?.role === "user" && last.content === message) base = base.slice(0, -1);

    const history = base
      .filter((m) => !m.welcome && m.content)
      .slice(-HISTORY_TURNS)
      .map((m) =>
        m.role === "assistant"
          ? { role: "assistant", content: m.content.slice(0, HISTORY_CHARS), intent: m.intent ?? null }
          : { role: "user", content: m.content.slice(0, HISTORY_CHARS) }
      );

    const currentSid = chat.sid;
    setChat({ ...chat, messages: [...base, { id: newId(), role: "user", content: message }] });
    if (!retry) setInput("");
    setPending(true);

    const append = (msg) => setChat((c) => (c.sid === currentSid ? { ...c, messages: [...c.messages, msg] } : c));
    try {
      const data = await sendAssistantMessage({ message, lang, history });
      if (data.engine) setChat((c) => (c.sid === currentSid ? { ...c, engine: data.engine } : c));
      append({
        id: newId(),
        role: "assistant",
        content: data.reply || "",
        links: Array.isArray(data.links) ? data.links : [],
        suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
        intent: data.intent ?? null,
      });
    } catch (err) {
      const status = err.response?.status;
      let errorKey = "error";
      let errorText = null;
      if (status === 429) errorKey = "rateLimited";
      else if (!err.response) errorKey = "offline";
      else if (status === 400) errorText = parseError(err).message; // validation messages are English only
      append({ id: newId(), role: "assistant", error: "chat", errorKey, errorText, retryText: message });
    } finally {
      setPending(false);
      if (!isPhone()) inputRef.current?.focus();
    }
  }

  const retryWelcome = () => setChat((c) => ({ ...c, welcomeLang: null, messages: [] }));

  const onSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  const messages = chat.messages;
  const lastMsg = messages[messages.length - 1];
  const showExtras = !pending && lastMsg?.role === "assistant" && !lastMsg.error;
  const busy = pending || needWelcome;

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label={t("title")}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              close();
            }
          }}
          className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:inset-auto sm:right-[calc(1rem_+_env(safe-area-inset-right))] sm:bottom-[calc(5.5rem_+_env(safe-area-inset-bottom))] sm:h-[560px] sm:max-h-[calc(100dvh_-_7rem)] sm:w-[380px] sm:rounded-2xl sm:border sm:border-gray-100 sm:pt-0 sm:pb-0 sm:shadow-2xl"
        >
          {/* Header */}
          <header className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
              <Bot size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-bold text-gray-900">{t("title")}</h2>
              {chat.engine && (
                <p className="flex items-center gap-1 text-xs text-gray-500">
                  {chat.engine === "ai" && <Sparkles size={12} className="text-brand-red" />}
                  {chat.engine === "ai" ? t("modeAi") : t("modeOffline")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={reset}
              disabled={!hasUserMessage && !messages.some((m) => m.error)}
              aria-label={t("newChat")}
              title={t("newChat")}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-blue hover:bg-blue-50 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <RotateCcw size={14} />
              <span className="hidden min-[400px]:inline">{t("newChat")}</span>
            </button>
            <button type="button" onClick={close} aria-label={t("close")} title={t("close")} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
              <X size={20} />
            </button>
          </header>

          {/* Messages */}
          <div ref={listRef} aria-live="polite" aria-label={t("messagesLabel")} className="flex-1 overflow-y-auto bg-gray-50/60 px-4 py-4">
            <ol className="space-y-3">
              {messages.map((m) => {
                const mine = m.role === "user";
                const isLast = m === lastMsg;
                return (
                  <li key={m.id}>
                    <span className="sr-only">{mine ? t("you") : t("assistant")}: </span>
                    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                          mine
                            ? "rounded-br-md bg-brand-red text-white"
                            : m.error
                              ? "rounded-bl-md bg-red-50 text-gray-800 ring-1 ring-red-100"
                              : "rounded-bl-md bg-white text-gray-800 ring-1 ring-gray-100"
                        }`}
                      >
                        {mine ? (
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        ) : m.error ? (
                          <>
                            <p>{(lang === "en" && m.errorText) || t(m.errorKey || "error")}</p>
                            {isLast && (
                              <button
                                type="button"
                                onClick={() => (m.error === "welcome" ? retryWelcome() : send(m.retryText, { retry: true }))}
                                disabled={busy}
                                className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-red ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-60"
                              >
                                <RotateCw size={12} />
                                {t("retry")}
                              </button>
                            )}
                          </>
                        ) : (
                          <LightMarkdown text={m.content} onNavigate={onNavigate} />
                        )}
                      </div>
                    </div>

                    {isLast && showExtras && m.links?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2" aria-label={t("links")}>
                        {m.links
                          .filter((l) => typeof l?.to === "string" && l.to.startsWith("/") && !l.to.startsWith("//"))
                          .map((l) => (
                            <Link
                              key={`${l.to}-${l.label}`}
                              to={l.to}
                              onClick={onNavigate}
                              className="inline-flex items-center gap-1 rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-blue-dark"
                            >
                              {l.label}
                              <ArrowRight size={12} />
                            </Link>
                          ))}
                      </div>
                    )}

                    {isLast && showExtras && m.suggestions?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5" aria-label={t("suggestions")}>
                        {m.suggestions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => send(s)}
                            className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 transition hover:bg-red-50 hover:text-brand-red hover:ring-red-200"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            {busy && (
              <div className={messages.length ? "mt-3" : ""}>
                <TypingDots label={t("typing")} />
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={onSubmit} className="border-t border-gray-100 px-3 pt-3 pb-2">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                maxLength={MAX_LEN}
                placeholder={t("placeholder")}
                aria-label={t("inputLabel")}
                className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-200"
                style={{ fieldSizing: "content" }}
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label={t("send")}
                title={t("send")}
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-brand-red text-white transition hover:bg-brand-red-dark disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10.5px] leading-snug text-gray-400">{t("disclaimer")}</p>
          </form>
        </div>
      )}

      {/* Launcher */}
      <button
        ref={launcherRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={open ? t("close") : t("launcher")}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={open ? t("close") : t("launcher")}
        className={`fixed right-[calc(1rem_+_env(safe-area-inset-right))] bottom-[calc(1rem_+_env(safe-area-inset-bottom))] z-[60] h-14 w-14 items-center justify-center rounded-full bg-brand-red text-white shadow-lg shadow-red-900/20 transition hover:scale-105 hover:bg-brand-red-dark ${
          open ? "hidden sm:flex" : "flex"
        }`}
      >
        {open ? <X size={24} /> : <Sparkles size={24} />}
        {!open && (
          <span className="absolute -top-1 -right-1 rounded-full bg-brand-blue px-1.5 py-0.5 text-[10px] leading-none font-bold text-white ring-2 ring-white">
            AI
          </span>
        )}
      </button>
    </>
  );
}
