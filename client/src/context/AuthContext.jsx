import { createContext, useContext, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { api, TOKEN_KEY } from "../services/api";

// When the user last did something, shared by all tabs (used by the inactivity logout)
export const ACTIVITY_KEY = "rokto_last_activity";
import { googleSignIn } from "../services/auth";
import useT from "../i18n/useT";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const started = useRef(false);
  const { t } = useT();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // On first load: if a token is saved, ask the backend who the user is.
  // The ref stops React StrictMode (dev only) from calling the API twice,
  // because auth endpoints are rate-limited.
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function restoreSession() {
      if (!localStorage.getItem(TOKEN_KEY)) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get("/auth/me");
        setUser(data.user);
      } catch (err) {
        if (err.response?.status === 401) localStorage.removeItem(TOKEN_KEY);
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

  // Triggered by the Axios interceptor when the token is rejected
  useEffect(() => {
    const onExpired = (e) => {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      // e.g. "Your account needs two-step verification. Please log in again."
      const reason = e?.detail?.message;
      toast.error(reason && /two-step/i.test(reason) ? reason : tRef.current("common:sessionExpired"));
    };
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  // Keep every open tab in step: logging out (or in as someone else) in one tab applies to all
  useEffect(() => {
    const onStorage = async (e) => {
      if (e.key !== TOKEN_KEY) return;
      if (!e.newValue) {
        setUser(null);
        return;
      }
      try {
        const { data } = await api.get("/auth/me");
        setUser(data.user);
      } catch {
        setUser(null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Stores { token, user } from the backend (login, register, password change, ...)
  function saveSession(data) {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now())); // a fresh login starts a fresh idle timer
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
  }

  // identifier is a phone number or an email address
  // Admin, doctor and bank staff logins return { twoFactor, challenge } instead of a session;
  // the caller then sends the user to /two-step. Returns the backend reply either way.
  async function login(identifier, password) {
    const { data } = await api.post("/auth/login", { identifier, password });
    if (!data.twoFactor) saveSession(data);
    return data;
  }

  async function register(payload) {
    const { data } = await api.post("/auth/register", payload);
    saveSession(data);
    return data; // includes emailSent
  }

  // Returns the backend reply so the page can check isNewUser / user.needsPhone
  async function loginWithGoogle(credential) {
    const data = await googleSignIn(credential);
    if (!data.twoFactor) saveSession(data);
    return data;
  }

  // Re-read the user from the backend (after verifying email, adding a phone, ...)
  async function refreshUser() {
    if (!localStorage.getItem(TOKEN_KEY)) return null;
    const { data } = await api.get("/auth/me");
    setUser(data.user);
    return data.user;
  }

  // message: shown instead of "Logged out", e.g. when the session timed out
  function logout(message) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACTIVITY_KEY);
    setUser(null);
    if (typeof message === "string") toast(message, { icon: "🔒", duration: 6000 });
    else toast.success(t("common:loggedOut"));
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, refreshUser, logout, setUser, saveSession }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}