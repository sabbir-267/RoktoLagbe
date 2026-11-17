import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, RotateCcw, UserX } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { searchDonors } from "../services/donors";
import { normalizeDonor } from "../utils/donors";
import { parseError } from "../utils/errors";
import { BLOOD_GROUPS, DIVISIONS, DIVISION_NAMES } from "../data/bangladesh";
import FormField from "../components/FormField";
import SelectField from "../components/SelectField";
import DonorCard from "../components/DonorCard";
import Pagination from "../components/Pagination";

const PAGE_SIZE = 12;
const TEXT_KEYS = ["bloodGroup", "district", "upazila", "campus", "group"];

// The URL is the source of truth, so searches can be shared and the back button works
function readFilters(params) {
  return {
    bloodGroup: params.get("bloodGroup") || "",
    district: params.get("district") || "",
    upazila: params.get("upazila") || "",
    campus: params.get("campus") || "",
    group: params.get("group") || "",
    includeUnavailable: params.get("includeUnavailable") === "1",
    eligibleOnly: params.get("eligibleOnly") === "1",
    page: Math.max(parseInt(params.get("page"), 10) || 1, 1),
  };
}

function toParams(f) {
  const p = new URLSearchParams();
  TEXT_KEYS.forEach((k) => {
    const v = String(f[k]).trim();
    if (v) p.set(k, v);
  });
  if (f.includeUnavailable) p.set("includeUnavailable", "1");
  if (f.eligibleOnly) p.set("eligibleOnly", "1");
  if (f.page > 1) p.set("page", String(f.page));
  return p;
}

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex gap-4">
        <div className="h-16 w-16 rounded-2xl bg-gray-200" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 w-2/3 rounded bg-gray-200" />
          <div className="h-3 w-1/2 rounded bg-gray-100" />
        </div>
      </div>
      <div className="mt-5 h-3 w-1/3 rounded bg-gray-100" />
      <div className="mt-6 h-10 rounded-lg bg-gray-100" />
    </div>
  );
}

export default function FindDonors() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const key = searchParams.toString();
  const applied = useMemo(() => readFilters(new URLSearchParams(key)), [key]);

  const [draft, setDraft] = useState(applied);
  const [prevApplied, setPrevApplied] = useState(applied);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({
    key: null,
    donors: [],
    total: 0,
    pages: 1,
    error: null,
  });

  // Keep the form in sync when the URL changes (back button, links from Home).
  // Adjusting state during render is React's recommended alternative to an effect here.
  if (applied !== prevApplied) {
    setPrevApplied(applied);
    setDraft(applied);
  }

  // Identifies one search. A result counts only if it belongs to the current search,
  // so "loading" is worked out here instead of being set inside the effect.
  const requestKey = `${key}|${user?.id ?? "guest"}|${attempt}`;
  const status =
    authLoading || result.key !== requestKey ? "loading" : result.error ? "error" : "ready";

  // Fetch whenever the search changes. Wait for the auth check first, so we don't
  // search once as a guest and again right after as the logged-in user.
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    const params = { page: applied.page, limit: PAGE_SIZE };
    TEXT_KEYS.forEach((k) => {
      if (applied[k]) params[k] = applied[k];
    });
    if (!applied.includeUnavailable) params.available = "true";
    if (applied.eligibleOnly) params.eligibleOnly = "true";

    searchDonors(params)
      .then((data) => {
        if (cancelled) return;
        setResult({
          key: requestKey,
          donors: (data.donors || []).map(normalizeDonor),
          total: data.total ?? 0,
          pages: data.pages ?? 1,
          error: null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setResult({ key: requestKey, donors: [], total: 0, pages: 1, error: err });
      });

    return () => {
      cancelled = true;
    };
  }, [applied, authLoading, requestKey]);

  const { donors, total, pages, error } = result;

  const go = (next) => setSearchParams(toParams(next));
  // Pills, dropdown and checkboxes search immediately; text boxes wait for Enter / Search
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

  const hasFilters =
    TEXT_KEYS.some((k) => applied[k]) || applied.includeUnavailable || applied.eligibleOnly;

  const from = (applied.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(applied.page * PAGE_SIZE, total);
  const unauthorized = error?.response?.status === 401;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-brand-blue">Find blood donors</h1>
      <p className="mt-1 text-gray-500">
        Search by blood group and location, then contact a donor directly.
      </p>

      {/* Filters */}
      <form onSubmit={submit} className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-gray-700">Blood group</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {BLOOD_GROUPS.map((g) => {
            const active = draft.bloodGroup === g;
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

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

          <FormField label="Upazila" name="upazila" value={draft.upazila} onChange={typeText} />
          <FormField label="Campus" name="campus" value={draft.campus} onChange={typeText} />
          <FormField label="Group" name="group" value={draft.group} onChange={typeText} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.eligibleOnly}
                onChange={(e) => change({ eligibleOnly: e.target.checked })}
                className="h-4 w-4 accent-brand-red"
              />
              Eligible to donate now
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.includeUnavailable}
                onChange={(e) => change({ includeUnavailable: e.target.checked })}
                className="h-4 w-4 accent-brand-red"
              />
              Include unavailable donors
            </label>
          </div>

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
            {unauthorized ? "Please log in to search for donors." : parseError(error).message}
          </p>
          {unauthorized ? (
            <Link
              to="/login"
              state={{ from: { pathname: "/donors" } }}
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
              ? "No donors match your search."
              : `Showing ${from}–${to} of ${total} donor${total === 1 ? "" : "s"}`}
          </p>

          {donors.length > 0 ? (
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {donors.map((d) => (
                <DonorCard key={d.id} donor={d} loggedIn={Boolean(user)} />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-white p-10 text-center shadow-sm">
              <UserX className="mx-auto text-gray-300" size={44} />
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
              ) : (
                <>
                  <p className="mt-3 font-semibold text-gray-800">No donors found</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Try a nearby district, remove the upazila, campus or group filter, or include
                    unavailable donors.
                  </p>
                  {hasFilters && (
                    <button
                      type="button"
                      onClick={reset}
                      className="mt-4 rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                    >
                      Clear all filters
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          <Pagination page={applied.page} pages={pages} onChange={goToPage} />
        </>
      )}

      <p className="mt-10 text-center text-xs text-gray-400">
        RoktoLagbe connects donors and people in need. Medical screening is done by the blood bank
        or hospital, so always confirm there before donating or receiving blood.
      </p>
    </div>
  );
}