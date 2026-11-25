import { useState } from "react";
import toast from "react-hot-toast";
import { BadgeCheck, Ban, XCircle, AlertTriangle } from "lucide-react";
import { adminListDoctors, adminReviewDoctor, DOCTOR_STATUSES, DOCTOR_STATUS_CHIP } from "../../services/doctors";
import { parseError } from "../../utils/errors";
import { formatDate } from "../../utils/donors";
import useT from "../../i18n/useT";
import doctorsDict from "../../i18n/doctors";
import SelectField from "../../components/SelectField";
import Pagination from "../../components/Pagination";
import Spinner from "../../components/Spinner";
import SearchBox from "./SearchBox";
import usePagedList from "./usePagedList";

const STATUS_LABEL = { pending: "Waiting for review", approved: "Approved", rejected: "Rejected", suspended: "Suspended" };
const LANGUAGE_LABEL = { bn: "Bangla", en: "English" };

// What an admin can do from each status
const ACTIONS = {
  pending: ["approved", "rejected"],
  approved: ["suspended"],
  rejected: ["approved"],
  suspended: ["approved"],
};
const ACTION = {
  approved: { label: "Approve", done: "approved", icon: BadgeCheck, btn: "border-green-600 bg-green-600 text-white hover:bg-green-700" },
  rejected: { label: "Reject", done: "rejected", icon: XCircle, btn: "border-red-200 text-red-600 hover:bg-red-50" },
  suspended: { label: "Suspend", done: "suspended", icon: Ban, btn: "border-gray-300 text-gray-700 hover:bg-gray-50" },
};
const CONFIRM_HINT = {
  approved: "They become a doctor and can answer questions. Their account role changes to doctor.",
  rejected: "Their account stays a normal member account. They can correct and re-apply.",
  suspended: "They stop seeing the question queue and their account role goes back to member.",
};

const smallBtn =
  "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50";

export default function AdminDoctors() {
  const { t: td, dist } = useT(doctorsDict);
  const [filters, setFilters] = useState({ q: "", status: "pending", page: 1 });
  const [pending, setPending] = useState(null); // { id, status, note }
  const [busyId, setBusyId] = useState(null);

  const params = { page: filters.page, limit: 20 };
  for (const k of ["q", "status"]) if (filters[k]) params[k] = filters[k];
  const list = usePagedList(adminListDoctors, "doctors", params);

  const change = (patch) => {
    setFilters((f) => ({ ...f, ...patch, page: 1 }));
    setPending(null);
  };

  async function review(d) {
    const { status, note } = pending;
    setBusyId(d.id);
    try {
      const body = { status };
      if (note.trim()) body.reviewNote = note.trim();
      const data = await adminReviewDoctor(d.id, body);
      list.patchRow(d.id, { status, reviewNote: note.trim(), ...(data?.doctor || {}) });
      toast.success(`${d.user?.name || d.name} ${ACTION[status].done}`);
      setPending(null);
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_200px]">
        <SearchBox placeholder="Search name, BMDC no., hospital or district" onSearch={(q) => change({ q })} />
        <SelectField label="Status" value={filters.status} onChange={(e) => change({ status: e.target.value })}>
          {DOCTOR_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
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
            {list.total} doctor{list.total === 1 ? "" : "s"}
          </p>
          <ul className="mt-2 space-y-3">
            {list.rows.map((d) => {
              const name = d.user?.name || d.name;
              const open = pending?.id === d.id ? pending : null;
              return (
                <li key={d.id} className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-gray-800">{name}</h3>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${DOCTOR_STATUS_CHIP[d.status] || ""}`}>
                          {STATUS_LABEL[d.status] || d.status}
                        </span>
                        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-brand-blue">
                          {td(`specialty_${d.specialty}`)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {[d.hospital, dist(d.district)].filter(Boolean).join(", ")}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {[d.user?.phone, d.user?.email].filter(Boolean).join(" · ") || "No contact details"}
                        {" · "}applied {formatDate(d.createdAt)}
                        {" · "}
                        {d.answeredCount || 0} answered
                        {d.languages?.length ? ` · ${d.languages.map((l) => LANGUAGE_LABEL[l] || l).join(", ")}` : ""}
                      </p>
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold text-gray-800">BMDC no. {d.bmdcNo}</span>
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                          <AlertTriangle size={14} /> Verify on the BMDC register before approving
                        </span>
                      </p>
                      {d.bio && <p className="mt-2 whitespace-pre-line text-sm text-gray-600">{d.bio}</p>}
                      {d.reviewNote && (
                        <p className="mt-2 text-xs text-gray-500">
                          <span className="font-semibold">Review note:</span> {d.reviewNote}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(ACTIONS[d.status] || []).map((s) => {
                        const a = ACTION[s];
                        const Icon = a.icon;
                        return (
                          <button
                            key={s}
                            type="button"
                            disabled={busyId === d.id}
                            aria-expanded={open?.status === s}
                            onClick={() =>
                              setPending((p) => (p?.id === d.id && p.status === s ? null : { id: d.id, status: s, note: "" }))
                            }
                            className={`${smallBtn} ${a.btn}`}
                          >
                            <Icon size={14} /> {a.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {open && (
                    <div className="mt-5 border-t border-gray-100 pt-5">
                      <p className="text-sm font-semibold text-gray-800">
                        {ACTION[open.status].label} {name}?
                      </p>
                      <p className="mt-1 text-xs text-gray-500">{CONFIRM_HINT[open.status]}</p>
                      <label className="mt-3 block max-w-xl">
                        <span className="text-sm font-medium text-gray-700">Note to the applicant (optional)</span>
                        <textarea
                          value={open.note}
                          maxLength={300}
                          rows={2}
                          onChange={(e) => setPending((p) => ({ ...p, note: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-blue-200"
                        />
                        <span className="mt-1 block text-xs text-gray-400">{open.note.length}/300 · shown to the applicant</span>
                      </label>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={busyId === d.id}
                          onClick={() => review(d)}
                          className={`${smallBtn} ${ACTION[open.status].btn}`}
                        >
                          {busyId === d.id ? "Saving..." : `Confirm ${ACTION[open.status].label.toLowerCase()}`}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === d.id}
                          onClick={() => setPending(null)}
                          className={`${smallBtn} border-gray-300 text-gray-600 hover:bg-gray-50`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {list.rows.length === 0 && (
            <p className="mt-4 rounded-2xl bg-white p-8 text-center text-gray-500 shadow-sm">No doctors match these filters.</p>
          )}
          <Pagination
            page={filters.page}
            pages={list.pages}
            onChange={(p) => {
              setFilters((f) => ({ ...f, page: p }));
              setPending(null);
            }}
          />
        </div>
      )}
    </section>
  );
}
