import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search, PhoneCall, UserPlus, ShieldCheck, Zap, Building2, ArrowRight, CheckCircle2, Sparkles,
} from "lucide-react";
import { api } from "../services/api";
import { listRequests } from "../services/requests";
import { normalizeRequest } from "../utils/requests";
import BloodGroupPicker from "../components/BloodGroupPicker";
import StatCounter from "../components/StatCounter";
import RequestCard from "../components/RequestCard";
import useT from "../i18n/useT";
import dict from "../i18n/home";

const steps = [
  { icon: Search, key: "stepSearch" },
  { icon: PhoneCall, key: "stepConnect" },
  { icon: UserPlus, key: "stepGive" },
];

const features = [
  { icon: ShieldCheck, key: "featVerified" },
  { icon: Sparkles, key: "featSmart" },
  { icon: Building2, key: "featStock" },
  { icon: Zap, key: "featUrgent" },
];

const trust = ["trustFree", "trustConsent", "trustDistricts"];

export default function Home() {
  const { t, n } = useT(dict);
  const [stats, setStats] = useState(null);
  const [urgent, setUrgent] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/stats")
      .then((r) => !cancelled && setStats(r.data.stats))
      .catch(() => {});
    listRequests({ limit: 3 })
      .then((d) => !cancelled && setUrgent((d.requests || []).map(normalizeRequest)))
      .catch(() => !cancelled && setUrgent([]));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-red-dark via-brand-red to-[#7a1730] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-brand-blue/30 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-[1.15fr_1fr] md:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide ring-1 ring-white/20">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-300" />
              {stats ? t("availableNow", { count: Number(stats.availableDonors) || 0 }) : t("tagline")}
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] md:text-6xl">
              {t("heroTitle")}
              <br />
              <span className="text-red-100">{t("heroTitle2")}</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-red-50/90">
              {t("heroText")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/requests/new"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-brand-red shadow-lg shadow-black/10 transition hover:bg-red-50"
              >
                {t("requestBlood")} <ArrowRight size={18} />
              </Link>
              <Link
                to="/register"
                className="rounded-lg px-6 py-3 font-semibold text-white ring-1 ring-white/60 transition hover:bg-white/10"
              >
                {t("common:register")}
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-red-50/90">
              {trust.map((k) => (
                <li key={k} className="flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-red-200" /> {t(k)}
                </li>
              ))}
            </ul>
          </div>

          <BloodGroupPicker />
        </div>
      </section>

      {/* Live numbers */}
      <section className="relative z-10 mx-auto -mt-10 max-w-6xl px-4">
        <div className="card grid grid-cols-2 gap-8 p-8 md:grid-cols-4">
          <StatCounter end={stats?.donors ?? 0} label={t("statDonors")} format={n} />
          <StatCounter end={stats?.fulfilled ?? 0} label={t("statFulfilled")} format={n} />
          <StatCounter end={stats?.banks ?? 0} label={t("statBanks")} format={n} />
          <StatCounter end={stats?.open ?? 0} label={t("statOpen")} format={n} />
        </div>
      </section>

      {/* Urgent requests */}
      {urgent && urgent.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-red">{t("neededSoon")}</p>
              <h2 className="mt-1 text-3xl font-bold text-gray-900">{t("urgentTitle")}</h2>
            </div>
            <Link to="/requests" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline">
              {t("seeAllRequests")} <ArrowRight size={16} />
            </Link>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {urgent.map((r) => (
              <RequestCard key={r.id} request={r} />
            ))}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 pt-20">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-red">{t("howItWorks")}</p>
          <h2 className="mt-1 text-3xl font-bold text-gray-900">{t("stepsTitle")}</h2>
        </div>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map(({ icon: Icon, key }, i) => (
            <li key={key} className="card relative p-6">
              <span className="absolute right-5 top-4 text-5xl font-extrabold text-gray-100">{n(i + 1)}</span>
              <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-brand-red">
                <Icon size={24} />
              </div>
              <h3 className="relative mt-4 text-lg font-semibold text-gray-900">{t(`${key}Title`)}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-gray-600">{t(`${key}Text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 pt-20">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-red">{t("whyUs")}</p>
          <h2 className="mt-1 text-3xl font-bold text-gray-900">{t("featuresTitle")}</h2>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {features.map(({ icon: Icon, key }) => (
            <div key={key} className="card flex gap-4 p-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
                <Icon size={22} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{t(`${key}Title`)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">{t(`${key}Text`)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Call to action */}
      <section className="mx-auto max-w-6xl px-4 pt-20">
        <div className="relative overflow-hidden rounded-3xl bg-brand-blue-dark px-6 py-14 text-center text-white">
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-red/30 blur-3xl" />
          <h2 className="relative text-3xl font-bold md:text-4xl">{t("ctaTitle")}</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-blue-100">
            {t("ctaText")}
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/register" className="btn-primary px-6 py-3 text-base">
              {t("common:register")}
            </Link>
            <Link
              to="/eligibility"
              className="rounded-lg px-6 py-3 font-semibold ring-1 ring-white/50 transition hover:bg-white/10"
            >
              {t("whoCanDonate")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
