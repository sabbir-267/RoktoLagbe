import { createContext, useContext, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { api, TOKEN_KEY } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const started = useRef(false);

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
    const onExpired = () => {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      toast.error("Your session expired. Please log in again.");
    };
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  function saveSession(data) {
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
  }

  async function login(phone, password) {
    const { data } = await api.post("/auth/login", { phone, password });
    saveSession(data);
  }

  async function register(payload) {
    const { data } = await api.post("/auth/register", payload);
    saveSession(data);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    toast.success("Logged out");
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
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