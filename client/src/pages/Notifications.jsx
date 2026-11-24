import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { BellOff, CheckCheck } from "lucide-react";
import { useNotifications } from "../context/NotificationsContext";
import { listNotifications, markRead, markAllRead } from "../services/notifications";
import { normalizeNotification, notificationLink } from "../utils/notifications";
import { parseError } from "../utils/errors";
import NotificationItem from "../components/NotificationItem";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";
import useT from "../i18n/useT";
import dict from "../i18n/notifications";

const PAGE_SIZE = 20;

export default function Notifications() {
  const { t } = useT(dict);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { unreadCount, setUnreadCount, refresh } = useNotifications();

  // The URL is the source of truth, so the back button and refresh keep your place
  const key = searchParams.toString();
  const applied = useMemo(() => {
    const p = new URLSearchParams(key);
    return {
      unread: p.get("unread") === "1",
      page: Math.max(parseInt(p.get("page"), 10) || 1, 1),
    };
  }, [key]);

  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState({
    key: null,
    items: [],
    total: 0,
    pages: 1,
    error: null,
  });

  // A result counts only if it belongs to the current request,
  // so "loading" is worked out here instead of being set inside the effect.
  const requestKey = `${key}|${attempt}`;
  const status = result.key !== requestKey ? "loading" : result.error ? "error" : "ready";

  useEffect(() => {
    let cancelled = false;

    const params = { page: applied.page, limit: PAGE_SIZE };
    if (applied.unread) params.unread = "true";

    listNotifications(params)
      .then((data) => {
        if (cancelled) return;
        setResult({
          key: requestKey,
          items: (data.notifications || []).map(normalizeNotification),
          total: data.total ?? 0,
          pages: data.pages ?? 1,
          error: null,
        });
        setUnreadCount(data.unreadCount ?? 0);
      })
      .catch((err) => {
        if (cancelled) return;
        setResult({ key: requestKey, items: [], total: 0, pages: 1, error: err });
      });

    return () => {
      cancelled = true;
    };
  }, [applied, requestKey, setUnreadCount]);

  const { items, total, pages, error } = result;

  const go = (next) => {
    const p = new URLSearchParams();
    if (next.unread) p.set("unread", "1");
    if (next.page > 1) p.set("page", String(next.page));
    setSearchParams(p);
  };
  const goToPage = (page) => {
    go({ ...applied, page });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function openItem(n) {
    if (!n.isRead) {
      setResult((r) => ({
        ...r,
        items: r.items.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)),
      }));
      setUnreadCount(unreadCount - 1);
      markRead(n.id).catch(() => refresh());
    }
    const link = notificationLink(n);
    if (link) navigate(link);
  }

  async function readAll() {
    setBusy(true);
    try {
      await markAllRead();
      setUnreadCount(0);
      toast.success(t("allMarkedRead"));
      if (applied.unread) {
        setAttempt((a) => a + 1); // the Unread tab is now empty, so reload it
      } else {
        setResult((r) => ({ ...r, items: r.items.map((x) => ({ ...x, isRead: true })) }));
      }
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusy(false);
    }
  }

  const tab = (active) =>
    `rounded-lg px-4 py-2 text-sm font-semibold transition ${
      active ? "bg-brand-red text-white" : "bg-white text-gray-600 hover:bg-gray-50"
    }`;

  const from = (applied.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(applied.page * PAGE_SIZE, total);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-blue">{t("title")}</h1>
          <p className="mt-1 text-gray-500">
            {unreadCount > 0
              ? t("unreadSummary", { count: unreadCount })
              : t("caughtUpSentence")}
          </p>
        </div>

        <button
          type="button"
          onClick={readAll}
          disabled={busy || unreadCount === 0}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          <CheckCheck size={16} />
          {t("markAllRead")}
        </button>
      </div>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          aria-pressed={!applied.unread}
          onClick={() => go({ unread: false, page: 1 })}
          className={tab(!applied.unread)}
        >
          {t("tabAll")}
        </button>
        <button
          type="button"
          aria-pressed={applied.unread}
          onClick={() => go({ unread: true, page: 1 })}
          className={tab(applied.unread)}
        >
          {unreadCount > 0 ? t("tabUnreadCount", { count: unreadCount }) : t("tabUnread")}
        </button>
      </div>

      {status === "loading" && <Spinner />}

      {status === "error" && (
        <div className="mt-6 rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="font-semibold text-gray-800">{parseError(error).message}</p>
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className="mt-4 rounded-lg bg-brand-red px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
          >
            {t("common:tryAgain")}
          </button>
        </div>
      )}

      {status === "ready" && (
        <>
          {items.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-white p-10 text-center shadow-sm">
              <BellOff className="mx-auto text-gray-300" size={44} />
              {total > 0 ? (
                <>
                  <p className="mt-3 font-semibold text-gray-800">{t("noPageResults")}</p>
                  <button
                    type="button"
                    onClick={() => goToPage(1)}
                    className="mt-4 rounded-lg bg-brand-red px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
                  >
                    {t("goToFirstPage")}
                  </button>
                </>
              ) : applied.unread ? (
                <>
                  <p className="mt-3 font-semibold text-gray-800">{t("noUnread")}</p>
                  <p className="mt-1 text-sm text-gray-500">{t("readEverything")}</p>
                </>
              ) : (
                <>
                  <p className="mt-3 font-semibold text-gray-800">{t("noneYet")}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {t("noneYetHint")}
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              <p className="mt-6 text-sm text-gray-600" aria-live="polite">
                {t("showing", { from, to, total })}
              </p>
              <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-sm">
                <ul className="divide-y divide-gray-100">
                  {items.map((n) => (
                    <li key={n.id}>
                      <NotificationItem notification={n} onOpen={openItem} />
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          <Pagination page={applied.page} pages={pages} onChange={goToPage} />
        </>
      )}
    </div>
  );
}