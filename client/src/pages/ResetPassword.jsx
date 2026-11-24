import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../services/api";
import { parseError } from "../utils/errors";
import { PHONE_RE, cleanPhone } from "../utils/phone";
import FormField from "../components/FormField";
import useT from "../i18n/useT";
import dict from "../i18n/password";

const RESEND_SECONDS = 60;

export default function ResetPassword() {
  const navigate = useNavigate();
  const { t } = useT(dict);
  const location = useLocation();
  const startPhone = location.state?.phone || "";

  const [form, setForm] = useState({
    phone: startPhone,
    otp: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(startPhone ? RESEND_SECONDS : 0);

  // Countdown for the "resend code" button
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleChange = (e) => {
    let { name, value } = e.target;
    if (name === "otp") value = value.replace(/\D/g, "").slice(0, 6); // digits only
    setForm({ ...form, [name]: value });
  };

  async function handleResend() {
    const phone = cleanPhone(form.phone);
    if (!PHONE_RE.test(phone)) {
      setErrors({ phone: t("phoneInvalid") });
      return;
    }
    try {
      await api.post("/auth/forgot-password", { phone });
      toast.success(t("newCodeSent"));
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      toast.error(parseError(err).message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const found = {};
    if (!PHONE_RE.test(cleanPhone(form.phone))) found.phone = t("phoneInvalid");
    if (form.otp.length !== 6) found.otp = t("otpRequired");
    if (form.password.length < 8) found.password = t("passwordMin");
    if (form.confirm !== form.password) found.confirm = t("passwordMismatch");
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", {
        phone: cleanPhone(form.phone),
        otp: form.otp,
        password: form.password,
      });
      toast.success(t("passwordUpdated"));
      navigate("/login", { replace: true });
    } catch (err) {
      const { message, fields } = parseError(err);
      if (Object.keys(fields).length) {
        setErrors(fields);
      } else if (err.response?.status === 400) {
        setErrors({ otp: message }); // wrong or expired code
      }
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md px-4 py-12">
      <div className="w-full rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-brand-blue">{t("resetTitle")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("resetIntro")}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <FormField
            label={t("phoneNumber")}
            name="phone"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={handleChange}
            error={errors.phone}
          />

          <div>
            <FormField
              label={t("otpLabel")}
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={form.otp}
              onChange={handleChange}
              error={errors.otp}
            />
            <div className="mt-2 text-right text-sm">
              {cooldown > 0 ? (
                <span className="text-gray-400">{t("resendIn", { count: cooldown })}</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  className="font-medium text-brand-blue hover:underline"
                >
                  {t("resendCode")}
                </button>
              )}
            </div>
          </div>

          <FormField
            label={t("newPassword")}
            name="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            error={errors.password}
            hint={t("atLeast8")}
          />
          <FormField
            label={t("confirmNewPassword")}
            name="confirm"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={handleChange}
            error={errors.confirm}
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-red py-3 font-semibold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
          >
            {submitting ? t("common:saving") : t("updatePassword")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          <Link to="/login" className="font-semibold text-brand-red hover:underline">
            {t("backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}