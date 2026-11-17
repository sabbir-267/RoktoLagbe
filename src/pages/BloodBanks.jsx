import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, RotateCcw, Building2 } from "lucide-react";
import { listBanks } from "../services/banks";
import { normalizeBank } from "../utils/banks";
import { parseError } from "../utils/errors";
import { BLOOD_GROUPS, DIVISIONS, DIVISION_NAMES } from "../data/bangladesh";
import FormField from "../components/FormField";
import SelectField from "../components/SelectField";
import BankCard from "../components/BankCard";
import Pagination from "../components/Pagination";

const PAGE_SIZE = 12;
const TEXT_KEYS = ["q", "district", "hasBloodGroup"];

// The URL is the source of truth, so searches can be shared and the back button works
function readFilters(params) {
  return {
    q: params.get("q") || "",
    district: params.get("district") || "",
    hasBloodGroup: params.get("hasBloodGroup") || "",
    is24Hours: params.get("is24Hours") === "1",
    page: Math.max(parseInt(params.get("page"), 10) || 1, 1),
  };
}

function toParams(f) {
  const p = new URLSearchParams();
  TEXT_KEYS.forEach((k) => {
    const v = String(f[k]).trim();
    if (v) p.set(k, v);
  });
  if (f.is24Hours) p.set("is24Hours", "1");
  if (f.page > 1) p.set("page", String(f.page));
  return p;
}

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl bg-white p-5 shadow-sm">
      <div className="h-4 w-2/3 rounded bg-gray-200" />
      <div className="mt-4 h-3 w-full rounded bg-gray-100" />
      <div className="mt-2 h-3 w-1/2 rounded bg-gray-100" />
      <div className="mt-6 h-10 rounded-lg bg-gray-100" />
    </div>
  );
}

export default function BloodBanks() {
  const [searchParams, setSearchParams] = useSearchParams();

  const key = searchParams.toString();
  const applied = useMemo(() => readFilters(new URLSearchParams(key)), [key]);

  const [draft, setDraft] = useState(applied);
  const [prevApplied, setPrevApplied] = useState(applied);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({
    key: null,
    banks: [],
    total: 0,
    pages: 1,
    error: null,
  });

  // Keep the form in sync when the URL changes (back button, shared links)
  if (applied !== prevApplied) {
    setPrevApplied(applied);
    setDraft(applied);
  }

  // A result counts only if it belongs to the current search,
  // so "loading" is worked out here instead of being set inside the effect.
  const requestKey = `${key}|${attempt}`;
  const status = result.key !== requestKey ? "loading" : result.error ? "error" : "ready";

  useEffect(() => {
    let cancelled = false;

    const params = { page: applied.page, limit: PAGE_SIZE };
    TEXT_KEYS.forEach((k) => {
      if (applied[k]) params[k] = applied[k];
    });
    if (applied.is24Hours) params.is24Hours = "true";

    listBanks(params)
      .then((data) => {
        if (cancelled) return;
        setResult({
          key: requestKey,
          banks: (data.banks || []).map(normalizeBank),
          total: data.total ?? 0,
          pages: data.pages ?? 1,
          error: null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setResult({ key: requestKey, banks: [], total: 0, pages: 1, error: err });
      });

    return () => {
      cancelled = true;
    };
  }, [applied, requestKey]);

  const { banks, total, pages, error } = result;

  const go = (next) => setSearchParams(toParams(next));
  // Pills, dropdown and checkbox search immediately; the name box waits for Enter / Search
  const change = (patch) => go({ ...draft, ...patch, page: 1 });
  const typeText = (e) => setDraft({ ...draft, [e.target.name]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    go({ ...draft, page: 1 });
  };
  const reset = () => setSearchParams(new URLSearchParams());
  const goToPage = (p) => {
    go({ ...applied, page: p });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const hasFilters = TEXT_KEYS.some((k) => applied[k]) || applied.is24Hours;
  const from = (applied.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(applied.page * PAGE_SIZE, total);
  const unauthorized = error?.response?.status === 401;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-brand-blue">Blood banks</h1>
      <p className="mt-1 text-gray-500">
        Find a blood bank near you and check which blood groups it has in stock.
      </p>

      {/* Filters */}
      <form onSubmit={submit} className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Blood bank name"
            name="q"
            placeholder="Search by name"
            value={draft.q}
            onChange={typeText}
          />
          <SelectField
            label="District"
            name="district"
            value={draft.district}
            onChange={(e) => change({ district: e.target.value })}
          >
            <option value="">All districts</option>
            {DIVISION_NAMES.map((div) => (
              <optgroup key={div} label={div}>
                {DIVISIONS[div].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </optgroup>
            ))}
          </SelectField>
        </div>

        <p className="mt-5 text-sm font-medium text-gray-700">Has this blood group in stock</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {BLOOD_GROUPS.map((g) => {
            const active = draft.hasBloodGroup === g;
            return (
              <button
                key={g}
                type="button"
                aria-pressed={active}
                onClick={() => change({ hasBloodGroup: active ? "" : g })}
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

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={draft.is24Hours}
              onChange={(e) => change({ is24Hours: e.target.checked })}
              className="h-4 w-4 accent-brand-red"
            />
            Open 24 hours
          </label>

          <div className="flex gap-2">
            {hasFilters && (
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                <RotateCcw size={16} />
                Reset
              </button>
            )}
            <button
              type="submit"
              className="flex items-center gap-1 rounded-lg bg-brand-red px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
            >
              <Search size={16} />
              Search
            </button>
          </div>
        </div>
      </form>

      {/* Results */}
      {status === "loading" && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {status === "error" && (
        <div className="mt-8 rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="font-semibold text-gray-800">
            {unauthorized ? "Please log in to see blood banks." : parseError(error).message}
          </p>
          {unauthorized ? (
            <Link
              to="/login"
              state={{ from: { pathname: "/blood-banks" } }}
              className="mt-4 inline-block rounded-lg bg-brand-red px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
            >
              Log in
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setAttempt((a) => a + 1)}
              className="mt-4 rounded-lg bg-brand-red px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {status === "ready" && (
        <>
          <p className="mt-6 text-sm text-gray-600" aria-live="polite">
            {total === 0
              ? "No blood banks match your search."
              : `Showing ${from}–${to} of ${total} blood bank${total === 1 ? "" : "s"}`}
          </p>

          {banks.length > 0 ? (
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {banks.map((b) => (
                <BankCard key={b.id} bank={b} />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-white p-10 text-center shadow-sm">
              <Building2 className="mx-auto text-gray-300" size={44} />
              {total > 0 ? (
                <>
                  <p className="mt-3 font-semibold text-gray-800">This page has no results.</p>
                  <button
                    type="button"
                    onClick={() => goToPage(1)}
                    className="mt-4 rounded-lg bg-brand-red px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
                  >
                    Go to page 1
                  </button>
                </>
              ) : hasFilters ? (
                <>
                  <p className="mt-3 font-semibold text-gray-800">No blood banks found</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Try another district, remove the blood group filter, or search by a shorter
                    name.
                  </p>
                  <button
                    type="button"
                    onClick={reset}
                    className="mt-4 rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                  >
                    Clear all filters
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-3 font-semibold text-gray-800">No blood banks yet</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Blood banks will appear here once they are added to the platform.
                  </p>
                </>
              )}
            </div>
          )}

          <Pagination page={applied.page} pages={pages} onChange={goToPage} />
        </>
      )}

      <p className="mt-10 text-center text-xs text-gray-400">
        Stock levels are entered by blood bank staff and can change quickly. Always call the blood
        bank to confirm before you travel.
      </p>
    </div>
  );
}