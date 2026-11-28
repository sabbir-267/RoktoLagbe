import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, Clock, PackageOpen } from "lucide-react";
import { getBank } from "../services/banks";
import { listBatches, issueUnits, setBatchStatus } from "../services/inventory";
import { normalizeBank, normalizeStock } from "../utils/banks";
import { normalizeBatch, expiryInfo } from "../utils/inventory";
import { formatDate } from "../utils/donors";
import { parseError } from "../utils/errors";
import { BLOOD_GROUPS } from "../data/bangladesh";
import { STATUSES, componentLabel, statusLabel } from "../data/inventory";
import StockGrid from "../components/StockGrid";
import AddBatchForm from "../components/AddBatchForm";
import SelectField from "../components/SelectField";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";

const PAGE_SIZE = 20;

const BADGE = {
  available: "bg-green-50 text-green-700",
  reserved: "bg-amber-50 text-amber-700",
  expired: "bg-gray-100 text-gray-500",
  used: "bg-blue-50 text-brand-blue",
};

const smallBtn =
  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50";

export default function ManageStock() {
  const { id } = useParams();
  const [refresh, setRefresh] = useState(0);
  const [filters, setFilters] = useState({ status: "available", bloodGroup: "", page: 1 });
  const [issuing, setIssuing] = useState(null); // { id, units } while an "Issue" box is open
  const [busyId, setBusyId] = useState(null);

  const [bankRes, setBankRes] = useState({ key: null, bank: null, stock: null, error: null });
  const [batchRes, setBatchRes] = useState({
    key: null,
    batches: [],
    total: 0,
    pages: 1,
    error: null,
  });

  // A result counts only if it belongs to the current request, so "loading"
  // is worked out here instead of being set inside the effects.
  const bankKey = `${id}|${refresh}`;
  const batchKey = `${id}|${filters.status}|${filters.bloodGroup}|${filters.page}|${refresh}`;

  useEffect(() => {
    let cancelled = false;
    getBank(id)
      .then((data) => {
        if (cancelled) return;
        setBankRes({
          key: bankKey,
          bank: normalizeBank(data.bank),
          approved: data.bank?.isApproved !== false,
          stock: normalizeStock(data.stock),
          error: null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setBankRes({ key: bankKey, bank: null, stock: null, error: err });
      });
    return () => {
      cancelled = true;
    };
  }, [id, bankKey]);

  useEffect(() => {
    let cancelled = false;

    const params = { page: filters.page, limit: PAGE_SIZE };
    if (filters.status) params.status = filters.status;
    if (filters.bloodGroup) params.bloodGroup = filters.bloodGroup;

    listBatches(id, params)
      .then((data) => {
        if (cancelled) return;
        setBatchRes({
          key: batchKey,
          batches: (data.batches || []).map(normalizeBatch),
          total: data.total ?? 0,
          pages: data.pages ?? 1,
          error: null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setBatchRes({ key: batchKey, batches: [], total: 0, pages: 1, error: err });
      });

    return () => {
      cancelled = true;
    };
  }, [id, filters, batchKey]);

  const bankStale = bankRes.key !== bankKey;
  const batchStale = batchRes.key !== batchKey;

  // Old rows stay on screen (slightly faded) while a refresh is running
  let view = "ready";
  if (!batchStale && batchRes.error) view = "error";
  else if (batchRes.key === null || batchRes.error) view = "loading";

  const changeFilter = (patch) => {
    setFilters((f) => ({ ...f, ...patch, page: 1 }));
    setIssuing(null);
  };
  const goToPage = (p) => {
    setFilters((f) => ({ ...f, page: p }));
    setIssuing(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const reload = () => setRefresh((r) => r + 1);

  async function run(batchId, action, successMessage) {
    setBusyId(batchId);
    try {
      await action();
      toast.success(successMessage);
      setIssuing(null);
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusyId(null);
      reload(); // reload either way, so the list never stays out of date
    }
  }

  function confirmIssue(batch) {
    const n = Number(issuing.units);
    if (!Number.isInteger(n) || n < 1 || n > batch.units) {
      toast.error(`Enter a whole number from 1 to ${batch.units}`);
      return;
    }
    run(batch.id, () => issueUnits(id, batch.id, n), `${n} unit${n === 1 ? "" : "s"} issued`);
  }

  function expire(batch) {
    if (!window.confirm(`Mark this ${batch.bloodGroup} batch as expired? This cannot be undone.`))
      return;
    run(batch.id, () => setBatchStatus(id, batch.id, "expired"), "Batch marked as expired");
  }

  function renderActions(b) {
    const open = b.status === "available" || b.status === "reserved";
    if (!open) return <span className="text-xs text-gray-400">No actions</span>;

    const busy = busyId === b.id;
    const pastExpiry = b.daysLeft !== null && b.daysLeft <= 0;

    if (issuing?.id === b.id) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min="1"
            max={b.units}
            step="1"
            inputMode="numeric"
            aria-label="Units to issue"
            value={issuing.units}
            onChange={(e) => setIssuing({ id: b.id, units: e.target.value })}
            className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-blue-200"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => confirmIssue(b)}
            className={`${smallBtn} border-brand-red bg-brand-red text-white hover:bg-brand-red-dark`}
          >
            {busy ? "Issuing..." : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => setIssuing(null)}
            className={`${smallBtn} border-gray-300 text-gray-600 hover:bg-gray-50`}
          >
            Cancel
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        {b.status === "available" && !pastExpiry && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => setIssuing({ id: b.id, units: "1" })}
              className={`${smallBtn} border-brand-red bg-brand-red text-white hover:bg-brand-red-dark`}
            >
              Issue
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(b.id, () => setBatchStatus(id, b.id, "reserved"), "Batch reserved")
              }
              className={`${smallBtn} border-gray-300 text-gray-700 hover:bg-gray-50`}
            >
              Reserve
            </button>
          </>
        )}
        {b.status === "reserved" && !pastExpiry && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(b.id, () => setBatchStatus(id, b.id, "available"), "Batch released")
            }
            className={`${smallBtn} border-gray-300 text-gray-700 hover:bg-gray-50`}
          >
            Release
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => expire(b)}
          className={`${smallBtn} border-red-200 text-red-600 hover:bg-red-50`}
        >
          Mark expired
        </button>
      </div>
    );
  }

  if (!bankStale && bankRes.error?.response?.status === 404) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-brand-blue">Blood bank not found</h1>
        <Link
          to="/blood-banks"
          className="mt-6 inline-block font-semibold text-brand-red hover:underline"
        >
          Back to blood banks
        </Link>
      </div>
    );
  }

  const forbidden = batchRes.error?.response?.status === 403;

  // Only verified staff (of an approved bank) can change stock; the server enforces it too
  if (!bankStale && bankRes.bank && !bankRes.approved) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold text-brand-blue">Manage stock</h1>
        <p className="mt-1 text-gray-500">{bankRes.bank.name}</p>
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Clock size={18} className="mt-0.5 shrink-0" />
          <span>
            <strong>Waiting for approval.</strong> Only verified blood bank staff can manage stock.
            You can add and issue blood once an administrator approves your blood bank.
          </span>
        </div>
        <Link
          to="/bank-portal"
          className="mt-6 inline-block font-semibold text-brand-red hover:underline"
        >
          Back to the bank portal
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link
        to={`/blood-banks/${id}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline"
      >
        <ArrowLeft size={16} />
        View public page
      </Link>

      <h1 className="mt-4 text-3xl font-bold text-brand-blue">Manage stock</h1>
      <p className="mt-1 text-gray-500">{bankRes.bank?.name || "Blood bank"}</p>

      {/* Public stock */}
      {bankRes.stock && (
        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-brand-blue">Current public stock</h2>
          <p className="mt-1 text-sm text-gray-500">
            What visitors see. Only available, unexpired units are counted.
          </p>
          <div className="mt-4">
            <StockGrid stock={bankRes.stock} />
          </div>
        </section>
      )}

      <div className="mt-6">
        <AddBatchForm bankId={id} onAdded={reload} />
      </div>

      {/* Batches */}
      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-xl font-semibold text-brand-blue">Batches</h2>
          <div className="grid w-full max-w-md grid-cols-2 gap-3">
            <SelectField
              label="Status"
              value={filters.status}
              onChange={(e) => changeFilter({ status: e.target.value })}
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Blood group"
              value={filters.bloodGroup}
              onChange={(e) => changeFilter({ bloodGroup: e.target.value })}
            >
              <option value="">All groups</option>
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </SelectField>
          </div>
        </div>

        {view === "loading" && <Spinner />}

        {view === "error" && (
          <div className="mt-4 rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="font-semibold text-gray-800">
              {forbidden
                ? "You don't have permission to manage this blood bank."
                : parseError(batchRes.error).message}
            </p>
            {!forbidden && (
              <button
                type="button"
                onClick={reload}
                className="mt-4 rounded-lg bg-brand-red px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {view === "ready" && (
          <div className={batchStale ? "opacity-60 transition" : "transition"}>
            {batchRes.batches.length === 0 ? (
              <div className="mt-4 rounded-2xl bg-white p-10 text-center shadow-sm">
                <PackageOpen className="mx-auto text-gray-300" size={44} />
                <p className="mt-3 font-semibold text-gray-800">No batches found</p>
                <p className="mt-1 text-sm text-gray-500">
                  Change the filters above, or add a batch with the form.
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-sm">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Group</th>
                      <th className="px-4 py-3 font-semibold">Component</th>
                      <th className="px-4 py-3 font-semibold">Units</th>
                      <th className="px-4 py-3 font-semibold">Collected</th>
                      <th className="px-4 py-3 font-semibold">Expires</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {batchRes.batches.map((b) => {
                      const expiry = expiryInfo(b);
                      return (
                        <tr key={b.id} className="align-middle">
                          <td className="px-4 py-3 text-lg font-extrabold text-brand-red">
                            {b.bloodGroup}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{componentLabel(b.component)}</td>
                          <td className="px-4 py-3 font-semibold text-gray-800">{b.units}</td>
                          <td className="px-4 py-3 text-gray-600">{formatDate(b.collectedAt)}</td>
                          <td className="px-4 py-3">
                            <div className="text-gray-700">{formatDate(b.expiresAt)}</div>
                            {expiry.text && (
                              <div className={`text-xs font-medium ${expiry.tone}`}>
                                {expiry.text}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                BADGE[b.status] || BADGE.expired
                              }`}
                            >
                              {statusLabel(b.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3">{renderActions(b)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <Pagination page={filters.page} pages={batchRes.pages} onChange={goToPage} />
          </div>
        )}
      </section>
    </div>
  );
}