import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { MessageSquareWarning, ShieldCheck, PhoneCall, CheckCircle2, Link2, Inbox } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import useT from "../i18n/useT";
import dict from "../i18n/complaints";
import usePageTitle from "../hooks/usePageTitle";
import { parseError } from "../utils/errors";
import {
  createComplaint,
  myComplaints,
  COMPLAINT_CATEGORIES,
  STATUS_CHIP,
  isSitePath,
} from "../services/complaints";
import FormField from "../components/FormField";
import SelectField from "../components/SelectField";
import Spinner from "../components/Spinner";

const SUBJECT_MAX = 120;
const MESSAGE_MAX = 2000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Same rule as the server: +8801XXXXXXXXX / 8801XXXXXXXXX / 01XXXXXXXXX, operator digit 3-9
const isBdMobile = (v) => /^(?:\+?88)?01[3-9]\d{8}$/.test(v.replace(/[\s-]/g, ""));

const emptyForm = (search) => {
  const related = search.get("related") || "";
  const category = search.get("category") || "";
  return {
    category: COMPLAINT_CATEGORIES.includes(category) ? category : "",
    subject: "",
    message: "",
    relatedUrl: isSitePath(related) ? related : "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
  };
};

export default function Complaints() {
  const { t } = useT(dict);
  const { user, loading: authLoading } = useAuth();
  const [search] = useSearchParams();
  const [sent, setSent] = useState(null);
  const [refreshMine, setRefreshMine] = useState(0);
  usePageTitle(t("pageTitle"));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-brand-red">
        <MessageSquareWarning size={16} /> {t("eyebrow")}
      </p>
      <h1 className="mt-1 text-3xl font-bold text-brand-blue">{t("title")}</h1>
      <p className="mt-2 text-gray-600">{t("intro")}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-brand-blue">
          <ShieldCheck size={20} className="mt-0.5 shrink-0" />
          <span>{t("reassure")}</span>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-brand-red-dark">
          <PhoneCall size={20} className="mt-0.5 shrink-0" />
          <span>{t("neverPay")}</span>
        </div>
      </div>

      <div className="mt-6">
        {sent ? (
          <Confirmation
            t={t}
            complaint={sent}
            loggedIn={!!user}
            onAnother={() => setSent(null)}
          />
        ) : authLoading ? (
          <Spinner />
        ) : (
          <ComplaintForm
            t={t}
            user={user}
            initial={emptyForm(search)}
            onSent={(c) => {
              setSent(c);
              setRefreshMine((r) => r + 1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}
      </div>

      {user && <MyComplaints key={`${user.id}-${refreshMine}`} />}
    </div>
  );
}

function Confirmation({ t, complaint, loggedIn, onAnother }) {
  return (
    <div className="card p-6 text-center sm:p-8">
      <CheckCircle2 size={40} className="mx-auto text-green-600" />
      <h2 className="mt-3 text-xl font-bold text-gray-800">{t("thanksTitle")}</h2>
      <p className="mt-2 text-sm text-gray-600">{t("thanksBody")}</p>
      <div className="mx-auto mt-4 inline-block rounded-xl border-2 border-dashed border-brand-red/40 bg-red-50 px-6 py-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("reference")}</div>
        <div className="select-all font-mono text-2xl font-extrabold tracking-widest text-brand-red">
          {complaint.reference}
        </div>
      </div>
      <p className="mt-4 text-sm text-gray-500">{loggedIn ? t("thanksTrack") : t("thanksGuest")}</p>
      <button type="button" onClick={onAnother} className="btn-secondary mt-5">
        {t("sendAnother")}
      </button>
    </div>
  );
}

function ComplaintForm({ t, user, initial, onSent }) {
  const location = useLocation();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (errors[key] || errors.contact) setErrors((er) => ({ ...er, [key]: undefined, contact: undefined }));
  };

  function check() {
    const er = {};
    if (!form.category) er.category = t("errCategory");
    const subject = form.subject.trim();
    if (subject.length < 5 || subject.length > SUBJECT_MAX) er.subject = t("errSubject");
    if (form.message.trim().length < 20) er.message = t("errMessage");
    if (form.relatedUrl.trim() && !isSitePath(form.relatedUrl.trim())) er.relatedUrl = t("errRelated");
    if (!user) {
      const phone = form.contactPhone.trim();
      const email = form.contactEmail.trim();
      if (!phone && !email) er.contact = t("errContact");
      if (phone && !isBdMobile(phone)) er.contactPhone = t("errPhone");
      if (email && !EMAIL_RE.test(email)) er.contactEmail = t("errEmail");
    }
    return er;
  }

  async function submit(e) {
    e.preventDefault();
    const er = check();
    setErrors(er);
    if (Object.keys(er).length) {
      toast.error(t("fixErrors"));
      return;
    }
    const body = {
      category: form.category,
      subject: form.subject.trim(),
      message: form.message.trim(),
    };
    if (form.relatedUrl.trim()) body.relatedUrl = form.relatedUrl.trim();
    if (!user) {
      if (form.contactName.trim()) body.contactName = form.contactName.trim();
      if (form.contactPhone.trim()) body.contactPhone = form.contactPhone.trim();
      if (form.contactEmail.trim()) body.contactEmail = form.contactEmail.trim();
    }

    setBusy(true);
    try {
      const data = await createComplaint(body);
      onSent(data.complaint);
    } catch (err) {
      const { message, fields } = parseError(err);
      setErrors(fields);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const messageLen = form.message.length;

  return (
    <form onSubmit={submit} noValidate className="card space-y-5 p-6 sm:p-8">
      <SelectField label={t("category")} value={form.category} onChange={set("category")} error={errors.category}>
        <option value="">{t("chooseCategory")}</option>
        {COMPLAINT_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {t(`cat_${c}`)}
          </option>
        ))}
      </SelectField>

      <FormField
        label={t("subject")}
        placeholder={t("subjectPlaceholder")}
        value={form.subject}
        onChange={set("subject")}
        maxLength={SUBJECT_MAX}
        error={errors.subject}
      />

      <label className="block">
        <span className="text-sm font-medium text-gray-700">{t("message")}</span>
        <textarea
          rows={6}
          value={form.message}
          onChange={set("message")}
          maxLength={MESSAGE_MAX}
          placeholder={t("messagePlaceholder")}
          aria-invalid={!!errors.message}
          className={`mt-1 w-full rounded-lg border bg-white px-3 py-2.5 outline-none transition focus:ring-2 ${
            errors.message
              ? "border-red-400 focus:ring-red-200"
              : "border-gray-300 focus:border-brand-blue focus:ring-blue-200"
          }`}
        />
        <span className="mt-1 flex justify-between gap-3 text-xs">
          <span className="text-red-600">{errors.message || ""}</span>
          <span className={messageLen >= MESSAGE_MAX ? "text-red-600" : "text-gray-400"}>
            {t("chars", { used: messageLen, max: MESSAGE_MAX })}
          </span>
        </span>
      </label>

      <FormField
        label={t("related")}
        placeholder="/requests/…"
        value={form.relatedUrl}
        onChange={set("relatedUrl")}
        maxLength={300}
        hint={t("relatedHint")}
        error={errors.relatedUrl}
      />

      {!user && (
        <fieldset className="space-y-4 rounded-2xl border border-gray-200 bg-surface p-4 sm:p-5">
          <legend className="px-1 text-sm font-semibold text-brand-blue">{t("contactTitle")}</legend>
          <p className="text-sm text-gray-500">{t("contactHint")}</p>
          <FormField
            label={t("yourName")}
            value={form.contactName}
            onChange={set("contactName")}
            maxLength={80}
            autoComplete="name"
            error={errors.contactName}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label={t("phoneLabel")}
              type="tel"
              inputMode="tel"
              placeholder="01XXXXXXXXX"
              value={form.contactPhone}
              onChange={set("contactPhone")}
              maxLength={20}
              autoComplete="tel"
              error={errors.contactPhone}
            />
            <FormField
              label={t("emailLabel")}
              type="email"
              value={form.contactEmail}
              onChange={set("contactEmail")}
              maxLength={120}
              autoComplete="email"
              error={errors.contactEmail}
            />
          </div>
          {errors.contact && <p className="text-xs text-red-600">{errors.contact}</p>}
          <p className="text-sm">
            <Link to="/login" state={{ from: location }} className="font-semibold text-brand-blue hover:underline">
              {t("loginInstead")}
            </Link>
          </p>
        </fieldset>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={busy} className="btn-primary w-full sm:w-auto">
          {busy ? t("sending") : t("send")}
        </button>
      </div>
    </form>
  );
}

function MyComplaints() {
  const { t, date } = useT(dict);
  const [res, setRes] = useState({ status: "loading", rows: [], error: null });

  useEffect(() => {
    let cancelled = false;
    myComplaints()
      .then((data) => !cancelled && setRes({ status: "ready", rows: data.complaints || [], error: null }))
      .catch((err) => !cancelled && setRes({ status: "error", rows: [], error: err }));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-xl font-bold text-brand-blue">
        <Inbox size={20} /> {t("mine")}
      </h2>

      {res.status === "loading" ? (
        <Spinner />
      ) : res.status === "error" ? (
        <p className="mt-3 text-sm text-red-600">{t("mineError")}</p>
      ) : res.rows.length === 0 ? (
        <p className="card mt-3 p-6 text-center text-sm text-gray-500">{t("mineEmpty")}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {res.rows.map((c) => (
            <li key={c.id} className="card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold text-brand-red">{c.reference}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CHIP[c.status] || ""}`}>
                  {t(`st_${c.status}`)}
                </span>
                <span className="text-xs text-gray-400">{t(`cat_${c.category}`)}</span>
                <span className="ml-auto text-xs text-gray-400">{t("sentOn", { date: date(c.createdAt) })}</span>
              </div>
              <h3 className="mt-2 font-semibold text-gray-800">{c.subject}</h3>
              <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-gray-600">{c.message}</p>
              {c.relatedUrl && (
                <Link
                  to={c.relatedUrl}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline"
                >
                  <Link2 size={14} /> {t("openRelated")}
                </Link>
              )}
              {c.adminNote ? (
                <div className="mt-3 rounded-xl border-l-4 border-brand-blue bg-blue-50 p-3 text-sm">
                  <div className="text-xs font-semibold text-brand-blue">{t("adminReply")}</div>
                  <p className="mt-1 whitespace-pre-line text-gray-700">{c.adminNote}</p>
                </div>
              ) : (
                <p className="mt-3 text-xs text-gray-400">{t("noReply")}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
