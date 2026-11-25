import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Stethoscope,
  PhoneCall,
  Info,
  HandCoins,
  MessageCircleQuestion,
  UserRoundCheck,
  MessagesSquare,
  Search,
  BadgeCheck,
  MapPin,
  Building2,
  Inbox,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import useT from "../../i18n/useT";
import dict from "../../i18n/doctors";
import usePageTitle from "../../hooks/usePageTitle";
import { listDoctors } from "../../services/doctors";
import { listPublicAnswers, CONSULTATION_CATEGORIES } from "../../services/consultations";
import Spinner from "../../components/Spinner";
import Pagination from "../../components/Pagination";

// Round photo, or the person's initials when there is no photo
export function DoctorAvatar({ person, size = "h-12 w-12 text-base" }) {
  if (person?.avatar) {
    return <img src={person.avatar} alt="" referrerPolicy="no-referrer" className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  const initials = (person?.name || "?")
    .replace(/^dr\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-brand-blue/10 font-semibold text-brand-blue`}
    >
      {initials}
    </span>
  );
}

// Emergency / general guidance / never pay. compact = one block for forms.
export function SafetyNotice({ compact = false }) {
  const { t } = useT(dict);
  const items = [
    { icon: PhoneCall, text: t("safetyEmergency"), strong: true },
    { icon: Info, text: t("safetyGeneral") },
    { icon: HandCoins, text: t("safetyFree"), link: true },
  ];
  return (
    <section
      aria-label={t("safetyTitle")}
      className={`rounded-2xl border border-red-200 bg-red-50 text-sm text-gray-800 ${compact ? "p-4" : "p-5 sm:p-6"}`}
    >
      <h2 className="font-bold text-brand-red-dark">{t("safetyTitle")}</h2>
      <ul className="mt-3 space-y-2.5">
        {items.map(({ icon: Icon, text, strong, link }) => (
          <li key={text} className="flex items-start gap-2.5">
            <Icon size={18} className="mt-0.5 shrink-0 text-brand-red" aria-hidden="true" />
            <span className={strong ? "font-semibold text-brand-red-dark" : ""}>
              {text}
              {link && (
                <>
                  {" "}
                  <Link to="/complaints" className="font-semibold text-brand-blue underline">
                    {t("reportAbuse")}
                  </Link>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function DoctorsHome() {
  const { t } = useT(dict);
  const { user } = useAuth();
  usePageTitle(t("pageTitle"));

  const askTo = "/doctors/ask";
  const isDoctor = user?.role === "doctor";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Hero */}
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-brand-red">
            <Stethoscope size={16} aria-hidden="true" /> {t("eyebrow")}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-brand-blue sm:text-4xl">{t("heroTitle")}</h1>
          <p className="mt-3 max-w-2xl text-gray-600">{t("heroIntro")}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to={user ? askTo : "/login"}
              state={user ? undefined : { from: { pathname: askTo } }}
              title={user ? undefined : t("loginToAsk")}
              className="btn-primary"
            >
              <MessageCircleQuestion size={18} aria-hidden="true" /> {t("askCta")}
            </Link>
            {user && (
              <Link to="/consultations" className="btn-secondary">
                <Inbox size={18} aria-hidden="true" /> {t("myQuestionsCta")}
              </Link>
            )}
            {isDoctor ? (
              <Link to="/doctor-portal" className="btn-secondary">
                <Stethoscope size={18} aria-hidden="true" /> {t("portalCta")}
              </Link>
            ) : (
              <Link
                to={user ? "/doctors/join" : "/login"}
                state={user ? undefined : { from: { pathname: "/doctors/join" } }}
                className="inline-flex items-center gap-1.5 px-2 py-2.5 text-sm font-semibold text-brand-blue hover:underline"
              >
                <UserRoundCheck size={18} aria-hidden="true" /> {t("joinCta")}
              </Link>
            )}
          </div>
        </div>

        <SafetyNotice />
      </section>

      {/* How it works */}
      <section className="mt-12" aria-labelledby="how-title">
        <h2 id="how-title" className="text-2xl font-bold text-brand-blue">
          {t("howTitle")}
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            { icon: MessageCircleQuestion, title: t("step1Title"), body: t("step1Body") },
            { icon: BadgeCheck, title: t("step2Title"), body: t("step2Body") },
            { icon: MessagesSquare, title: t("step3Title"), body: t("step3Body") },
          ].map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="card p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-brand-red">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="text-sm font-bold text-gray-400" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-3 font-semibold text-gray-800">{title}</h3>
              <p className="mt-1 text-sm text-gray-600">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <DoctorsGrid />
      <PublicFaq />
    </div>
  );
}

function DoctorsGrid() {
  const { t, dist } = useT(dict);
  const [res, setRes] = useState({ status: "loading", doctors: [] });

  useEffect(() => {
    let cancelled = false;
    listDoctors()
      .then((data) => !cancelled && setRes({ status: "ready", doctors: data.doctors || [] }))
      .catch(() => !cancelled && setRes({ status: "error", doctors: [] }));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mt-12" aria-labelledby="doctors-title">
      <h2 id="doctors-title" className="text-2xl font-bold text-brand-blue">
        {t("doctorsTitle")}
      </h2>
      <p className="mt-1 text-sm text-gray-600">{t("doctorsIntro")}</p>

      {res.status === "loading" ? (
        <Spinner className="py-12" />
      ) : res.status === "error" ? (
        <p className="mt-4 text-sm text-red-600">{t("doctorsError")}</p>
      ) : res.doctors.length === 0 ? (
        <p className="card mt-4 p-6 text-center text-sm text-gray-500">{t("doctorsEmpty")}</p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {res.doctors.map((d) => (
            <li key={d.id} className="card flex flex-col p-5">
              <div className="flex items-start gap-3">
                <DoctorAvatar person={d} />
                <div className="min-w-0">
                  <h3 className="flex items-center gap-1 font-semibold text-gray-800">
                    <span className="truncate">{d.name}</span>
                    <BadgeCheck size={16} className="shrink-0 text-brand-blue" aria-label={t("verified")} />
                  </h3>
                  <p className="text-sm font-medium text-brand-red">{t(`specialty_${d.specialty}`)}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm text-gray-600">
                <p className="flex items-start gap-1.5">
                  <Building2 size={15} className="mt-0.5 shrink-0 text-gray-400" aria-hidden="true" />
                  <span>{d.hospital}</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <MapPin size={15} className="shrink-0 text-gray-400" aria-hidden="true" />
                  <span>{dist(d.district)}</span>
                </p>
              </div>
              {d.bio && <p className="mt-2 line-clamp-3 text-sm text-gray-500">{d.bio}</p>}
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-4 text-xs">
                <span
                  className={`rounded-full px-2.5 py-0.5 font-semibold ${
                    d.acceptingQuestions ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {d.acceptingQuestions ? t("accepting") : t("notAccepting")}
                </span>
                <span className="text-gray-500">{t("answered", { count: d.answeredCount || 0 })}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PublicFaq() {
  const { t } = useT(dict);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState({ q: "", category: "", page: 1 });
  const [res, setRes] = useState({ status: "loading", answers: [], total: 0, pages: 1 });

  useEffect(() => {
    let cancelled = false;
    const params = { page: query.page };
    if (query.q) params.q = query.q;
    if (query.category) params.category = query.category;
    listPublicAnswers(params)
      .then(
        (data) =>
          !cancelled &&
          setRes({ status: "ready", answers: data.answers || [], total: data.total || 0, pages: data.pages || 1 })
      )
      .catch(() => !cancelled && setRes({ status: "error", answers: [], total: 0, pages: 1 }));
    return () => {
      cancelled = true;
    };
  }, [query]);

  function search(e) {
    e.preventDefault();
    setRes((r) => ({ ...r, status: "loading" }));
    setQuery((q) => ({ ...q, q: draft.trim(), page: 1 }));
  }

  function setCategory(category) {
    setRes((r) => ({ ...r, status: "loading" }));
    setQuery((q) => ({ ...q, category, page: 1 }));
  }

  function setPage(page) {
    setRes((r) => ({ ...r, status: "loading" }));
    setQuery((q) => ({ ...q, page }));
    document.getElementById("faq-title")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section className="mt-12" aria-labelledby="faq-title">
      <h2 id="faq-title" className="text-2xl font-bold text-brand-blue">
        {t("faqTitle")}
      </h2>
      <p className="mt-1 text-sm text-gray-600">{t("faqIntro")}</p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <form onSubmit={search} role="search" className="flex flex-1 gap-2">
          <label className="relative flex-1">
            <span className="sr-only">{t("faqSearchLabel")}</span>
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("faqSearchPlaceholder")}
              maxLength={100}
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-200"
            />
          </label>
          <button type="submit" className="btn-secondary">
            {t("common:search")}
          </button>
        </form>
        <label className="sm:w-64">
          <span className="sr-only">{t("topic")}</span>
          <select
            value={query.category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-200"
          >
            <option value="">{t("allCategories")}</option>
            {CONSULTATION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`category_${c}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {res.status === "loading" ? (
        <Spinner className="py-12" />
      ) : res.status === "error" ? (
        <p className="mt-4 text-sm text-red-600">{t("faqError")}</p>
      ) : res.answers.length === 0 ? (
        <p className="card mt-4 p-6 text-center text-sm text-gray-500">{t("faqEmpty")}</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-gray-500" aria-live="polite">
            {t("faqCount", { count: res.total })}
          </p>
          <ul className="mt-2 space-y-3">
            {res.answers.map((a) => (
              <FaqItem key={a.id} answer={a} />
            ))}
          </ul>
          <Pagination page={query.page} pages={res.pages} onChange={setPage} />
        </>
      )}
    </section>
  );
}

function FaqItem({ answer }) {
  const { t, date } = useT(dict);
  const [open, setOpen] = useState(false);
  const doctor = answer.doctor;
  const messages = answer.messages || [];
  const firstDoctorReply = messages.find((m) => m.from === "doctor");
  const shown = open ? messages : firstDoctorReply ? [firstDoctorReply] : [];
  const hasMore = messages.length > shown.length || (firstDoctorReply?.text || "").length > 400;
  const bodyId = `faq-${answer.id}`;

  return (
    <li className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-semibold text-brand-blue">
          {t(`category_${answer.category}`)}
        </span>
        <span className="text-gray-400">{t("answeredOn", { date: date(answer.answeredAt) })}</span>
      </div>
      <h3 className="mt-2 font-semibold text-gray-800">{answer.subject}</h3>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-600">{answer.question}</p>

      <div id={bodyId} className="mt-4 space-y-3">
        {shown.map((m, i) =>
          m.from === "doctor" ? (
            <div key={i} className="rounded-xl border-l-4 border-brand-blue bg-blue-50 p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <DoctorAvatar person={doctor} size="h-8 w-8 text-xs" />
                <div className="min-w-0 text-xs">
                  <div className="font-semibold text-brand-blue">{doctor?.name || t("doctorFallback")}</div>
                  <div className="text-gray-500">
                    {[doctor?.specialty && t(`specialty_${doctor.specialty}`), doctor?.hospital].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>
              <p className={`mt-2 whitespace-pre-wrap break-words text-sm text-gray-700 ${open ? "" : "line-clamp-6"}`}>
                {m.text}
              </p>
            </div>
          ) : (
            <div key={i} className="rounded-xl bg-gray-50 p-3 text-sm">
              <div className="text-xs font-semibold text-gray-500">{t("askerFollowUp")}</div>
              <p className="mt-1 whitespace-pre-wrap break-words text-gray-700">{m.text}</p>
            </div>
          )
        )}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline"
        >
          {open ? t("showLess") : t("showMore")}
          <ChevronDown size={16} className={`transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}
