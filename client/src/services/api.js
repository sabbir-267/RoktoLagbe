import axios from "axios";
import toast from "react-hot-toast";

export const TOKEN_KEY = "rokto_token";

// Where the backend lives. Empty in development (Vite proxies /api to localhost:5000);
// in production set VITE_API_URL to the API's address, e.g. https://rokto-lagbe-api.onrender.com
export const API_ORIGIN = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");

export const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  headers: { "Content-Type": "application/json" },
});

// Free hosting puts the API to sleep when idle; the first request then takes up to a
// minute. If any request is that slow, explain it once instead of looking broken.
const WAKE_TOAST_MS = 6000;
let pending = 0;
let wakeTimer = null;
const isBangla = () => document.documentElement.lang === "bn";
const startWait = () => {
  pending++;
  if (!wakeTimer) {
    wakeTimer = setTimeout(() => {
      toast.loading(
        isBangla()
          ? "সার্ভার চালু হচ্ছে (ফ্রি হোস্টিং)। প্রথমবার এক মিনিট পর্যন্ত লাগতে পারে…"
          : "Waking up the server (free hosting). The first load can take up to a minute…",
        { id: "server-wake" }
      );
    }, WAKE_TOAST_MS);
  }
};
const endWait = () => {
  pending = Math.max(0, pending - 1);
  if (!pending) {
    clearTimeout(wakeTimer);
    wakeTimer = null;
    toast.dismiss("server-wake");
  }
};

// Attach the JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  startWait();
  return config;
});
api.interceptors.response.use(
  (res) => {
    endWait();
    return res;
  },
  (err) => {
    endWait();
    return Promise.reject(err);
  }
);

// If a logged-in user gets a 401 (expired/invalid token), tell the app to log out.
// Failed login/register/Google attempts also return 401/409, so we skip those.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error.config?.url || "";
    const isAuthAttempt = ["/auth/login", "/auth/register", "/auth/google", "/auth/reset-password"].some((p) =>
      url.includes(p)
    );
    if (
      error.response?.status === 401 &&
      !isAuthAttempt &&
      localStorage.getItem(TOKEN_KEY)
    ) {
      window.dispatchEvent(new Event("auth:expired"));
    }
    return Promise.reject(error);
  }
);