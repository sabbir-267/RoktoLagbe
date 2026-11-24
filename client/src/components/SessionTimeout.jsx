import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Clock } from "lucide-react";
import { useAuth, ACTIVITY_KEY } from "../context/AuthContext";
import { TOKEN_KEY } from "../services/api";
import useT from "../i18n/useT";
import dict from "../i18n/session";

// Log out after this many minutes without activity (set VITE_SESSION_TIMEOUT_MINUTES to change it)
const IDLE_MS = (Number(import.meta.env.VITE_SESSION_TIMEOUT_MINUTES) || 30) * 60 * 1000;
const WARN_MS = 60 * 1000; // show the warning this long before logging out
const WRITE_EVERY_MS = 10 * 1000; // don't write to storage on every mouse move

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "wheel", "mousemove"];

const readActivity = () => {
  const v = Number(localStorage.getItem(ACTIVITY_KEY));
  return Number.isFinite(v) && v > 0 ? v : null;
};

// Expiry time (ms) inside the JWT, or null if it can't be read
const tokenExpiry = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

const minutesLabel = Math.round(IDLE_MS / 60000);

export default function SessionTimeout() {
  const { t } = useT(dict);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [secondsLeft, setSecondsLeft] = useState(null); // null = no warning showing
  const lastWrite = useRef(0);
  const warningRef = useRef(false);
  const stayRef = useRef(null);
  const locationRef = useRef(location);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  const markActive = useCallback((force = false) => {
    const now = Date.now();
    if (force || now - lastWrite.current > WRITE_EVERY_MS) {
      lastWrite.current = now;
      localStorage.setItem(ACTIVITY_KEY, String(now));
    }
  }, []);

  const endSession = useCallback(
    (message) => {
      warningRef.current = false;
      setSecondsLeft(null);
      logout(message);
      const { pathname, search } = locationRef.current;
      navigate("/login", { replace: true, state: { from: { pathname, search } } });
    },
    [logout, navigate]
  );

  // Record activity. While the warning is open, only the "Stay signed in" button counts,
  // so a stray mouse movement can't silently extend the session.
  useEffect(() => {
    if (!user) return undefined;
    if (!readActivity()) markActive(true); // first run after this feature shipped
    const onActivity = () => {
      if (!warningRef.current) markActive();
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
  }, [user, markActive]);

  // Check once a second. Other tabs share the same activity time through localStorage.
  useEffect(() => {
    if (!user) return undefined;
    const tick = () => {
      const now = Date.now();
      const expiry = tokenExpiry();
      if (expiry && now >= expiry) {
        endSession(t("expired"));
        return;
      }
      const idle = now - (readActivity() ?? now);
      if (idle >= IDLE_MS) {
        endSession(t("idleLogout", { count: minutesLabel }));
      } else if (idle >= IDLE_MS - WARN_MS) {
        warningRef.current = true;
        setSecondsLeft(Math.ceil((IDLE_MS - idle) / 1000));
      } else if (warningRef.current) {
        // Activity in another tab, or "Stay signed in" here
        warningRef.current = false;
        setSecondsLeft(null);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [user, endSession, t]);

  const showing = Boolean(user) && secondsLeft !== null;

  useEffect(() => {
    if (showing) stayRef.current?.focus();
  }, [showing]);

  if (!showing) return null;

  const stay = () => {
    warningRef.current = false;
    markActive(true);
    setSecondsLeft(null);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-title"
        aria-describedby="session-desc"
        className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
        onKeyDown={(e) => e.key === "Escape" && stay()}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <Clock size={28} />
        </div>
        <h2 id="session-title" className="mt-4 text-lg font-bold text-gray-900">
          {t("stillThere")}
        </h2>
        <p id="session-desc" className="mt-2 text-sm text-gray-600">
          {t("warnBefore")}{" "}
          <strong className="tabular-nums text-gray-900">
            {t("seconds", { count: secondsLeft })}
          </strong>{" "}
          {t("warnAfter")}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => endSession()} className="btn-secondary">
            {t("common:logout")}
          </button>
          <button type="button" ref={stayRef} onClick={stay} className="btn-primary">
            {t("stay")}
          </button>
        </div>
      </div>
    </div>
  );
}
