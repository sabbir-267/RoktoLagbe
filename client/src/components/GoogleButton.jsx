import { useEffect, useRef, useState } from "react";
import useT from "../i18n/useT";
import dict from "../i18n/auth";

// Official "Sign in with Google" button (Google Identity Services), no extra npm package.
// Needs VITE_GOOGLE_CLIENT_ID in client/.env, and this site's address (e.g. http://localhost:5173)
// listed under "Authorized JavaScript origins" for that Client ID in Google Cloud Console.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

// Load the Google script once for the whole app
let scriptPromise;
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => {
      scriptPromise = undefined; // allow a retry on the next render
      reject(new Error("Could not load Google sign-in"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// The latest callback, so re-renders don't need to re-initialise Google
let currentCallback = () => {};
let initialised = false;

export default function GoogleButton({ onCredential, text = "continue_with" }) {
  const containerRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const { t, lang } = useT(dict);

  useEffect(() => {
    currentCallback = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        if (!initialised) {
          window.google.accounts.id.initialize({
            client_id: CLIENT_ID,
            callback: (response) => currentCallback(response.credential),
          });
          initialised = true;
        }
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text, // "continue_with" | "signin_with" | "signup_with"
          locale: lang === "bn" ? "bn" : "en",
          width: Math.min(containerRef.current.offsetWidth || 360, 400),
        });
      })
      .catch(() => !cancelled && setFailed(true));

    return () => {
      cancelled = true;
    };
  }, [text, lang]);

  if (!CLIENT_ID) {
    return (
      <p className="text-center text-xs text-gray-400">
        {t("googleNotConfigured")}
      </p>
    );
  }
  if (failed) {
    return <p className="text-center text-sm text-red-600">{t("googleFailed")}</p>;
  }
  return <div ref={containerRef} className="flex min-h-[44px] w-full justify-center" />;
}

export function OrDivider() {
  const { t } = useT(dict);
  return (
    <div className="my-6 flex items-center gap-3 text-xs uppercase text-gray-400">
      <span className="h-px flex-1 bg-gray-200" />
      {t("or")}
      <span className="h-px flex-1 bg-gray-200" />
    </div>
  );
}
