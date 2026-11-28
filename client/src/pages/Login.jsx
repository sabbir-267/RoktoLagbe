import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { parseError } from "../utils/errors";
import FormField from "../components/FormField";
import GoogleButton, { OrDivider } from "../components/GoogleButton";
import useT from "../i18n/useT";
import dict from "../i18n/auth";

export default function Login() {
  const { user, login, loginWithGoogle } = useAuth();
  const { t } = useT(dict);
  const location = useLocation();
  const navigate = useNavigate();
  const fromLoc = location.state?.from;
  const from = fromLoc ? `${fromLoc.pathname}${fromLoc.search || ""}` : "/dashboard";

  const [form, setForm] = useState({ identifier: "", password: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Google users who have no phone yet must add one first
  if (user) {
    return user.needsPhone ? <Navigate to="/add-phone" replace state={{ from }} /> : <Navigate to={from} replace />;
  }

  async function handleGoogle(credential) {
    try {
      const data = await loginWithGoogle(credential);
      // Admin, doctor and bank staff accounts continue with two-step verification
      if (data.twoFactor) return navigate("/two-step", { state: { ...data, from } });
      toast.success(data.isNewUser ? t("googleCreated") : t("welcomeBackToast"));
    } catch (err) {
      toast.error(parseError(err).message);
    }
  }

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();

    const found = {};
    if (!form.identifier.trim()) found.identifier = t("identifierRequired");
    if (!form.password) found.password = t("passwordRequired");
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const id = form.identifier.trim();
      // Phone numbers may be typed with spaces or dashes; emails are sent as typed
      const data = await login(id.includes("@") ? id : id.replace(/[\s-]/g, ""), form.password);
      if (data.twoFactor) return navigate("/two-step", { state: { ...data, from } });
      toast.success(t("welcomeBackToast"));
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
        <h1 className="text-2xl font-bold text-brand-blue">{t("loginTitle")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("loginSubtitle")}</p>

        <div className="mt-6">
          <GoogleButton onCredential={handleGoogle} text="signin_with" />
        </div>
        <OrDivider />

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FormField
            label={t("identifierLabel")}
            name="identifier"
            type="text"
            autoComplete="username"
            placeholder={t("identifierPlaceholder")}
            value={form.identifier}
            onChange={handleChange}
            error={errors.identifier}
          />
          <FormField
            label={t("password")}
            name="password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            error={errors.password}
          />
          <div className="-mt-2 text-right">
  <Link
    to="/forgot-password"
    className="text-sm font-medium text-brand-blue hover:underline"
  >
    {t("forgotPassword")}
  </Link>
</div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-red py-3 font-semibold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
          >
            {submitting ? t("loggingIn") : t("common:login")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          {t("newHere")}{" "}
          <Link to="/register" className="font-semibold text-brand-red hover:underline">
            {t("createAnAccount")}
          </Link>
        </p>
      </div>
    </div>
  );
}