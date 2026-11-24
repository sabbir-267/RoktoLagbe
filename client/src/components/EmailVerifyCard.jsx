import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { MailCheck, MailWarning } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { sendVerificationEmail } from "../services/auth";
import { parseError } from "../utils/errors";
import FormField from "./FormField";
import useT from "../i18n/useT";
import dict from "../i18n/account";

const RESEND_SECONDS = 60;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

// Shows the user's email status and lets them add/change the email and (re)send the link.
// `compact` = a single green line when already verified (for the dashboard).
export default function EmailVerifyCard({ compact = false }) {
  const { user, setUser, refreshUser } = useAuth();
  const { t } = useT(dict);
  const [editing, setEditing] = useState(!user.email);
  const [email, setEmail] = useState(user.email || "");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (user.isEmailVerified) {
    return (
      <div className={`flex items-center gap-2 text-sm text-green-700 ${compact ? "" : "rounded-2xl bg-green-50 p-4"}`}>
        <MailCheck size={18} /> {t("emailVerifiedWith", { email: user.email })}
      </div>
    );
  }

  async function send(e) {
    e?.preventDefault();
    const next = email.trim().toLowerCase();
    if (editing && !EMAIL_RE.test(next)) {
      setError(t("emailInvalid"));
      return;
    }
    setError("");
    setSending(true);
    try {
      const data = await sendVerificationEmail(editing ? next : undefined);
      setUser(data.user);
      setEditing(false);
      setCooldown(RESEND_SECONDS);
      toast.success(data.message);
    } catch (err) {
      const { message, fields } = parseError(err);
      if (fields.email) setError(fields.email);
      toast.error(message);
    } finally {
      setSending(false);
    }
  }

  // After clicking the link on another device, let them refresh this page's status
  async function checkAgain() {
    setChecking(true);
    try {
      const fresh = await refreshUser();
      if (fresh?.isEmailVerified) toast.success(t("emailVerifiedToast"));
      else toast(t("notVerifiedYet"));
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-center gap-2 font-semibold text-amber-800">
        <MailWarning size={20} />
        {user.email ? t("verifyYourEmail") : t("addYourEmail")}
      </div>
      <p className="mt-1 text-sm text-amber-900/80">
        {t("cardIntro")}
      </p>

      {editing ? (
        <form onSubmit={send} className="mt-4 space-y-3" noValidate>
          <FormField
            label={t("emailAddress")}
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={sending}
              className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
            >
              {sending ? t("sending") : t("saveAndSend")}
            </button>
            {user.email && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setEmail(user.email);
                  setError("");
                }}
                className="text-sm text-gray-600 hover:underline"
              >
                {t("common:cancel")}
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="mt-4 space-y-3 text-sm">
          <p>
            {t("emailLine")} <strong>{user.email}</strong>{" "}
            <button type="button" onClick={() => setEditing(true)} className="text-brand-blue hover:underline">
              {t("change")}
            </button>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => send()}
              disabled={sending || cooldown > 0}
              className="rounded-lg bg-brand-red px-4 py-2 font-semibold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
            >
              {sending ? "Sending..." : cooldown > 0 ? t("resendIn", { count: cooldown }) : t("sendLink")}
            </button>
            <button
              type="button"
              onClick={checkAgain}
              disabled={checking}
              className="font-medium text-brand-blue hover:underline disabled:opacity-60"
            >
              {checking ? t("checking") : t("iVerified")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
