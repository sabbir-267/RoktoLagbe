import axios from "axios";

export const TOKEN_KEY = "rokto_token";

export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Attach the JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If a logged-in user gets a 401 (expired/invalid token), tell the app to log out.
// Failed login/register attempts also return 401/409, so we skip those.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error.config?.url || "";
    const isAuthAttempt = url.includes("/auth/login") || url.includes("/auth/register");
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