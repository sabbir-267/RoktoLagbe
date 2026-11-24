import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, MessageCircle, Send, Ban, MoreVertical, ExternalLink } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useMessages, useChatEvent } from "../context/MessagesContext";
import {
  listConversations, getConversation, sendMessage, markConversationRead, setConversationBlocked,
} from "../services/messages";
import { parseError } from "../utils/errors";
import Spinner from "../components/Spinner";
import useT from "../i18n/useT";
import dict from "../i18n/messages";

const MAX_LEN = 2000;
const TYPING_SEND_MS = 2500; // send at most one "typing" hint this often
const TYPING_SHOW_MS = 4000; // hide the indicator if no new hint arrives

const sameId = (a, b) => String(a) === String(b);

function Avatar({ person, size = "h-10 w-10 text-sm" }) {
  if (person?.avatar) {
    return <img src={person.avatar} alt="" referrerPolicy="no-referrer" className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  const initials = (person?.name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-brand-blue/10 font-semibold text-brand-blue`}>
      {initials}
    </span>
  );
}

function shortTime(v, locale) {
  const d = new Date(v);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  }
  const days = (now - d) / 86400000;
  if (days < 7) return d.toLocaleDateString(locale, { weekday: "short" });
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

function dayLabel(v, locale, t) {
  const d = new Date(v);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return t("today");
  if (d.toDateString() === yesterday.toDateString()) return t("yesterday");
  return d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// Puts the updated conversation at the top of the list
const upsertConversation = (list, conv) => [conv, ...list.filter((c) => !sameId(c.id, conv.id))];

export default function Messages() {
  const { t, n, locale } = useT(dict);
  const { id: activeId } = useParams();
  const { user } = useAuth();
  const { refreshUnread, setActiveConversation } = useMessages();

  const [list, setList] = useState({ status: "loading", items: [], error: null });

  const loadList = useCallback(() => {
    listConversations()
      .then((d) => setList({ status: "ready", items: d.conversations || [], error: null }))
      .catch((err) => setList({ status: "error", items: [], error: err }));
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    setActiveConversation(activeId || null);
    return () => setActiveConversation(null);
  }, [activeId, setActiveConversation]);

  // Keep the list current as messages arrive anywhere
  useChatEvent("message:new", ({ conversation }) => {
    const conv = sameId(conversation.id, activeId) ? { ...conversation, unread: 0 } : conversation;
    setList((l) => ({ ...l, items: upsertConversation(l.items, conv) }));
  });
  useChatEvent("conversation:update", ({ conversation }) => {
    setList((l) => ({ ...l, items: l.items.map((c) => (sameId(c.id, conversation.id) ? conversation : c)) }));
  });

  const onConversationChange = useCallback((conv) => {
    setList((l) => ({
      ...l,
      items: l.items.some((c) => sameId(c.id, conv.id))
        ? l.items.map((c) => (sameId(c.id, conv.id) ? conv : c))
        : upsertConversation(l.items, conv),
    }));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-0 py-0 sm:px-4 sm:py-8">
      <div className="flex h-[calc(100dvh-4rem)] overflow-hidden border-gray-100 bg-white sm:h-[calc(100dvh-8rem)] sm:min-h-[520px] sm:rounded-2xl sm:border sm:shadow-sm">
        {/* Conversation list */}
        <aside
          className={`w-full flex-col border-r border-gray-100 md:flex md:w-80 md:shrink-0 ${activeId ? "hidden" : "flex"}`}
        >
          <div className="border-b border-gray-100 px-5 py-4">
            <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
          </div>
          <div className="flex-1 overflow-y-auto">
            {list.status === "loading" && <Spinner className="py-10" />}
            {list.status === "error" && (
              <p className="p-5 text-sm text-red-600">{parseError(list.error).message}</p>
            )}
            {list.status === "ready" && list.items.length === 0 && (
              <div className="p-8 text-center">
                <MessageCircle className="mx-auto text-gray-300" size={40} />
                <p className="mt-3 font-semibold text-gray-800">{t("noMessages")}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {t("noMessagesHint")}
                </p>
                <Link to="/donors" className="btn-primary mt-4">
                  {t("findDonors")}
                </Link>
              </div>
            )}
            <ul>
              {list.items.map((c) => {
                const active = sameId(c.id, activeId);
                const fromMe = c.lastMessage && sameId(c.lastMessage.sender, user.id);
                return (
                  <li key={c.id}>
                    <Link
                      to={`/messages/${c.id}`}
                      className={`flex items-center gap-3 px-5 py-3 transition ${
                        active ? "bg-red-50/70" : "hover:bg-gray-50"
                      }`}
                    >
                      <Avatar person={c.other} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className={`truncate text-sm ${c.unread ? "font-bold text-gray-900" : "font-semibold text-gray-800"}`}>
                            {c.other?.name || t("unknownUser")}
                          </p>
                          {c.lastMessage && (
                            <span className="shrink-0 text-xs text-gray-400">{shortTime(c.lastMessage.at, locale)}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className={`truncate text-sm ${c.unread ? "text-gray-800" : "text-gray-500"}`}>
                            {c.lastMessage
                              ? fromMe
                                ? t("you", { text: c.lastMessage.text })
                                : c.lastMessage.text
                              : t("noMessages")}
                          </p>
                          {c.unread > 0 && (
                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-red px-1.5 text-[11px] font-bold text-white">
                              {c.unread > 99 ? `${n(99)}+` : n(c.unread)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* Thread */}
        <section className={`min-w-0 flex-1 flex-col ${activeId ? "flex" : "hidden md:flex"}`}>
          {activeId ? (
            <Thread
              key={activeId}
              conversationId={activeId}
              me={user}
              onConversationChange={onConversationChange}
              refreshUnread={refreshUnread}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-gray-500">
              <MessageCircle size={44} className="text-gray-300" />
              <p className="mt-3 font-semibold text-gray-700">{t("selectConversation")}</p>
              <p className="mt-1 text-sm">{t("selectHint")}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Thread({ conversationId, me, onConversationChange, refreshUnread }) {
  const { t, locale } = useT(dict);
  const navigate = useNavigate();
  const { socket } = useMessages();
  const [state, setState] = useState({ status: "loading", conversation: null, messages: [], hasMore: false, error: null });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollRef = useRef(null);
  const stickToBottom = useRef(true);
  const keepOffset = useRef(null); // distance from bottom to restore after loading older messages
  const lastTypingSent = useRef(0);
  const typingTimer = useRef(null);

  const markRead = useCallback(() => {
    markConversationRead(conversationId)
      .then(() => refreshUnread())
      .catch(() => {});
  }, [conversationId, refreshUnread]);

  useEffect(() => {
    let cancelled = false;
    getConversation(conversationId)
      .then((d) => {
        if (cancelled) return;
        setState({ status: "ready", conversation: d.conversation, messages: d.messages, hasMore: d.hasMore, error: null });
        onConversationChange({ ...d.conversation, unread: 0 });
        stickToBottom.current = true;
        markRead();
      })
      .catch((err) => !cancelled && setState((s) => ({ ...s, status: "error", error: err })));
    return () => {
      cancelled = true;
      clearTimeout(typingTimer.current);
    };
  }, [conversationId, onConversationChange, markRead]);

  // Scroll: stay pinned to the newest message, or keep position when older ones are added on top
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (keepOffset.current !== null) {
      el.scrollTop = el.scrollHeight - keepOffset.current;
      keepOffset.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [state.messages, otherTyping]);

  const onScroll = () => {
    const el = scrollRef.current;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useChatEvent("message:new", ({ message, conversation }) => {
    if (!sameId(conversation.id, conversationId)) return;
    setState((s) =>
      s.messages.some((m) => sameId(m.id, message.id))
        ? s
        : { ...s, conversation: { ...conversation, unread: 0 }, messages: [...s.messages, message] }
    );
    if (!sameId(message.sender, me.id)) {
      setOtherTyping(false);
      markRead();
    }
  });

  useChatEvent("conversation:update", ({ conversation }) => {
    if (sameId(conversation.id, conversationId)) setState((s) => ({ ...s, conversation }));
  });

  useChatEvent("typing", ({ conversationId: cid }) => {
    if (!sameId(cid, conversationId)) return;
    setOtherTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setOtherTyping(false), TYPING_SHOW_MS);
  });

  async function loadOlder() {
    const oldest = state.messages[0];
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const d = await getConversation(conversationId, { before: oldest.createdAt });
      const el = scrollRef.current;
      keepOffset.current = el ? el.scrollHeight - el.scrollTop : null;
      setState((s) => ({ ...s, messages: [...d.messages, ...s.messages], hasMore: d.hasMore }));
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setLoadingOlder(false);
    }
  }

  function onType(e) {
    setText(e.target.value);
    const other = state.conversation?.other;
    if (socket && other && Date.now() - lastTypingSent.current > TYPING_SEND_MS) {
      lastTypingSent.current = Date.now();
      socket.emit("typing", { conversationId, to: String(other.id) });
    }
  }

  async function send(e) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const { message } = await sendMessage(conversationId, body);
      setText("");
      stickToBottom.current = true;
      setState((s) =>
        s.messages.some((m) => sameId(m.id, message.id)) ? s : { ...s, messages: [...s.messages, message] }
      );
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setSending(false);
    }
  }

  async function toggleBlock() {
    const conv = state.conversation;
    const next = !conv.blockedByMe;
    setMenuOpen(false);
    try {
      const d = await setConversationBlocked(conversationId, next);
      setState((s) => ({ ...s, conversation: d.conversation }));
      onConversationChange(d.conversation);
      toast.success(next ? t("blockedToast", { name: conv.other?.name || t("thisPerson") }) : t("unblocked"));
    } catch (err) {
      toast.error(parseError(err).message);
    }
  }

  if (state.status === "loading") return <Spinner className="py-24" />;
  if (state.status === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <p className="font-semibold text-gray-800">{parseError(state.error).message}</p>
        <Link to="/messages" className="mt-4 text-sm font-semibold text-brand-blue hover:underline">
          {t("backToMessages")}
        </Link>
      </div>
    );
  }

  const { conversation: conv, messages } = state;
  const other = conv.other;
  const blocked = conv.blockedByMe || conv.blockedByOther;
  const otherGone = other && !other.isActive;

  return (
    <>
      <header className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate("/messages")}
          className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 md:hidden"
          aria-label={t("backToConversations")}
        >
          <ArrowLeft size={20} />
        </button>
        <Avatar person={other} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-gray-900">{other?.name || t("unknownUser")}</p>
          <p className="h-4 text-xs text-gray-500">{otherTyping ? <span className="text-green-600">{t("typing")}</span> : null}</p>
        </div>
        {conv.relatedRequest && (
          <Link
            to={`/requests/${conv.relatedRequest}`}
            className="hidden items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-blue hover:bg-blue-50 sm:inline-flex"
          >
            <ExternalLink size={14} /> {t("viewRequest")}
          </Link>
        )}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={t("options")}
            aria-expanded={menuOpen}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <MoreVertical size={20} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 w-48 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
              {conv.relatedRequest && (
                <Link
                  to={`/requests/${conv.relatedRequest}`}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 sm:hidden"
                >
                  <ExternalLink size={16} /> {t("viewRequest")}
                </Link>
              )}
              <button
                type="button"
                onClick={toggleBlock}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <Ban size={16} /> {conv.blockedByMe ? t("unblock") : t("block")}
              </button>
            </div>
          )}
        </div>
      </header>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto bg-gray-50/60 px-4 py-4">
        {state.hasMore && (
          <div className="mb-4 text-center">
            <button
              type="button"
              onClick={loadOlder}
              disabled={loadingOlder}
              className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-gray-600 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-60"
            >
              {loadingOlder ? t("loading") : t("loadEarlier")}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="mx-auto mt-10 max-w-sm rounded-2xl bg-white p-5 text-center text-sm text-gray-600 shadow-sm">
            {t("sayHello", { name: other?.name || t("them") })}
          </div>
        )}

        <ol className="space-y-1">
          {messages.map((m, i) => {
            const mine = sameId(m.sender, me.id);
            const prev = messages[i - 1];
            const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
            const grouped = prev && !newDay && sameId(prev.sender, m.sender);
            return (
              <li key={m.id}>
                {newDay && (
                  <div className="my-4 text-center">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-500 shadow-sm ring-1 ring-gray-100">
                      {dayLabel(m.createdAt, locale, t)}
                    </span>
                  </div>
                )}
                <div className={`flex ${mine ? "justify-end" : "justify-start"} ${grouped ? "" : "pt-2"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[65%] ${
                      mine ? "rounded-br-md bg-brand-red text-white" : "rounded-bl-md bg-white text-gray-800 ring-1 ring-gray-100"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-red-100" : "text-gray-400"}`}>
                      {new Date(m.createdAt).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        {otherTyping && (
          <div className="mt-2 flex">
            <span className="flex gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100" aria-label={t("typingLabel")}>
              {[0, 150, 300].map((d) => (
                <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: `${d}ms` }} />
              ))}
            </span>
          </div>
        )}
      </div>

      {blocked || otherGone ? (
        <div className="border-t border-gray-100 px-4 py-4 text-center text-sm text-gray-500">
          {conv.blockedByMe ? (
            <>
              {t("youBlocked")}{" "}
              <button type="button" onClick={toggleBlock} className="font-semibold text-brand-blue hover:underline">
                {t("unblock")}
              </button>
            </>
          ) : otherGone ? (
            t("accountInactive")
          ) : (
            t("cantReply")
          )}
        </div>
      ) : (
        <form onSubmit={send} className="flex items-end gap-2 border-t border-gray-100 p-3">
          <textarea
            value={text}
            onChange={onType}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) send(e);
            }}
            rows={1}
            maxLength={MAX_LEN}
            placeholder={t("placeholder")}
            aria-label={t("messageLabel")}
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-200"
            style={{ fieldSizing: "content" }}
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            aria-label={t("send")}
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-brand-red text-white transition hover:bg-brand-red-dark disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </form>
      )}
    </>
  );
}
