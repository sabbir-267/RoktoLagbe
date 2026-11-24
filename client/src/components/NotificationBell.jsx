import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Bell, BellOff } from "lucide-react";
import { useNotifications } from "../context/NotificationsContext";
import { listNotifications, markRead, markAllRead } from "../services/notifications";
import { normalizeNotification, notificationLink } from "../utils/notifications";
import { parseError } from "../utils/errors";
import NotificationItem from "./NotificationItem";
import Spinner from "./Spinner";
import useT from "../i18n/useT";
import dict from "../i18n/notifications";

const PANEL_SIZE = 8;

export default function NotificationBell() {
  const { t } = useT(dict);
  const navigate = useNavigate();
  const { unreadCount, setUnreadCount, refresh } = useNotifications();

  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState({ status: "idle", items: [], error: "" });
  const wrapRef = useRef(null);

  // While the panel is open: a click outside it, or the Escape key, closes it
  useEffect(() => {
    if (!open) return undefined;

    const onPointer = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function load() {
    // Keep showing the old list while a fresh one loads
    setPanel((p) => ({ ...p, status: p.items.length ? "ready" : "loading", error: "" }));
    try {
      const data = await listNotifications({ limit: PANEL_SIZE });
      setPanel({
        status: "ready",
        items: (data.notifications || []).map(normalizeNotification),
        error: "",
      });
      setUnreadCount(data.unreadCount ?? 0);
    } catch (err) {
      setPanel((p) => ({ ...p, status: "error", error: parseError(err).message }));
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) load();
  }

  function openItem(n) {
    setOpen(false);
    if (!n.isRead) {
      setPanel((p) => ({
        ...p,
        items: p.items.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)),
      }));
      setUnreadCount(unreadCount - 1);
      markRead(n.id).catch(() => refresh());
    }
    const link = notificationLink(n);
    if (link) navigate(link);
  }

  async function readAll() {
    try {
      await markAllRead();
      setPanel((p) => ({ ...p, items: p.items.map((x) => ({ ...x, isRead: true })) }));
      setUnreadCount(0);
    } catch (err) {
      toast.error(parseError(err).message);
    }
  }

  const badge = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div ref={wrapRef} className="sm:relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={t("bellLabel", { count: unreadCount })}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative rounded-lg p-2 text-gray-600 transition hover:bg-red-50 hover:text-brand-red"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red px-1 text-[11px] font-bold leading-none text-white">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-[4.5rem] z-50 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="font-semibold text-brand-blue">{t("title")}</h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={readAll}
                className="text-xs font-semibold text-brand-blue hover:underline"
              >
                {t("markAllRead")}
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {panel.status === "loading" && <Spinner className="py-10" />}

            {panel.status === "error" && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-gray-600">{panel.error}</p>
                <button
                  type="button"
                  onClick={load}
                  className="mt-3 text-sm font-semibold text-brand-red hover:underline"
                >
                  {t("common:tryAgain")}
                </button>
              </div>
            )}

            {panel.status === "ready" && panel.items.length === 0 && (
              <div className="px-4 py-10 text-center">
                <BellOff className="mx-auto text-gray-300" size={36} />
                <p className="mt-2 text-sm font-medium text-gray-700">{t("caughtUp")}</p>
                <p className="mt-1 text-xs text-gray-400">{t("newWillShow")}</p>
              </div>
            )}

            {panel.status === "ready" && panel.items.length > 0 && (
              <ul className="divide-y divide-gray-100">
                {panel.items.map((n) => (
                  <li key={n.id}>
                    <NotificationItem notification={n} onOpen={openItem} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-gray-100">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-center text-sm font-semibold text-brand-blue transition hover:bg-blue-50"
            >
              {t("seeAll")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}