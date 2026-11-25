import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Stethoscope, Inbox, FolderOpen, CheckCircle2, ShieldAlert, RefreshCw, UserRound, ClipboardList,
} from "lucide-react";
import { getMyDoctorProfile, updateMyDoctorProfile, DOCTOR_LANGUAGES } from "../../services/doctors";
import {
  getConsultationQueue, claimConsultation, CONSULTATION_CATEGORIES, CONSULTATION_STATUS_CHIP,
} from "../../services/consultations";
import { DIVISIONS, DIVISION_NAMES, divisionOfDistrict } from "../../data/bangladesh";
import { parseError } from "../../utils/errors";
import useT from "../../i18n/useT";
import dict from "../../i18n/doctorPortal";
import doctorsDict from "../../i18n/doctors";
import FormField from "../../components/FormField";
import SelectField from "../../components/SelectField";
import Spinner from "../../components/Spinner";

const REFRESH_MS = 30_000;
const ACTIVE = ["claimed", "answered"];

function StatCard({ icon: Icon, label, value, tone = "text-brand-blue" }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className={`flex items-center gap-2 text-sm font-medium ${tone}`}>
        <Icon size={18} />
        {label}
      </div>
      <div className="mt-2 text-3xl font-extrabold text-gray-800">{value}</div>
    </div>
  );
}

export default function DoctorPortal() {
  const { t, n, dist } = useT(dict);
  const { t: td } = useT(doctorsDict);
  const [tab, setTab] = useState("open");
  const [state, setState] = useState({ status: "loading", doctor: null, error: null });
  const [category, setCategory] = useState("");
  const [queue, setQueue] = useState({ status: "loading", open: [], mine: [], error: null });
  const [queueKey, setQueueKey] = useState(0);
  const [toggling, setToggling] = useState(false);

  const loadProfile = useCallback(() => {
    return getMyDoctorProfile()
      .then((data) => setState({ status: "ready", doctor: data.doctor || null, error: null }))
      .catch((err) => setState({ status: "error", doctor: null, error: err }));
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const isDoctor = state.status === "ready" && state.doctor?.status === "approved";
  const refreshQueue = useCallback(() => setQueueKey((k) => k + 1), []);

  // Load the queue, and again whenever the filter changes or a refresh is asked for
  useEffect(() => {
    if (!isDoctor) return undefined;
    let cancelled = false;
    getConsultationQueue(category ? { category } : {})
      .then((data) => {
        if (!cancelled) setQueue({ status: "ready", open: data.open || [], mine: data.mine || [], error: null });
      })
      .catch((err) => {
        if (!cancelled) setQueue((q) => ({ ...q, status: q.status === "loading" ? "error" : q.status, error: err }));
      });
    return () => {
      cancelled = true;
    };
  }, [isDoctor, category, queueKey]);

  // Poll every 30s while the browser tab is visible; refresh straight away when it comes back
  useEffect(() => {
    if (!isDoctor) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refreshQueue();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshQueue();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isDoctor, refreshQueue]);

  if (state.status === "loading") return <Spinner />;

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-brand-blue">{t("portal")}</h1>
        <p className="mt-3 text-gray-600">{t("loadFailed")}</p>
        <p className="mt-1 text-sm text-gray-500">{parseError(state.error).message}</p>
        <button
          type="button"
          onClick={() => {
            setState({ status: "loading", doctor: null, error: null });
            loadProfile();
          }}
          className="btn-primary mt-6"
        >
          {t("common:tryAgain")}
        </button>
      </div>
    );
  }

  if (!isDoctor) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Stethoscope className="mx-auto text-gray-300" size={44} />
        <h1 className="mt-3 text-2xl font-bold text-brand-blue">{t("notDoctorTitle")}</h1>
        <p className="mt-3 text-gray-600">{t("notDoctorText")}</p>
        <Link to="/doctors/join" className="btn-primary mt-6">
          {t("applyLink")}
        </Link>
      </div>
    );
  }

  const doctor = state.doctor;
  const activeCount = queue.mine.filter((c) => ACTIVE.includes(c.status)).length;

  async function toggleAccepting() {
    const next = !doctor.acceptingQuestions;
    setToggling(true);
    try {
      const data = await updateMyDoctorProfile({ acceptingQuestions: next });
      setState((s) => ({ ...s, doctor: { ...s.doctor, ...(data.doctor || { acceptingQuestions: next }) } }));
      toast.success(next ? t("acceptingOn") : t("acceptingOff"));
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setToggling(false);
    }
  }

  const tabs = [
    { key: "open", label: t("tabOpen") },
    { key: "mine", label: t("tabMine") },
    { key: "profile", label: t("tabProfile") },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-brand-red">
            <Stethoscope size={16} /> {t("portal")}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-brand-blue">{doctor.name}</h1>
          <p className="mt-1 text-gray-500">
            {[td(`specialty_${doctor.specialty}`), doctor.hospital, dist(doctor.district)].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="max-w-xs rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <span id="accepting-label" className="text-sm font-semibold text-gray-800">
              {t("accepting")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(doctor.acceptingQuestions)}
              aria-labelledby="accepting-label"
              disabled={toggling}
              onClick={toggleAccepting}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
                doctor.acceptingQuestions ? "bg-green-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  doctor.acceptingQuestions ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {doctor.acceptingQuestions ? t("acceptingOnHint") : t("acceptingOffHint")}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={Inbox} label={t("statOpen")} value={n(queue.open.length)} tone="text-amber-700" />
        <StatCard icon={FolderOpen} label={t("statActive")} value={n(activeCount)} />
        <StatCard icon={CheckCircle2} label={t("statAnswered")} value={n(doctor.answeredCount || 0)} tone="text-green-700" />
      </div>

      <section className="mt-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <ShieldAlert size={20} className="mt-0.5 shrink-0" />
        <div>
          <h2 className="font-semibold">{t("reminderTitle")}</h2>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            <li>{t("reminder1")}</li>
            <li>{t("reminder2")}</li>
            <li>{t("reminder3")}</li>
            <li>{t("reminder4")}</li>
          </ul>
        </div>
      </section>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-gray-200" role="tablist">
        {tabs.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={tab === x.key}
            onClick={() => setTab(x.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              tab === x.key ? "border-brand-red text-brand-red" : "border-transparent text-gray-500 hover:text-brand-blue"
            }`}
          >
            {x.label}
            {x.key === "open" && queue.open.length > 0 && (
              <span className="ml-2 rounded-full bg-brand-red px-2 py-0.5 text-xs text-white">{n(queue.open.length)}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "open" && (
        <OpenQuestions
          queue={queue}
          category={category}
          onCategory={setCategory}
          onRefresh={refreshQueue}
        />
      )}
      {tab === "mine" && <MyCases queue={queue} />}
      {tab === "profile" && (
        <ProfileForm
          key={doctor.id}
          doctor={doctor}
          onSaved={(d) => setState((s) => ({ ...s, doctor: { ...s.doctor, ...d } }))}
        />
      )}
    </div>
  );
}

function QueueError({ queue }) {
  if (queue.status === "loading") return <Spinner className="py-8" />;
  if (queue.status === "error") return <p className="mt-6 text-sm text-red-600">{parseError(queue.error).message}</p>;
  return null;
}

function OpenQuestions({ queue, category, onCategory, onRefresh }) {
  const { t, date } = useT(dict);
  const { t: td } = useT(doctorsDict);
  const navigate = useNavigate();
  const [claimingId, setClaimingId] = useState(null);

  async function claim(c) {
    setClaimingId(c.id);
    try {
      await claimConsultation(c.id);
      toast.success(t("claimed"));
      navigate(`/consultations/${c.id}`);
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error(t("alreadyClaimed"));
        onRefresh();
      } else {
        toast.error(parseError(err).message);
      }
      setClaimingId(null);
    }
  }

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full sm:w-64">
          <SelectField label={t("category")} value={category} onChange={(e) => onCategory(e.target.value)}>
            <option value="">{t("allCategories")}</option>
            {CONSULTATION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {td(`category_${c}`)}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>{t("autoRefresh")}</span>
          <button type="button" onClick={onRefresh} className="btn-secondary px-3 py-2">
            <RefreshCw size={16} /> {t("refresh")}
          </button>
        </div>
      </div>

      {queue.status !== "ready" ? (
        <QueueError queue={queue} />
      ) : queue.open.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-white p-10 text-center shadow-sm">
          <Inbox className="mx-auto text-gray-300" size={44} />
          <p className="mt-3 font-semibold text-gray-800">{category ? t("noOpenFiltered") : t("noOpen")}</p>
          {!category && <p className="mt-1 text-sm text-gray-500">{t("noOpenHint")}</p>}
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {queue.open.map((c) => {
            const patient = [
              c.patientAge != null && c.patientAge !== "" ? t("age", { age: c.patientAge }) : null,
              c.patientSex ? t(`sex_${c.patientSex}`) : null,
            ].filter(Boolean);
            const text = c.question || "";
            return (
              <li key={c.id} className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-semibold text-brand-blue">
                    {td(`category_${c.category}`)}
                  </span>
                  <span className="text-gray-400">{t("asked", { date: date(c.createdAt) })}</span>
                  {patient.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-gray-500">
                      <UserRound size={14} /> {patient.join(" · ")}
                    </span>
                  )}
                </div>
                <h3 className="mt-2 font-semibold text-gray-800">{c.subject}</h3>
                <p className="mt-1 whitespace-pre-line text-sm text-gray-600">
                  {text.length > 300 ? `${text.slice(0, 300)}…` : text}
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    disabled={claimingId !== null}
                    onClick={() => claim(c)}
                    className="btn-primary"
                  >
                    {claimingId === c.id ? t("claiming") : t("claim")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function MyCases({ queue }) {
  const { t, date } = useT(dict);
  const { t: td } = useT(doctorsDict);

  if (queue.status !== "ready") return <QueueError queue={queue} />;

  if (queue.mine.length === 0) {
    return (
      <div className="mt-6 rounded-2xl bg-white p-10 text-center shadow-sm">
        <ClipboardList className="mx-auto text-gray-300" size={44} />
        <p className="mt-3 font-semibold text-gray-800">{t("noMine")}</p>
        <p className="mt-1 text-sm text-gray-500">{t("noMineHint")}</p>
      </div>
    );
  }

  return (
    <ul className="mt-6 grid gap-3 md:grid-cols-2">
      {queue.mine.map((c) => (
        <li key={c.id}>
          <Link
            to={`/consultations/${c.id}`}
            className="block h-full rounded-2xl border border-transparent bg-white p-5 shadow-sm transition hover:border-gray-200 hover:shadow"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2.5 py-0.5 font-semibold ${CONSULTATION_STATUS_CHIP[c.status] || ""}`}>
                {td(`status_${c.status}`)}
              </span>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-semibold text-brand-blue">
                {td(`category_${c.category}`)}
              </span>
              {c.unreadForMe && <span className="h-2 w-2 rounded-full bg-brand-red" aria-hidden="true" />}
            </div>
            <h3 className="mt-2 font-semibold text-gray-800">{c.subject}</h3>
            <p className="mt-2 text-xs text-gray-500">
              {t("lastActivity", { date: date(c.lastActivityAt || c.createdAt) })}
              {" · "}
              {t("messages", { count: c.messageCount || 0 })}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ProfileForm({ doctor, onSaved }) {
  const { t, dist } = useT(dict);
  const { t: td } = useT(doctorsDict);
  const [form, setForm] = useState(() => ({
    bio: doctor.bio || "",
    hospital: doctor.hospital || "",
    division: divisionOfDistrict(doctor.district) || "",
    district: doctor.district || "",
    languages: doctor.languages?.length ? doctor.languages : ["bn", "en"],
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const districts = form.division ? DIVISIONS[form.division] || [] : [];

  const toggleLang = (code) =>
    set({
      languages: form.languages.includes(code)
        ? form.languages.filter((l) => l !== code)
        : DOCTOR_LANGUAGES.filter((l) => l === code || form.languages.includes(l)),
    });

  async function submit(e) {
    e.preventDefault();
    const found = {};
    const hospital = form.hospital.trim();
    if (hospital.length < 2 || hospital.length > 120) found.hospital = t("errHospital");
    if (!form.district) found.district = t("errDistrict");
    if (form.languages.length === 0) found.languages = t("errLanguages");
    if (form.bio.trim().length > 500) found.bio = t("errBio");
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      const data = await updateMyDoctorProfile({
        bio: form.bio.trim(),
        hospital,
        district: form.district,
        languages: form.languages,
      });
      onSaved(data.doctor || { bio: form.bio.trim(), hospital, district: form.district, languages: form.languages });
      toast.success(t("saved"));
    } catch (err) {
      const { message, fields } = parseError(err);
      setErrors(fields);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 max-w-2xl rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="font-semibold text-brand-blue">{t("profileTitle")}</h2>
      <p className="mt-1 text-sm text-gray-500">{t("profileHint")}</p>
      <p className="mt-1 mb-5 text-xs text-gray-400">
        {t("readOnly", { no: doctor.bmdcNo || "—", specialty: td(`specialty_${doctor.specialty}`) })}
      </p>

      <form onSubmit={submit} className="space-y-4" noValidate>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">{t("bio")}</span>
          <textarea
            value={form.bio}
            maxLength={500}
            rows={4}
            onChange={(e) => set({ bio: e.target.value })}
            className={`mt-1 w-full rounded-lg border bg-white px-3 py-2.5 outline-none transition focus:ring-2 ${
              errors.bio ? "border-red-400 focus:ring-red-200" : "border-gray-300 focus:border-brand-blue focus:ring-blue-200"
            }`}
          />
          {errors.bio ? (
            <span className="mt-1 block text-xs text-red-600">{errors.bio}</span>
          ) : (
            <span className="mt-1 block text-xs text-gray-400">
              {t("bioHint")} ({form.bio.length}/500)
            </span>
          )}
        </label>

        <FormField
          label={t("hospital")}
          value={form.hospital}
          maxLength={120}
          onChange={(e) => set({ hospital: e.target.value })}
          error={errors.hospital}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label={t("division")}
            value={form.division}
            onChange={(e) => set({ division: e.target.value, district: "" })}
          >
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
            disabled={!form.division}
            onChange={(e) => set({ district: e.target.value })}
            error={errors.district}
          >
            <option value="">{form.division ? t("chooseDistrict") : t("chooseDivisionFirst")}</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {dist(d)}
              </option>
            ))}
          </SelectField>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-gray-700">{t("languages")}</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {DOCTOR_LANGUAGES.map((code) => (
              <label key={code} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.languages.includes(code)}
                  onChange={() => toggleLang(code)}
                  className="h-4 w-4 accent-brand-red"
                />
                {t(`lang_${code}`)}
              </label>
            ))}
          </div>
          {errors.languages && <span className="mt-1 block text-xs text-red-600">{errors.languages}</span>}
        </fieldset>

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? t("saving") : t("saveProfile")}
        </button>
      </form>
    </section>
  );
}
