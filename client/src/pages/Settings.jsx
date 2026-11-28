import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Camera, KeyRound, Mail, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { changePassword, updateProfile } from "../services/auth";
import { parseError } from "../utils/errors";
import FormField from "../components/FormField";
import EmailVerifyCard from "../components/EmailVerifyCard";
import UserAvatar from "../components/UserAvatar";
import { uploadAvatar, removeAvatar } from "../services/avatar";
import { squareAvatar } from "../utils/imageResize";
import { getTwoFactorStatus, newBackupCodes } from "../services/twoFactor";
import twoStepDict from "../i18n/twoStep";
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

// Two-step verification (admin, doctor and bank staff accounts): status and new backup codes
function TwoStepSection() {
  const { t, date } = useT(twoStepDict);
  const [status, setStatus] = useState(null);
  const [asking, setAsking] = useState(false);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getTwoFactorStatus()
      .then((s) => active && setStatus(s))
      .catch(() => active && setStatus(null));
    return () => {
      active = false;
    };
  }, [codes]);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await newBackupCodes(code.trim());
      setCodes(data.backupCodes);
      setAsking(false);
      setCode("");
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;
  return (
    <Section icon={ShieldCheck} title={t("settingsTitle")}>
      {status.enabled ? (
        <>
          <p className="text-sm text-gray-700">{t("settingsOn", { date: date(status.enabledAt) })}</p>
          <p className="mt-1 text-sm text-gray-500">{t("backupLeft", { count: status.backupCodesLeft })}</p>
          {codes && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900">{t("backupText")}</p>
              <ol className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm text-gray-900">
                {codes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ol>
            </div>
          )}
          {asking ? (
            <form onSubmit={create} className="mt-4 flex flex-wrap items-end gap-3">
              <label className="block text-sm text-gray-700">
                {t("newCodesText")}
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={7}
                  placeholder="123456"
                  className="mt-1 block w-36 rounded-lg border border-gray-300 px-3 py-2 font-mono tracking-widest outline-none focus:border-brand-blue focus:ring-2 focus:ring-blue-200"
                />
              </label>
              <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
                {t("create")}
              </button>
              <button type="button" onClick={() => setAsking(false)} className="btn-secondary">
                {t("cancel")}
              </button>
            </form>
          ) : (
            <button type="button" onClick={() => setAsking(true)} className="btn-secondary mt-4">
              <KeyRound size={16} /> {t("newCodes")}
            </button>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-700">{t("settingsRequired")}</p>
      )}
    </Section>
  );
}

// Profile picture: chosen photo is cropped and shrunk in the browser, then uploaded
function PictureSection() {
  const { user, setUser } = useAuth();
  const { t } = useT(dict);
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // choosing the same file again still triggers a change
    if (!file) return;
    setBusy(true);
    try {
      const blob = await squareAvatar(file);
      const data = await uploadAvatar(blob);
      setUser((u) => ({ ...u, avatar: data.avatar }));
      toast.success(t("pictureUpdated"));
    } catch (err) {
      const key = { notImage: "pictureNotImage", tooBig: "pictureTooBig", cantRead: "pictureCantRead" }[err.message];
      toast.error(key ? t(key) : parseError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      await removeAvatar();
      setUser((u) => ({ ...u, avatar: null }));
      toast.success(t("pictureRemoved"));
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section icon={Camera} title={t("pictureTitle")} description={t("pictureDesc")}>
      <div className="flex flex-wrap items-center gap-5">
        <UserAvatar name={user.name} src={user.avatar} size="h-24 w-24 text-3xl" tone="red" />
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/*"
            onChange={handleFile}
            className="hidden"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-red px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
          >
            <Camera size={16} />
            {busy ? t("pictureSaving") : user.avatar ? t("pictureChange") : t("pictureUpload")}
          </button>
          {user.avatar && (
            <button
              type="button"
              disabled={busy}
              onClick={handleRemove}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
            >
              <Trash2 size={16} />
              {t("pictureRemove")}
            </button>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-500">{t("pictureNote")}</p>
    </Section>
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

      <PictureSection />

      <ProfileSection />

      {hasPassword === undefined ? (
        <section className="rounded-2xl bg-white p-6 text-sm text-gray-500 shadow-sm">{t("loadingPassword")}</section>
      ) : (
        <PasswordSection hasPassword={hasPassword} onPasswordSet={() => setHasPassword(true)} />
      )}

      {(user.twoFactorRequired || user.twoFactorEnabled) && <TwoStepSection />}

      <Section icon={Mail} title={t("common:email")} description={t("emailDesc")}>
        <EmailVerifyCard />
      </Section>
    </div>
  );
}
