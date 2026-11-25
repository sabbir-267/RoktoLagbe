import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { UserRoundCheck, Clock, CheckCircle2, XCircle, PauseCircle, ShieldAlert, ArrowLeft } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import useT from "../../i18n/useT";
import dict from "../../i18n/doctors";
import usePageTitle from "../../hooks/usePageTitle";
import { parseError } from "../../utils/errors";
import { DIVISIONS, DIVISION_NAMES, divisionOfDistrict } from "../../data/bangladesh";
import {
  applyDoctor,
  getMyDoctorProfile,
  DOCTOR_SPECIALTIES,
  DOCTOR_LANGUAGES,
  DOCTOR_STATUS_CHIP,
} from "../../services/doctors";
import FormField from "../../components/FormField";
import SelectField from "../../components/SelectField";
import Spinner from "../../components/Spinner";

const BIO_MAX = 500;
const BMDC_RE = /^[A-Za-z0-9-]{3,20}$/;

const STATUS_CARD = {
  pending: { icon: Clock, cls: "border-amber-200 bg-amber-50", iconCls: "text-amber-600" },
  approved: { icon: CheckCircle2, cls: "border-green-200 bg-green-50", iconCls: "text-green-600" },
  rejected: { icon: XCircle, cls: "border-red-200 bg-red-50", iconCls: "text-brand-red" },
  suspended: { icon: PauseCircle, cls: "border-gray-200 bg-gray-50", iconCls: "text-gray-500" },
};

export default function DoctorJoin() {
  const { t } = useT(dict);
  const { user, loading: authLoading, refreshUser } = useAuth();
  const location = useLocation();
  const [res, setRes] = useState({ status: "loading", doctor: null });
  const [reapply, setReapply] = useState(false);
  usePageTitle(t("joinTitle"));

  const canApplyRole = user && (user.role === "user" || user.role === "doctor");

  useEffect(() => {
    if (!user || !canApplyRole) return;
    let cancelled = false;
    getMyDoctorProfile()
      .then((data) => !cancelled && setRes({ status: "ready", doctor: data.doctor || null }))
      .catch(() => !cancelled && setRes({ status: "error", doctor: null }));
    return () => {
      cancelled = true;
    };
  }, [user, canApplyRole]);

  // The role becomes "doctor" when an admin approves; make sure the session knows
  const approvedButStale = res.doctor?.status === "approved" && user?.role !== "doctor";
  useEffect(() => {
    if (approvedButStale) refreshUser?.();
  }, [approvedButStale, refreshUser]);

  if (authLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  let body;
  if (!canApplyRole) {
    body = (
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
        <ShieldAlert size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{t("staffOnly")}</span>
      </div>
    );
  } else if (res.status === "loading") {
    body = <Spinner />;
  } else if (res.status === "error") {
    body = <p className="mt-6 text-sm text-red-600">{t("common:serverDown")}</p>;
  } else if (res.doctor && !(res.doctor.status === "rejected" && reapply)) {
    body = <ApplicationStatus doctor={res.doctor} onReapply={() => setReapply(true)} />;
  } else if (user.needsPhone) {
    body = (
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
        <span>{t("addPhoneHint")}</span>
        <Link
          to="/add-phone"
          state={{ from: "/doctors/join" }}
          className="rounded-lg bg-brand-blue px-4 py-2 font-semibold text-white transition hover:opacity-90"
        >
          {t("addPhone")}
        </Link>
      </div>
    );
  } else {
    body = (
      <ApplicationForm
        previous={res.doctor}
        onApplied={(doctor) => {
          setReapply(false);
          setRes({ status: "ready", doctor });
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/doctors" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline">
        <ArrowLeft size={16} aria-hidden="true" /> {t("pageTitle")}
      </Link>
      <h1 className="mt-3 flex items-center gap-2 text-3xl font-bold text-brand-blue">
        <UserRoundCheck size={28} aria-hidden="true" /> {t("joinTitle")}
      </h1>
      <p className="mt-2 text-gray-600">{t("joinIntro")}</p>
      {body}
    </div>
  );
}

function ApplicationStatus({ doctor, onReapply }) {
  const { t, date, dist } = useT(dict);
  const card = STATUS_CARD[doctor.status] || STATUS_CARD.pending;
  const Icon = card.icon;

  return (
    <section className={`mt-6 rounded-2xl border p-6 ${card.cls}`} aria-labelledby="application-title">
      <div className="flex items-start gap-3">
        <Icon size={28} className={`shrink-0 ${card.iconCls}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="application-title" className="text-lg font-bold text-gray-800">
              {t(`${doctor.status}Title`)}
            </h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${DOCTOR_STATUS_CHIP[doctor.status] || ""}`}>
              {t(`status_${doctor.status}`)}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-700">{t(`${doctor.status}Body`)}</p>

          {doctor.reviewNote && (doctor.status === "rejected" || doctor.status === "suspended") && (
            <div className="mt-3 rounded-xl border-l-4 border-brand-blue bg-white p-3 text-sm">
              <div className="text-xs font-semibold text-brand-blue">{t("reviewNote")}</div>
              <p className="mt-1 whitespace-pre-wrap text-gray-700">{doctor.reviewNote}</p>
            </div>
          )}

          <dl className="mt-4 grid gap-x-6 gap-y-2 rounded-xl bg-white/70 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-gray-500">{t("bmdcNo")}</dt>
              <dd className="font-medium text-gray-800">{doctor.bmdcNo}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">{t("specialty")}</dt>
              <dd className="font-medium text-gray-800">{t(`specialty_${doctor.specialty}`)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">{t("hospital")}</dt>
              <dd className="font-medium text-gray-800">{doctor.hospital}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">{t("district")}</dt>
              <dd className="font-medium text-gray-800">{dist(doctor.district)}</dd>
            </div>
          </dl>
          {doctor.createdAt && <p className="mt-2 text-xs text-gray-500">{t("appliedOn", { date: date(doctor.createdAt) })}</p>}

          {doctor.status === "approved" && (
            <Link to="/doctor-portal" className="btn-primary mt-4">
              {t("portalCta")}
            </Link>
          )}
          {doctor.status === "rejected" && (
            <button type="button" onClick={onReapply} className="btn-primary mt-4">
              {t("reapply")}
            </button>
          )}
          {doctor.status === "suspended" && (
            <Link to="/complaints" className="btn-secondary mt-4">
              {t("reportAbuse")}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function ApplicationForm({ previous, onApplied }) {
  const { t, dist } = useT(dict);
  const [form, setForm] = useState(() => ({
    bmdcNo: previous?.bmdcNo || "",
    specialty: previous?.specialty || "",
    hospital: previous?.hospital || "",
    division: previous?.district ? divisionOfDistrict(previous.district) : "",
    district: previous?.district || "",
    bio: previous?.bio || "",
    languages: previous?.languages?.length ? previous.languages : ["bn", "en"],
    consent: false,
  }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const clear = (...keys) =>
    setErrors((er) => {
      const next = { ...er };
      keys.forEach((k) => delete next[k]);
      return next;
    });

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    clear(key);
  };

  const setDivision = (e) => {
    setForm((f) => ({ ...f, division: e.target.value, district: "" }));
    clear("division", "district");
  };

  const toggleLanguage = (code) => {
    setForm((f) => ({
      ...f,
      languages: f.languages.includes(code) ? f.languages.filter((l) => l !== code) : [...f.languages, code],
    }));
    clear("languages");
  };

  function check() {
    const er = {};
    if (!BMDC_RE.test(form.bmdcNo.trim())) er.bmdcNo = t("errBmdc");
    if (!form.specialty) er.specialty = t("errSpecialty");
    const hospital = form.hospital.trim();
    if (hospital.length < 2 || hospital.length > 120) er.hospital = t("errHospital");
    if (!form.division) er.division = t("errDivision");
    if (!form.district) er.district = t("errDistrict");
    if (!form.languages.length) er.languages = t("errLanguages");
    if (!form.consent) er.consent = t("errConsent");
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
      bmdcNo: form.bmdcNo.trim(),
      specialty: form.specialty,
      hospital: form.hospital.trim(),
      district: form.district,
      languages: DOCTOR_LANGUAGES.filter((l) => form.languages.includes(l)),
    };
    if (form.bio.trim()) body.bio = form.bio.trim();

    setBusy(true);
    try {
      const data = await applyDoctor(body);
      toast.success(t("appliedToast"));
      onApplied(data.doctor);
    } catch (err) {
      const { message, fields } = parseError(err);
      setErrors(fields);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const districts = form.division ? DIVISIONS[form.division] || [] : [];

  return (
    <form onSubmit={submit} noValidate className="card mt-6 space-y-5 p-6 sm:p-8">
      {previous?.status === "rejected" && previous.reviewNote && (
        <div className="rounded-xl border-l-4 border-brand-red bg-red-50 p-3 text-sm">
          <div className="text-xs font-semibold text-brand-red">{t("reviewNote")}</div>
          <p className="mt-1 whitespace-pre-wrap text-gray-700">{previous.reviewNote}</p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label={t("bmdcNo")}
          value={form.bmdcNo}
          onChange={set("bmdcNo")}
          maxLength={20}
          autoComplete="off"
          hint={t("bmdcHint")}
          error={errors.bmdcNo}
        />
        <SelectField label={t("specialty")} value={form.specialty} onChange={set("specialty")} error={errors.specialty}>
          <option value="">{t("chooseSpecialty")}</option>
          {DOCTOR_SPECIALTIES.map((s) => (
            <option key={s} value={s}>
              {t(`specialty_${s}`)}
            </option>
          ))}
        </SelectField>
      </div>

      <FormField
        label={t("hospital")}
        placeholder={t("hospitalPlaceholder")}
        value={form.hospital}
        onChange={set("hospital")}
        maxLength={120}
        autoComplete="organization"
        error={errors.hospital}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField label={t("division")} value={form.division} onChange={setDivision} error={errors.division}>
          <option value="">{t("chooseDivision")}</option>
          {DIVISION_NAMES.map((d) => (
            <option key={d} value={d}>
              {dist(d)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t("district")}
          value={form.district}
          onChange={set("district")}
          disabled={!form.division}
          error={errors.district}
        >
          <option value="">{t("chooseDistrict")}</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {dist(d)}
            </option>
          ))}
        </SelectField>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-gray-700">{t("bio")}</span>
        <textarea
          rows={4}
          value={form.bio}
          onChange={set("bio")}
          maxLength={BIO_MAX}
          placeholder={t("bioPlaceholder")}
          aria-invalid={!!errors.bio}
          className={`mt-1 w-full rounded-lg border bg-white px-3 py-2.5 outline-none transition focus:ring-2 ${
            errors.bio ? "border-red-400 focus:ring-red-200" : "border-gray-300 focus:border-brand-blue focus:ring-blue-200"
          }`}
        />
        <span className="mt-1 flex justify-between gap-3 text-xs">
          <span className="text-red-600">{errors.bio || ""}</span>
          <span className={form.bio.length >= BIO_MAX ? "text-red-600" : "text-gray-400"}>
            {t("chars", { used: form.bio.length, max: BIO_MAX })}
          </span>
        </span>
      </label>

      <fieldset>
        <legend className="text-sm font-medium text-gray-700">{t("languages")}</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {DOCTOR_LANGUAGES.map((code) => (
            <label
              key={code}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={form.languages.includes(code)}
                onChange={() => toggleLanguage(code)}
                className="h-4 w-4 accent-brand-red"
              />
              {t(`lang_${code}`)}
            </label>
          ))}
        </div>
        {errors.languages && <p className="mt-1 text-xs text-red-600">{errors.languages}</p>}
      </fieldset>

      <div>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 bg-surface p-4">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={set("consent")}
            aria-invalid={!!errors.consent}
            className="mt-1 h-4 w-4 shrink-0 accent-brand-red"
          />
          <span className="text-sm font-medium text-gray-800">{t("consent")}</span>
        </label>
        {errors.consent && <p className="mt-1 text-xs text-red-600">{errors.consent}</p>}
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={busy} className="btn-primary w-full sm:w-auto">
          {busy ? t("applying") : t("apply")}
        </button>
      </div>
    </form>
  );
}
