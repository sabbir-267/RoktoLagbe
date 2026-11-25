import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { MessageCircleQuestion, Lock, ArrowLeft } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import useT from "../../i18n/useT";
import dict from "../../i18n/doctors";
import usePageTitle from "../../hooks/usePageTitle";
import { parseError } from "../../utils/errors";
import {
  askQuestion,
  CONSULTATION_CATEGORIES,
  PATIENT_SEXES,
  SUBJECT_MIN,
  SUBJECT_MAX,
  QUESTION_MIN,
  QUESTION_MAX,
} from "../../services/consultations";
import FormField from "../../components/FormField";
import SelectField from "../../components/SelectField";
import Spinner from "../../components/Spinner";
import { SafetyNotice } from "./DoctorsHome";

const EMPTY = { category: "", subject: "", question: "", patientAge: "", patientSex: "", shareAnonymously: false };

export default function AskDoctor() {
  const { t } = useT(dict);
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  usePageTitle(t("askTitle"));

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  function check() {
    const er = {};
    if (!form.category) er.category = t("errCategory");
    const subject = form.subject.trim();
    if (subject.length < SUBJECT_MIN || subject.length > SUBJECT_MAX) er.subject = t("errSubject");
    if (form.question.trim().length < QUESTION_MIN) er.question = t("errQuestion");
    if (form.patientAge !== "") {
      const age = Number(form.patientAge);
      if (!Number.isInteger(age) || age < 0 || age > 120) er.patientAge = t("errAge");
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
      question: form.question.trim(),
      shareAnonymously: form.shareAnonymously,
    };
    if (form.patientAge !== "") body.patientAge = Number(form.patientAge);
    if (form.patientSex) body.patientSex = form.patientSex;

    setBusy(true);
    try {
      const data = await askQuestion(body);
      toast.success(t("askedToast"));
      navigate(`/consultations/${data.consultation.id}`);
    } catch (err) {
      const { message, fields } = parseError(err);
      setErrors(fields);
      toast.error(message);
      setBusy(false);
    }
  }

  const subjectLen = form.subject.length;
  const questionLen = form.question.length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/doctors" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline">
        <ArrowLeft size={16} aria-hidden="true" /> {t("pageTitle")}
      </Link>
      <h1 className="mt-3 flex items-center gap-2 text-3xl font-bold text-brand-blue">
        <MessageCircleQuestion size={28} aria-hidden="true" /> {t("askTitle")}
      </h1>
      <p className="mt-2 text-gray-600">{t("askIntro")}</p>
      <p className="mt-3 flex items-start gap-2 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-brand-blue">
        <Lock size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{t("privateNote")}</span>
      </p>

      <form onSubmit={submit} noValidate className="card mt-6 space-y-5 p-6 sm:p-8">
        <SelectField label={t("category")} value={form.category} onChange={set("category")} error={errors.category}>
          <option value="">{t("chooseCategory")}</option>
          {CONSULTATION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`category_${c}`)}
            </option>
          ))}
        </SelectField>

        <div>
          <FormField
            label={t("subject")}
            placeholder={t("subjectPlaceholder")}
            value={form.subject}
            onChange={set("subject")}
            maxLength={SUBJECT_MAX}
            error={errors.subject}
          />
          <p className={`mt-1 text-right text-xs ${subjectLen >= SUBJECT_MAX ? "text-red-600" : "text-gray-400"}`}>
            {t("chars", { used: subjectLen, max: SUBJECT_MAX })}
          </p>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">{t("question")}</span>
          <textarea
            rows={7}
            value={form.question}
            onChange={set("question")}
            maxLength={QUESTION_MAX}
            placeholder={t("questionPlaceholder")}
            aria-invalid={!!errors.question}
            className={`mt-1 w-full rounded-lg border bg-white px-3 py-2.5 outline-none transition focus:ring-2 ${
              errors.question
                ? "border-red-400 focus:ring-red-200"
                : "border-gray-300 focus:border-brand-blue focus:ring-blue-200"
            }`}
          />
          <span className="mt-1 flex justify-between gap-3 text-xs">
            <span className="text-red-600">{errors.question || ""}</span>
            <span
              className={
                questionLen >= QUESTION_MAX || (questionLen > 0 && form.question.trim().length < QUESTION_MIN)
                  ? "text-red-600"
                  : "text-gray-400"
              }
            >
              {t("chars", { used: questionLen, max: QUESTION_MAX })}
            </span>
          </span>
        </label>

        <fieldset className="rounded-2xl border border-gray-200 bg-surface p-4 sm:p-5">
          <legend className="px-1 text-sm font-semibold text-brand-blue">{t("patientTitle")}</legend>
          <p className="text-sm text-gray-500">{t("patientHint")}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <FormField
              label={t("patientAge")}
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              value={form.patientAge}
              onChange={set("patientAge")}
              error={errors.patientAge}
            />
            <SelectField label={t("patientSex")} value={form.patientSex} onChange={set("patientSex")} error={errors.patientSex}>
              <option value="">{t("sexNotSay")}</option>
              {PATIENT_SEXES.map((s) => (
                <option key={s} value={s}>
                  {t(`sex_${s}`)}
                </option>
              ))}
            </SelectField>
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 p-4">
          <input
            type="checkbox"
            checked={form.shareAnonymously}
            onChange={set("shareAnonymously")}
            aria-describedby="share-hint"
            className="mt-1 h-4 w-4 shrink-0 accent-brand-red"
          />
          <span>
            <span className="text-sm font-semibold text-gray-800">{t("shareLabel")}</span>
            <span id="share-hint" className="mt-1 block text-xs text-gray-500">
              {t("shareHint")}
            </span>
          </span>
        </label>

        <SafetyNotice compact />

        <div className="flex justify-end">
          <button type="submit" disabled={busy} className="btn-primary w-full sm:w-auto">
            {busy ? t("submitting") : t("submit")}
          </button>
        </div>
      </form>
    </div>
  );
}
