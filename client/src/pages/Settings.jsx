import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { KeyRound, Mail, UserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { changePassword, updateProfile } from "../services/auth";
import { parseError } from "../utils/errors";
import FormField from "../components/FormField";
import EmailVerifyCard from "../components/EmailVerifyCard";
import usePageTitle from "../hooks/usePageTitle";
import useT from "../i18n/useT";
import dict from "../i18n/account";

const EMPTY_PASSWORDS = { currentPassword: "", newPassword: "", confirmPassword: "" };

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon size={20} className="text-brand-red" />
        <h2 className="text-lg font-semibold text-brand-blue">{title}</h2>
      </div>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ReadOnlyField({ label, value, note }) {
  const { t } = useT(dict);
  return (
    <div>
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-gray-700">
        {value || <span className="text-gray-400">{t("notAdded")}</span>}
      </div>
      {note && <div className="mt-1 text-xs text-gray-500">{note}</div>}
    </div>
  );
}

function ProfileSection() {
  const { user, setUser } = useAuth();
  const { t } = useT(dict);
  const [name, setName] = useState(user.name || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const trimmed = name.trim();
  const unchanged = trimmed === user.name;

  async function handleSubmit(e) {
    e.preventDefault();
    if (trimmed.length < 2 || trimmed.length > 80) {
      setError(t("nameLength"));
      return;
    }
    setError("");
    setSaving(true);
    try {
      const data = await updateProfile(trimmed);
      setUser((prev) => ({ ...prev, ...data.user }));
      setName(data.user.name);
      toast.success(t("profileUpdated"));
    } catch (err) {
      const { message, fields } = parseError(err);
      if (fields.name) setError(fields.name);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const emailNote = !user.email ? (
    t("emailNoteAdd")
  ) : user.isEmailVerified ? (
    <span className="font-medium text-green-700">{t("verified")}</span>
  ) : (
    <span className="font-medium text-amber-700">{t("emailNoteUnverified")}</span>
  );

  const phoneNote = user.phone ? (
    t("phoneNoteFixed")
  ) : (
    <>
      {t("noPhone")}{" "}
      <Link to="/add-phone" className="font-medium text-brand-blue hover:underline">
        {t("addOne")}
      </Link>
    </>
  );

  return (
    <Section icon={UserRound} title={t("profile")} description={t("profileDesc")}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField
          label={t("fullName")}
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <ReadOnlyField label={t("phoneNumber")} value={user.phone} note={phoneNote} />
          <ReadOnlyField label={t("common:email")} value={user.email} note={emailNote} />
        </div>
        <button
          type="submit"
          disabled={saving || unchanged}
          className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
        >
          {saving ? t("common:saving") : t("saveChanges")}
        </button>
      </form>
    </Section>
  );
}

function PasswordSection({ hasPassword, onPasswordSet }) {
  const { saveSession } = useAuth();
  const { t } = useT(dict);
  const [form, setForm] = useState(EMPTY_PASSWORDS);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();

    const found = {};
    if (hasPassword && !form.currentPassword) found.currentPassword = t("currentRequired");
    if (form.newPassword.length < 8) found.newPassword = t("passwordMin");
    else if (hasPassword && form.newPassword === form.currentPassword) {
      found.newPassword = t("passwordSame");
    }
    if (form.confirmPassword !== form.newPassword) found.confirmPassword = t("passwordMismatch");
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      const payload = { newPassword: form.newPassword };
      if (hasPassword) payload.currentPassword = form.currentPassword;
      const data = await changePassword(payload);
      saveSession(data); // the old token no longer works; keep this tab logged in with the new one
      onPasswordSet();
      setForm(EMPTY_PASSWORDS);
      toast.success(data.message || t("passwordUpdated"));
    } catch (err) {
      const { message, fields } = parseError(err);
      setErrors(fields);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      icon={KeyRound}
      title={hasPassword ? t("changePassword") : t("setAPassword")}
      description={
        hasPassword
          ? t("changeDesc")
          : t("setDesc")
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {hasPassword && (
          <FormField
            label={t("currentPassword")}
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={handleChange}
            error={errors.currentPassword}
          />
        )}
        <FormField
          label={t("newPassword")}
          name="newPassword"
          type="password"
          autoComplete="new-password"
          hint={t("atLeast8")}
          value={form.newPassword}
          onChange={handleChange}
          error={errors.newPassword}
        />
        <FormField
          label={t("confirmNewPassword")}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
        >
          {saving ? t("common:saving") : hasPassword ? t("changePassword") : t("setPassword")}
        </button>
      </form>
    </Section>
  );
}

export default function Settings() {
  const { t } = useT(dict);
  usePageTitle(t("pageTitle"));
  const { user, refreshUser } = useAuth();
  // Only GET /auth/me (and the settings endpoints) report hasPassword, and other screens may
  // replace `user` without it, so the page keeps its own copy and re-reads it on open.
  const [hasPassword, setHasPassword] = useState(user?.hasPassword);

  useEffect(() => {
    let active = true;
    refreshUser()
      .then((fresh) => {
        if (active && fresh) setHasPassword(fresh.hasPassword);
      })
      .catch((err) => {
        if (active) toast.error(parseError(err).message);
      });
    return () => {
      active = false;
    };
    // Run once when the page opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold text-brand-blue">{t("pageTitle")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("pageSubtitle")}</p>
      </div>

      <ProfileSection />

      {hasPassword === undefined ? (
        <section className="rounded-2xl bg-white p-6 text-sm text-gray-500 shadow-sm">{t("loadingPassword")}</section>
      ) : (
        <PasswordSection hasPassword={hasPassword} onPasswordSet={() => setHasPassword(true)} />
      )}

      <Section icon={Mail} title={t("common:email")} description={t("emailDesc")}>
        <EmailVerifyCard />
      </Section>
    </div>
  );
}
