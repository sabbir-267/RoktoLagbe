import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { parseError } from "../utils/errors";
import FormField from "../components/FormField";
import GoogleButton, { OrDivider } from "../components/GoogleButton";
import useT from "../i18n/useT";
import dict from "../i18n/auth";

// Accepts 01XXXXXXXXX, +8801XXXXXXXXX, 8801XXXXXXXXX (the backend double-checks)
const PHONE_RE = /^(?:\+?88)?01\d{9}$/;

function validate(f, t) {
  const e = {};
  const name = f.name.trim();
  const phone = f.phone.replace(/[\s-]/g, "");
  const email = f.email.trim();

  if (name.length < 2 || name.length > 80) e.name = t("nameLength");
  if (!PHONE_RE.test(phone)) e.phone = t("phoneInvalid");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) e.email = t("emailInvalidOptional");
  if (f.password.length < 8) e.password = t("passwordMin");
  if (f.confirm !== f.password) e.confirm = t("passwordMismatch");
  return e;
}

export default function Register() {
  const { user, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const { t } = useT(dict);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={user.needsPhone ? "/add-phone" : "/dashboard"} replace />;

  async function handleGoogle(credential) {
    try {
      const data = await loginWithGoogle(credential);
      // An existing admin, doctor or bank staff account continues with two-step verification
      if (data.twoFactor) return navigate("/two-step", { state: { ...data, from: "/dashboard" } });
      toast.success(data.isNewUser ? t("googleCreated") : t("welcomeBackToast"));
    } catch (err) {
      toast.error(parseError(err).message);
    }
  }

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();

    const found = validate(form, t);
    setErrors(found);
    if (Object.keys(found).length) return;

    // Only send what the backend expects (no role, no confirm)
    const payload = {
      name: form.name.trim(),
      phone: form.phone.replace(/[\s-]/g, ""),
      password: form.password,
    };
    if (form.email.trim()) payload.email = form.email.trim();

    setSubmitting(true);
    try {
      const data = await register(payload);
      toast.success(
        data.emailSent
          ? t("createdCheckEmail")
          : t("createdWelcome")
      );
    } catch (err) {
      const { message, fields } = parseError(err);
      setErrors(fields);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md px-4 py-12">
      <div className="w-full rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-brand-blue">{t("registerTitle")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("registerSubtitle")}
        </p>

        <div className="mt-6">
          <GoogleButton onCredential={handleGoogle} text="signup_with" />
        </div>
        <OrDivider />

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FormField
            label={t("fullName")}
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={handleChange}
            error={errors.name}
          />
          <FormField
            label={t("phoneNumber")}
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="01711111111"
            value={form.phone}
            onChange={handleChange}
            error={errors.phone}
            hint={t("phoneHint")}
          />
          <FormField
            label={t("emailLabel")}
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            error={errors.email}
            hint={t("emailHint")}
          />
          <FormField
            label={t("password")}
            name="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            error={errors.password}
            hint={t("atLeast8")}
          />
          <FormField
            label={t("confirmPassword")}
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
            {submitting ? t("creatingAccount") : t("createAccount")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          {t("haveAccount")}{" "}
          <Link to="/login" className="font-semibold text-brand-red hover:underline">
            {t("common:login")}
          </Link>
        </p>
      </div>
    </div>
  );
}