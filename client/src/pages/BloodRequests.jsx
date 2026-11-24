import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, RotateCcw, ClipboardX } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { listRequests, listMyRequests } from "../services/requests";
import { COMPONENTS, URGENCY, STATUS, normalizeRequest } from "../utils/requests";
import { parseError } from "../utils/errors";
import { BLOOD_GROUPS, DIVISIONS, DIVISION_NAMES } from "../data/bangladesh";
import SelectField from "../components/SelectField";
import RequestCard from "../components/RequestCard";
import Pagination from "../components/Pagination";
import useT from "../i18n/useT";
import requests from "../i18n/requests";

const PAGE_SIZE = 12;
const KEYS = ["bloodGroup", "district", "component", "urgency", "status"];

// The URL is the source of truth, so searches can be shared and the back button works
function readFilters(params) {
  const f = { tab: params.get("tab") === "mine" ? "mine" : "all" };
  KEYS.forEach((k) => (f[k] = params.get(k) || ""));
  f.page = Math.max(parseInt(params.get("page"), 10) || 1, 1);
  return f;
}

function toParams(f) {
  const p = new URLSearchParams();
  if (f.tab === "mine") p.set("tab", "mine");
  KEYS.forEach((k) => {
    // "status" is only meaningful on the My requests tab
    if (f[k] && (k !== "status" || f.tab === "mine")) p.set(k, f[k]);
  });
  if (f.page > 1) p.set("page", String(f.page));
  return p;
}

function CardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="h-1.5 bg-gray-200" />
      <div className="p-5">
        <div className="flex gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gray-200" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 w-1/3 rounded bg-gray-200" />
            <div className="h-3 w-1/2 rounded bg-gray-100" />
          </div>
        </div>
        <div className="mt-5 space-y-2">
          <div className="h-3 w-3/4 rounded bg-gray-100" />
          <div className="h-3 w-1/2 rounded bg-gray-100" />
        </div>
        <div className="mt-6 h-10 rounded-lg bg-gray-100" />
      </div>
    </div>
  );
}

export default function BloodRequests() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, dist } = useT(requests);

  const key = searchParams.toString();
  const applied = useMemo(() => readFilters(new URLSearchParams(key)), [key]);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ key: null, items: [], total: 0, pages: 1, error: null });

  const mine = applied.tab === "mine";
  const needsLogin = mine && !authLoading && !user;

  // A result counts only if it belongs to the current search, so "loading" is worked out here
  const requestKey = `${key}|${user?.id ?? "guest"}|${attempt}`;
  const status = needsLogin
    ? "login"
    : authLoading || result.key !== requestKey
      ? "loading"
      : result.error
        ? "error"
        : "ready";

  useEffect(() => {
    if (authLoading || needsLogin) return;
    let cancelled = false;

    const params = { page: applied.page, limit: PAGE_SIZE };
    KEYS.forEach((k) => {
      if (!applied[k]) return;
      if (k === "status" && !mine) return;
      // "My requests" only filters by status; the other filters apply to the public list
      if (mine && k !== "status") return;
      params[k] = applied[k];
    });

    (mine ? listMyRequests : listRequests)(params)
      .then((data) => {
        if (cancelled) return;
        setResult({
          key: requestKey,
          items: (data.requests || []).map(normalizeRequest),
          total: data.total ?? 0,
          pages: data.pages ?? 1,
          error: null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setResult({ key: requestKey, items: [], total: 0, pages: 1, error: err });
      });

    return () => {
      cancelled = true;
    };
  }, [applied, authLoading, needsLogin, mine, requestKey]);

  const { items, total, pages, error } = result;

  const go = (next) => setSearchParams(toParams(next));
  const change = (patch) => go({ ...applied, ...patch, page: 1 });
  const reset = () => go({ tab: applied.tab, page: 1, bloodGroup: "", district: "", component: "", urgency: "", status: "" });
  const goToPage = (p) => {
    go({ ...applied, page: p });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const hasFilters = mine ? Boolean(applied.status) : KEYS.slice(0, 4).some((k) => applied[k]);
  const from = (applied.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(applied.page * PAGE_SIZE, total);

  const tabClass = (active) =>
    `rounded-lg px-4 py-2 text-sm font-semibold transition ${
      active ? "bg-brand-red text-white" : "text-gray-600 hover:bg-red-50 hover:text-brand-red"
    }`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-blue">{t("listTitle")}</h1>
          <p className="mt-1 text-gray-500">
            {t("listSubtitle")}
          </p>
        </div>
        <Link
          to="/requests/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-red px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
        >
          <Plus size={18} />
          {t("postRequest")}
        </Link>
      </div>

      {user && (
        <div className="mt-6 inline-flex gap-1 rounded-xl bg-white p-1 shadow-sm" role="tablist">
          <button type="button" role="tab" aria-selected={!mine} onClick={() => go({ tab: "all", page: 1 })} className={tabClass(!mine)}>
            {t("openRequests")}
          </button>
          <button type="button" role="tab" aria-selected={mine} onClick={() => go({ tab: "mine", page: 1 })} className={tabClass(mine)}>
            {t("myRequests")}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        {!mine ? (
          <>
            <p className="text-sm font-medium text-gray-700">{t("common:bloodGroup")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {BLOOD_GROUPS.map((g) => {
                const active = applied.bloodGroup === g;
                return (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={active}
                    onClick={() => change({ bloodGroup: active ? "" : g })}
                    className={`rounded-lg border-2 px-4 py-2 text-sm font-bold transition ${
                      active
                        ? "border-brand-red bg-brand-red text-white"
                        : "border-red-100 text-brand-red hover:border-brand-red"
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <SelectField label={t("common:district")} value={applied.district} onChange={(e) => change({ district: e.target.value })}>
                <option value="">{t("common:allDistricts")}</option>
                {DIVISION_NAMES.map((div) => (
                  <optgroup key={div} label={div}>
                    {DIVISIONS[div].map((d) => (
                      <option key={d} value={d}>
                        {dist(d)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </SelectField>
              <SelectField label={t("urgency")} value={applied.urgency} onChange={(e) => change({ urgency: e.target.value })}>
                <option value="">{t("anyUrgency")}</option>
                {Object.keys(URGENCY).map((v) => (
                  <option key={v} value={v}>
                    {t(`urgency_${v}`)}
                  </option>
                ))}
              </SelectField>
              <SelectField label={t("needed")} value={applied.component} onChange={(e) => change({ component: e.target.value })}>
                <option value="">{t("anyComponent")}</option>
                {COMPONENTS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {t(`component_${c.value}`)}
                  </option>
                ))}
              </SelectField>
            </div>
          </>
        ) : (
          <div className="max-w-xs">
            <SelectField label={t("status")} value={applied.status} onChange={(e) => change({ status: e.target.value })}>
              <option value="">{t("allStatuses")}</option>
              {Object.keys(STATUS).map((v) => (
                <option key={v} value={v}>
                  {t(`status_${v}`)}
                </option>
              ))}
            </SelectField>
          </div>
        )}

        {hasFilters && (
          <button
            type="button"
            onClick={reset}
            className="mt-4 flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            <RotateCcw size={16} />
            {t("resetFilters")}
          </button>
        )}
      </div>

      {/* Results */}
      {status === "loading" && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {status === "login" && (
        <div className="mt-8 rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="font-semibold text-gray-800">{t("loginForMine")}</p>
          <Link
            to="/login"
            state={{ from: { pathname: "/requests", search: "?tab=mine" } }}
            className="mt-4 inline-block rounded-lg bg-brand-red px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
          >
            {t("common:login")}
          </Link>
        </div>
      )}

      {status === "error" && (
        <div className="mt-8 rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="font-semibold text-gray-800">{parseError(error).message}</p>
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className="mt-4 rounded-lg bg-brand-red px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
          >
            {t("common:tryAgain")}
          </button>
        </div>
      )}

      {status === "ready" && (
        <>
          <p className="mt-6 text-sm text-gray-600" aria-live="polite">
            {total === 0
              ? mine
                ? t("noneHere")
                : t("noMatch")
              : t("showing", { count: total, from, to })}
          </p>

          {items.length > 0 ? (
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((r) => (
                <RequestCard key={r.id} request={r} showStatus={mine} />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-white p-10 text-center shadow-sm">
              <ClipboardX className="mx-auto text-gray-300" size={44} />
              {total > 0 ? (
                <>
                  <p className="mt-3 font-semibold text-gray-800">{t("pageEmpty")}</p>
                  <button
                    type="button"
                    onClick={() => goToPage(1)}
                    className="mt-4 rounded-lg bg-brand-red px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
                  >
                    {t("goToFirstPage")}
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-3 font-semibold text-gray-800">
                    {mine ? t("nothingToShow") : t("noneFound")}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {mine
                      ? t("mineHint")
                      : t("noneFoundHint")}
                  </p>
                  <div className="mt-4 flex justify-center gap-3">
                    <Link
                      to="/requests/new"
                      className="rounded-lg bg-brand-red px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
                    >
                      {t("postRequest")}
                    </Link>
                    {!mine && (
                      <Link
                        to="/donors"
                        className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                      >
                        {t("findDonors")}
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <Pagination page={applied.page} pages={pages} onChange={goToPage} />
        </>
      )}
    </div>
  );
}
