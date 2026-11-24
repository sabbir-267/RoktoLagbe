import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext";
import { NotificationsProvider } from "./context/NotificationsContext";
import { MessagesProvider } from "./context/MessagesContext";
import { LanguageProvider } from "./i18n/LanguageContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <NotificationsProvider>
            <MessagesProvider>
              <App />
              <Toaster
                position="top-right"
                toastOptions={{
                  style: { borderRadius: "12px", fontSize: "14px", padding: "10px 14px" },
                  success: { iconTheme: { primary: "#16a34a", secondary: "#fff" } },
                  error: { iconTheme: { primary: "#b3202f", secondary: "#fff" } },
                }}
              />
            </MessagesProvider>
          </NotificationsProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>
);
