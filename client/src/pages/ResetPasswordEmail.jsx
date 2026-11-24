import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { resetPasswordWithToken } from "../services/auth";
import { parseError } from "../utils/errors";
import FormField from "../components/FormField";
import useT from "../i18n/useT";
import dict from "../i18n/password";

// Opened from the link in the reset email: /reset-password/:token
export default function ResetPasswordEmail() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { t } = useT(dict);
  const { user, logout } = useAuth();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [linkError, setLinkError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    const found = {};
    if (form.password.length < 8) found.password = t("passwordMin");
    if (form.confirm !== form.password) found.confirm = t("passwordMismatch");
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const data = await resetPasswordWithToken(token, form.password);
      toast.success(data.message || t("passwordUpdated"));
      if (user) logout(); // old sessions stop working after a reset
      navigate("/login", { replace: true });
    } catch (err) {
      const { message, fields } = parseError(err);
      if (fields.password) setErrors(fields);
      else setLinkError(message); // invalid or expired link
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md px-4 py-12">
      <div className="w-full rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-brand-blue">{t("chooseTitle")}</h1>

        {linkError ? (
          <>
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{linkError}</p>
            <Link
              to="/forgot-password"
              className="mt-6 inline-block w-full rounded-lg bg-brand-red py-3 text-center font-semibold text-white transition hover:bg-brand-red-dark"
            >
              {t("getNewLink")}
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
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
        )}

        <p className="mt-6 text-center text-sm text-gray-600">
          <Link to="/login" className="font-semibold text-brand-red hover:underline">
            {t("backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}
