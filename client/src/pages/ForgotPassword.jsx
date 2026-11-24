import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Mail, Smartphone } from "lucide-react";
import { api } from "../services/api";
import { requestResetEmail } from "../services/auth";
import { parseError } from "../utils/errors";
import { PHONE_RE, cleanPhone } from "../utils/phone";
import FormField from "../components/FormField";
import useT from "../i18n/useT";
import dict from "../i18n/password";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { t } = useT(dict);
  const [method, setMethod] = useState("email"); // email | phone
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [emailSentTo, setEmailSentTo] = useState("");

  function switchMethod(next) {
    setMethod(next);
    setValue("");
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (method === "email") {
      const email = value.trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return setError(t("emailInvalid"));
      setError("");
      setSubmitting(true);
      try {
        const data = await requestResetEmail(email);
        toast.success(data.message);
        setEmailSentTo(email);
      } catch (err) {
        const { message, fields } = parseError(err);
        setError(fields.email || "");
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Phone: 6-digit SMS code, then the existing /reset-password page
    const cleaned = cleanPhone(value);
    if (!PHONE_RE.test(cleaned)) return setError(t("phoneInvalid"));
    setError("");
    setSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { phone: cleaned });
      toast.success(t("codeSent"));
      navigate("/reset-password", { state: { phone: cleaned } });
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  const tab = (key, Icon, label) => (
    <button
      type="button"
      onClick={() => switchMethod(key)}
      className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition ${
        method === key ? "bg-white text-brand-blue shadow-sm" : "text-gray-500 hover:text-gray-700"
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <div className="mx-auto flex max-w-md px-4 py-12">
      <div className="w-full rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-brand-blue">{t("forgotTitle")}</h1>

        {emailSentTo ? (
          <div className="mt-4 space-y-3 text-sm text-gray-600">
            <p>
              {t("emailSentBefore")} <strong>{emailSentTo}</strong> {t("emailSentAfter")}
            </p>
            <p>{t("didntGetIt")}</p>
            <button
              type="button"
              onClick={() => {
                setEmailSentTo("");
                switchMethod("phone");
              }}
              className="font-medium text-brand-blue hover:underline"
            >
              {t("usePhone")}
            </button>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-gray-500">
              {method === "email"
                ? t("emailIntro")
                : t("phoneIntro")}
            </p>

            <div className="mt-6 flex gap-1 rounded-lg bg-gray-100 p-1">
              {tab("email", Mail, t("common:email"))}
              {tab("phone", Smartphone, t("common:phone"))}
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
              {method === "email" ? (
                <FormField
                  key="email"
                  label={t("emailAddress")}
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  error={error}
                />
              ) : (
                <FormField
                  key="phone"
                  label={t("phoneNumber")}
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="01711111111"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  error={error}
                />
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-brand-red py-3 font-semibold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
              >
                {submitting ? t("sending") : method === "email" ? t("sendResetLink") : t("sendCode")}
              </button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-gray-600">
          {t("remembered")}{" "}
          <Link to="/login" className="font-semibold text-brand-red hover:underline">
            {t("backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}
