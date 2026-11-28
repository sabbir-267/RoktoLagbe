import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { verifyEmailToken } from "../services/auth";
import { parseError } from "../utils/errors";
import Spinner from "../components/Spinner";
import useT from "../i18n/useT";
import dict from "../i18n/account";

// Opened from the link in the verification email: /verify-email?token=...
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const { t } = useT(dict);
  const token = params.get("token") || "";
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState(token ? "loading" : "error"); // loading | done | error
  const [message, setMessage] = useState(""); // empty with no token: the "missing token" text is shown instead
  const started = useRef(false); // StrictMode runs effects twice in dev; the token works only once

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verifyEmailToken(token)
      .then(async (data) => {
        setMessage(data.message);
        setStatus("done");
        await refreshUser().catch(() => {}); // update the badge if they're logged in on this device
      })
      .catch((err) => {
        setMessage(parseError(err).message);
        setStatus("error");
      });
  }, [token, refreshUser]);

  if (status === "loading") return <Spinner />;

  const ok = status === "done";
  return (
    <div className="mx-auto flex max-w-md px-4 py-12">
      <div className="w-full rounded-2xl bg-white p-8 text-center shadow-lg">
        {ok ? (
          <CheckCircle2 size={48} className="mx-auto text-green-600" />
        ) : (
          <XCircle size={48} className="mx-auto text-red-500" />
        )}
        <h1 className="mt-4 text-2xl font-bold text-brand-blue">
          {ok ? t("emailVerified") : t("verifyFailed")}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {ok ? t("thanks") : message || t("missingToken")}
        </p>
        {!ok && (
          <p className="mt-2 text-sm text-gray-500">
            {t("askNewLink")}
          </p>
        )}
        <Link
          to={user ? (ok && !user.isDonor ? "/donor-profile" : "/dashboard") : "/login"}
          className="mt-6 inline-block rounded-lg bg-brand-red px-5 py-2.5 font-semibold text-white transition hover:bg-brand-red-dark"
        >
          {user ? (ok && !user.isDonor ? t("becomeDonor") : t("goDashboard")) : t("common:login")}
        </Link>
      </div>
    </div>
  );
}
