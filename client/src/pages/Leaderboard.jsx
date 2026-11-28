import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, Medal, BadgeCheck, Droplets, Users, HeartPulse, Info } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { becomeDonorLink } from "../utils/donorCta";
import { getLeaderboard } from "../services/donors";
import { parseError } from "../utils/errors";
import { BLOOD_GROUPS, DIVISIONS } from "../data/bangladesh";
import SelectField from "../components/SelectField";
import Spinner from "../components/Spinner";
import useT from "../i18n/useT";
import dict from "../i18n/leaderboard";

const PERIODS = [
  { key: "month", label: "periodMonth", phrase: "phraseMonth" },
  { key: "year", label: "periodYear", phrase: "phraseYear" },
  { key: "all", label: "periodAll", phrase: "phraseAll" },
];

const ALL_DISTRICTS = Object.values(DIVISIONS).flat().sort();

// Milestones, highest first
const BADGES = [
  { min: 25, label: "badgeGold", cls: "bg-amber-100 text-amber-800 ring-amber-300" },
  { min: 10, label: "badgeSilver", cls: "bg-slate-100 text-slate-700 ring-slate-300" },
  { min: 5, label: "badgeBronze", cls: "bg-orange-100 text-orange-800 ring-orange-300" },
  { min: 3, label: "badgeRegular", cls: "bg-red-50 text-brand-red ring-red-200" },
  { min: 1, label: "badgeFirst", cls: "bg-blue-50 text-brand-blue ring-blue-200" },
];
const badgeFor = (n) => BADGES.find((b) => n >= b.min);

function Badge({ count }) {
  const { t } = useT(dict);
  const b = badgeFor(count);
  if (!b) return null;
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${b.cls}`}>{t(b.label)}</span>;
}

function Avatar({ person, size = "h-10 w-10 text-sm" }) {
  if (person.avatar) {
    return <img src={person.avatar} alt="" referrerPolicy="no-referrer" className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  const initials = person.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-red-50 font-bold text-brand-red`}>
      {initials || "?"}
    </span>
  );
}

const PODIUM = {
  1: { ring: "ring-amber-400", medal: "text-amber-500", height: "sm:pt-0", label: "place1" },
  2: { ring: "ring-slate-300", medal: "text-slate-400", height: "sm:pt-8", label: "place2" },
  3: { ring: "ring-orange-300", medal: "text-orange-400", height: "sm:pt-12", label: "place3" },
};

function PodiumCard({ leader }) {
  const { t, n, dist } = useT(dict);
  const p = PODIUM[leader.rank] || PODIUM[3];
  return (
    <div className={p.height}>
      <div className="card flex flex-col items-center p-5 text-center">
        <div className="relative">
          <Avatar person={leader} size={`h-16 w-16 text-xl ring-4 ${p.ring}`} />
          <Medal size={26} className={`absolute -bottom-2 -right-2 rounded-full bg-white p-0.5 ${p.medal}`} />
        </div>
        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-gray-400">{t(p.label)}</p>
        <p className="mt-1 flex items-center gap-1 font-semibold text-gray-900">
          <span className="max-w-[12rem] truncate">{leader.name}</span>
          {leader.isVerified && <BadgeCheck size={16} className="shrink-0 text-brand-blue" aria-label={t("verifiedDonor")} />}
        </p>
        <p className="text-sm text-gray-500">
          <span className="font-bold text-brand-red">{leader.bloodGroup}</span> · {dist(leader.district)}
        </p>
        <p className="mt-3 text-3xl font-extrabold text-gray-900">{n(leader.donations)}</p>
        <p className="text-xs text-gray-500">{t("donationWord", { count: leader.donations })}</p>
        <div className="mt-2">
          <Badge count={leader.donations} />
        </div>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const { t, n, date, dist } = useT(dict);
  const { user } = useAuth();
  const [filters, setFilters] = useState({ period: "year", district: "", bloodGroup: "" });
  const [res, setRes] = useState({ key: null, data: null, error: null });

  const params = useMemo(() => {
    const p = { period: filters.period, limit: 50 };
    if (filters.district) p.district = filters.district;
    if (filters.bloodGroup) p.bloodGroup = filters.bloodGroup;
    return p;
  }, [filters]);
  const key = `${JSON.stringify(params)}|${user?.id || ""}`;

  useEffect(() => {
    let cancelled = false;
    getLeaderboard(params)
      .then((data) => !cancelled && setRes({ key, data, error: null }))
      .catch((err) => !cancelled && setRes({ key, data: null, error: err }));
    return () => {
      cancelled = true;
    };
  }, [params, key]);

  const loading = res.key === null;
  const stale = res.key !== key;
  const data = res.data;
  const leaders = data?.leaders || [];
  const podium = leaders.length >= 3 && leaders[2].rank <= 3 ? leaders.slice(0, 3) : [];
  const rest = podium.length ? leaders.slice(3) : leaders;
  const filtered = filters.district || filters.bloodGroup;
  // Filled into sentences such as "Donors {period}" and "You're not on the board {period}{filters}"
  const sentenceVars = {
    period: t(PERIODS.find((p) => p.key === filters.period).phrase),
    filters: filtered ? t("forFilters") : "",
  };
  const badgeList = [...BADGES]
    .reverse()
    .map((b) => `${t(b.label)} (${n(b.min)})`)
    .join(", ");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-brand-red">
            <Trophy size={16} /> {t("eyebrow")}
          </p>
          <h1 className="mt-1 text-4xl font-extrabold text-gray-900">{t("title")}</h1>
          <p className="mt-3 text-gray-600">
            {t("intro")}
          </p>
        </div>
        <div className="inline-flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-gray-200" role="tablist" aria-label={t("periodAria")}>
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={filters.period === p.key}
              onClick={() => setFilters((f) => ({ ...f, period: p.key }))}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                filters.period === p.key ? "bg-brand-red text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {t(p.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 sm:max-w-md">
        <SelectField label={t("common:district")} value={filters.district} onChange={(e) => setFilters((f) => ({ ...f, district: e.target.value }))}>
          <option value="">{t("common:allDistricts")}</option>
          {ALL_DISTRICTS.map((d) => (
            <option key={d} value={d}>
              {dist(d)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t("common:bloodGroup")} value={filters.bloodGroup} onChange={(e) => setFilters((f) => ({ ...f, bloodGroup: e.target.value }))}>
          <option value="">{t("common:allGroups")}</option>
          {BLOOD_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </SelectField>
      </div>

      {loading ? (
        <Spinner />
      ) : res.error && !stale ? (
        <p className="mt-8 text-sm text-red-600">{parseError(res.error).message}</p>
      ) : (
        <div className={stale ? "opacity-60 transition" : "transition"}>
          {/* Totals */}
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { icon: Users, label: "totalDonors", value: data.totals.donors },
              { icon: HeartPulse, label: "totalDonations", value: data.totals.donations },
              { icon: Droplets, label: "totalUnits", value: data.totals.units },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="card p-4 text-center">
                <Icon size={20} className="mx-auto text-brand-red" />
                <p className="mt-1 text-2xl font-extrabold text-gray-900">{n(value)}</p>
                <p className="text-xs text-gray-500">{t(label, sentenceVars)}</p>
              </div>
            ))}
          </div>

          {/* Your position */}
          {data.me && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm">
              {data.me.onBoard ? (
                <span className="text-gray-800">
                  {t("meBefore", sentenceVars)}
                  <strong className="text-brand-red">#{n(data.me.rank)}</strong>
                  {t("meMiddle", sentenceVars)}
                  <strong>{n(data.me.donations)}</strong>
                  {t("meAfter", { count: data.me.donations })}
                </span>
              ) : data.me.optedOut ? (
                <span className="text-gray-700">{t("optedOut")}</span>
              ) : (
                <span className="text-gray-700">
                  {t("notOnBoard", sentenceVars)}
                </span>
              )}
              <Link to="/donor-profile" className="font-semibold text-brand-blue hover:underline">
                {t("settings")}
              </Link>
            </div>
          )}

          {leaders.length === 0 ? (
            <div className="card mt-6 p-10 text-center">
              <Trophy className="mx-auto text-gray-300" size={44} />
              <p className="mt-3 font-semibold text-gray-800">{t("emptyTitle", sentenceVars)}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
                {t("emptyText")}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                {becomeDonorLink(user) && (
                  <Link to={becomeDonorLink(user)} className="btn-primary">
                    {t("common:register")}
                  </Link>
                )}
                <Link to="/blood-banks" className="btn-secondary">
                  {t("findBank")}
                </Link>
              </div>
            </div>
          ) : (
            <>
              {podium.length > 0 && (
                <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:items-start">
                  {/* 2nd, 1st, 3rd on wide screens; in rank order on phones */}
                  <div className="sm:order-2"><PodiumCard leader={podium[0]} /></div>
                  <div className="sm:order-1"><PodiumCard leader={podium[1]} /></div>
                  <div className="sm:order-3"><PodiumCard leader={podium[2]} /></div>
                </div>
              )}

              {rest.length > 0 && (
                <div className="card mt-6 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="w-16 px-4 py-3 font-semibold">{t("colRank")}</th>
                        <th className="px-4 py-3 font-semibold">{t("colDonor")}</th>
                        <th className="px-4 py-3 font-semibold">{t("colGroup")}</th>
                        <th className="px-4 py-3 text-right font-semibold">{t("colDonations")}</th>
                        <th className="hidden px-4 py-3 font-semibold sm:table-cell">{t("colLast")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rest.map((l) => (
                        <tr key={l.donorId}>
                          <td className="px-4 py-3 text-base font-bold text-gray-400">#{n(l.rank)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar person={l} size="h-9 w-9 text-xs" />
                              <div className="min-w-0">
                                <p className="flex items-center gap-1 font-semibold text-gray-900">
                                  <span className="truncate">{l.name}</span>
                                  {l.isVerified && <BadgeCheck size={14} className="shrink-0 text-brand-blue" aria-label={t("verifiedDonor")} />}
                                </p>
                                <p className="text-xs text-gray-500">{dist(l.district)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-bold text-brand-red">{l.bloodGroup}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Badge count={l.donations} />
                              <span className="text-base font-bold text-gray-900">{n(l.donations)}</span>
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 text-gray-500 sm:table-cell">{date(l.lastDonationAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <div className="mt-8 flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
            <Info size={20} className="shrink-0 text-brand-blue" />
            <p>
              {t("infoBefore", { list: badgeList })}
              <Link to="/donor-profile" className="font-semibold underline">
                {t("infoLink")}
              </Link>
              {t("infoAfter")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
