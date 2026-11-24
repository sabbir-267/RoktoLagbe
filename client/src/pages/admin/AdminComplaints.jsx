import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Link2, User, UserX } from "lucide-react";
import { listComplaints, updateComplaint, COMPLAINT_CATEGORIES, COMPLAINT_STATUSES, STATUS_CHIP } from "../../services/complaints";
import { parseError } from "../../utils/errors";
import { formatDate } from "../../utils/donors";
import SelectField from "../../components/SelectField";
import Pagination from "../../components/Pagination";
import Spinner from "../../components/Spinner";
import SearchBox from "./SearchBox";
import usePagedList from "./usePagedList";

const CATEGORY_LABEL = {
  fake_request: "Fake request",
  asked_for_money: "Asked for money",
  donor_behaviour: "Donor behaviour",
  requester_behaviour: "Requester behaviour",
  blood_bank: "Blood bank",
  app_problem: "App problem",
  other: "Other",
};
const STATUS_LABEL = { open: "Open", in_review: "In review", resolved: "Resolved", dismissed: "Dismissed" };

export default function AdminComplaints() {
  const [filters, setFilters] = useState({ q: "", status: "open", category: "", page: 1 });

  const params = { page: filters.page, limit: 20 };
  for (const k of ["q", "status", "category"]) if (filters[k]) params[k] = filters[k];
  const list = usePagedList(listComplaints, "complaints", params);

  const change = (patch) => setFilters((f) => ({ ...f, ...patch, page: 1 }));

  return (
    <section>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px_200px]">
        <SearchBox placeholder="Search reference, subject, message or reporter" onSearch={(q) => change({ q })} />
        <SelectField label="Status" value={filters.status} onChange={(e) => change({ status: e.target.value })}>
          <option value="">Any status</option>
          {COMPLAINT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Category" value={filters.category} onChange={(e) => change({ category: e.target.value })}>
          <option value="">All categories</option>
          {COMPLAINT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </SelectField>
      </div>

      {list.loading ? (
        <Spinner />
      ) : list.error && !list.stale ? (
        <p className="mt-6 text-sm text-red-600">{parseError(list.error).message}</p>
      ) : (
        <div className={list.stale ? "opacity-60 transition" : "transition"}>
          <p className="mt-4 text-sm text-gray-500">
            {list.total} complaint{list.total === 1 ? "" : "s"}
          </p>
          <ul className="mt-2 space-y-3">
            {list.rows.map((c) => (
              <ComplaintCard key={`${c.id}-${c.updatedAt}`} complaint={c} onSaved={(row) => list.patchRow(c.id, row)} />
            ))}
          </ul>
          {list.rows.length === 0 && (
            <p className="mt-2 rounded-2xl bg-white p-8 text-center text-gray-500 shadow-sm">
              No complaints match these filters.
            </p>
          )}
          <Pagination page={filters.page} pages={list.pages} onChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
        </div>
      )}
    </section>
  );
}

function ComplaintCard({ complaint: c, onSaved }) {
  const [status, setStatus] = useState(c.status);
  const [note, setNote] = useState(c.adminNote || "");
  const [busy, setBusy] = useState(false);
  const dirty = status !== c.status || note.trim() !== (c.adminNote || "");

  async function save() {
    const patch = {};
    if (status !== c.status) patch.status = status;
    if (note.trim() !== (c.adminNote || "")) patch.adminNote = note.trim();
    setBusy(true);
    try {
      const data = await updateComplaint(c.id, patch);
      onSaved(data.complaint);
      toast.success(`${c.reference} updated${c.reporter ? " — the reporter was notified" : ""}`);
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusy(false);
    }
  }

  const who = c.reporter || c.contact || {};

  return (
    <li className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-bold text-brand-red">{c.reference}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CHIP[c.status] || ""}`}>
          {STATUS_LABEL[c.status]}
        </span>
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
          {CATEGORY_LABEL[c.category] || c.category}
        </span>
        <span className="ml-auto text-xs text-gray-400">{formatDate(c.createdAt)}</span>
      </div>

      <h3 className="mt-2 font-semibold text-gray-800">{c.subject}</h3>
      <p className="mt-1 whitespace-pre-line break-words text-sm text-gray-600">{c.message}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-600">
        <span className="inline-flex items-center gap-1.5">
          {c.reporter ? <User size={15} className="text-brand-blue" /> : <UserX size={15} className="text-gray-400" />}
          <span className="font-semibold text-gray-800">{who.name || "Guest"}</span>
          {!c.reporter && <span className="text-xs text-gray-400">(not logged in)</span>}
        </span>
        {who.phone && <span>{who.phone}</span>}
        {who.email && <span className="break-all">{who.email}</span>}
        {c.relatedUrl && (
          <Link to={c.relatedUrl} className="inline-flex items-center gap-1 font-semibold text-brand-blue hover:underline">
            <Link2 size={15} /> <span className="break-all">{c.relatedUrl}</span>
          </Link>
        )}
      </div>

      <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-[180px_1fr_auto] sm:items-end">
        <SelectField label="Status" value={status} disabled={busy} onChange={(e) => setStatus(e.target.value)}>
          {COMPLAINT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </SelectField>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Reply to reporter {c.reporter ? "(shown on their complaint page)" : "(guest — contact them directly)"}
          </span>
          <textarea
            rows={2}
            value={note}
            maxLength={1000}
            disabled={busy}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <button type="button" onClick={save} disabled={busy || !dirty} className="btn-primary">
          {busy ? "Saving..." : "Save"}
        </button>
      </div>
      {c.handledBy && (
        <p className="mt-2 text-xs text-gray-400">
          Last handled by {c.handledBy.name}
          {c.resolvedAt ? ` · closed ${formatDate(c.resolvedAt)}` : ""}
        </p>
      )}
    </li>
  );
}
