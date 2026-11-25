import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { getUnreadCount } from "../services/notifications";

const NotificationsContext = createContext(null);

const POLL_MS = 60 * 1000;

// Asks the server for the unread count. Returns null on failure, because a failed
// check must never break the page. The next one will try again.
async function fetchUnread() {
  try {
    const data = await getUnreadCount();
    return data.unreadCount ?? 0;
  } catch {
    return null;
  }
}

// Keeps the unread count for the navbar bell. It checks again every minute while the
// tab is visible, and right away when you come back to the tab.
export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;

  // The count remembers which user it belongs to, so it reads as 0 right after a logout
  const [stored, setStored] = useState({ userId: null, count: 0 });

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;

    const check = () => {
      if (document.visibilityState !== "visible") return;
      fetchUnread().then((count) => {
        if (!cancelled && count !== null) setStored({ userId, count });
      });
    };

    check();
    const timer = setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("notifications:refresh", check); // pushed over the live connection
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("notifications:refresh", check);
    };
  }, [userId]);

  // For pages that want a fresh count right now
  const refresh = useCallback(async () => {
    if (!userId) return;
    const count = await fetchUnread();
    if (count !== null) setStored({ userId, count });
  }, [userId]);

  const unreadCount = stored.userId === userId ? stored.count : 0;

  const setUnreadCount = useCallback(
    (count) => setStored({ userId, count: Math.max(0, count) }),
    [userId]
  );

  const value = useMemo(
    () => ({ unreadCount, setUnreadCount, refresh }),
    [unreadCount, setUnreadCount, refresh]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used inside <NotificationsProvider>");
  return ctx;
}