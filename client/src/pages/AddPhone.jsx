import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { addPhone } from "../services/auth";
import { parseError } from "../utils/errors";
import { PHONE_RE, cleanPhone } from "../utils/phone";
import FormField from "../components/FormField";
import useT from "../i18n/useT";
import dict from "../i18n/auth";

// Shown after a first Google sign-in: donors and requesters need a phone number
export default function AddPhone() {
  const { user, setUser } = useAuth();
  const { t } = useT(dict);
  const navigate = useNavigate();
  const from = useLocation().state?.from || "/dashboard";
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!user.needsPhone) return <Navigate to={from} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    const cleaned = cleanPhone(phone);
    if (!PHONE_RE.test(cleaned)) {
      setError(t("phoneInvalid"));
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const data = await addPhone(cleaned);
      setUser(data.user);
      toast.success(t("phoneSaved"));
      navigate(from, { replace: true });
    } catch (err) {
      const { message, fields } = parseError(err);
      setError(fields.phone || message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md px-4 py-12">
      <div className="w-full rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-brand-blue">{t("addPhoneTitle")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("addPhoneSubtitle")}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <FormField
            label={t("phoneNumber")}
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="01711111111"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={error}
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-red py-3 font-semibold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
          >
            {submitting ? t("common:saving") : t("savePhone")}
          </button>
        </form>

        <button
          type="button"
          onClick={() => navigate("/dashboard", { replace: true })}
          className="mt-4 w-full text-center text-sm text-gray-500 hover:underline"
        >
          {t("skipForNow")}
        </button>
      </div>
    </div>
  );
}
