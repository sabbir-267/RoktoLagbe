import { TYPE_META } from "../data/notifications";
import useT from "../i18n/useT";
import dict from "../i18n/notifications";

// "Just now", "5 min ago", "3 hours ago", "2 days ago", then a plain date
function timeAgo(value, t, date) {
  if (!value) return "";
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return t("justNow");
  if (minutes < 60) return t("minAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("daysAgo", { count: days });
  return date(value);
}

export default function NotificationItem({ notification: n, onOpen }) {
  const { t, date } = useT(dict);
  const meta = TYPE_META[n.type] || TYPE_META.system;
  const typeKey = TYPE_META[n.type] ? n.type : "system";
  const Icon = meta.icon;

  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-gray-50 ${
        n.isRead ? "" : "bg-red-50/40"
      }`}
    >
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.bg} ${meta.text}`}
      >
        <Icon size={18} />
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm ${
            n.isRead ? "font-medium text-gray-700" : "font-semibold text-gray-900"
          }`}
        >
          {n.title || t(`type_${typeKey}`)}
        </span>
        {n.message && (
          <span className="mt-0.5 block break-words text-sm text-gray-600">{n.message}</span>
        )}
        <span className="mt-1 block text-xs text-gray-400">{timeAgo(n.createdAt, t, date)}</span>
      </span>

      {!n.isRead && (
        <span
          role="img"
          aria-label={t("unread")}
          className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-red"
        />
      )}
    </button>
  );
}