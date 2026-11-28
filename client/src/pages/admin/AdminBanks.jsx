import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Plus, X, Users, Pencil, Trash2 } from "lucide-react";
import { listAllBanks, setBankApproval } from "../../services/admin";
import { createBank, updateBank, listStaff, assignStaff, removeStaff } from "../../services/banks";
import { parseError } from "../../utils/errors";
import { formatDate } from "../../utils/donors";
import SelectField from "../../components/SelectField";
import Pagination from "../../components/Pagination";
import Spinner from "../../components/Spinner";
import BankForm from "../../components/BankForm";
import SearchBox from "./SearchBox";
import usePagedList from "./usePagedList";

const smallBtn =
  "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50";

export default function AdminBanks() {
  const [filters, setFilters] = useState({ q: "", status: "", page: 1 });
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(null); // { id, panel: "edit" | "staff" }
  const [busyId, setBusyId] = useState(null);

  const params = { page: filters.page, limit: 20 };
  for (const k of ["q", "status"]) if (filters[k]) params[k] = filters[k];
  const list = usePagedList(listAllBanks, "banks", params);

  const change = (patch) => {
    setFilters((f) => ({ ...f, ...patch, page: 1 }));
    setOpen(null);
  };
  const toggle = (id, panel) => setOpen((o) => (o?.id === id && o.panel === panel ? null : { id, panel }));

  async function approve(b, isApproved) {
    if (!isApproved && !window.confirm(`Hide ${b.name} from the public? Its staff can still log in.`)) return;
    setBusyId(b.id);
    try {
      await setBankApproval(b.id, isApproved);
      list.patchRow(b.id, { isApproved });
      toast.success(isApproved ? `${b.name} approved` : `${b.name} unpublished`);
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_180px_auto]">
        <SearchBox placeholder="Search name, district or license" onSearch={(q) => change({ q })} />
        <SelectField label="Status" value={filters.status} onChange={(e) => change({ status: e.target.value })}>
          <option value="">All banks</option>
          <option value="pending">Waiting for approval</option>
          <option value="approved">Approved</option>
        </SelectField>
        <button
          type="button"
          onClick={() => setCreating((c) => !c)}
          className="inline-flex h-[46px] items-center justify-center gap-2 rounded-lg bg-brand-red px-4 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
        >
          {creating ? <X size={18} /> : <Plus size={18} />}
          {creating ? "Close" : "Add blood bank"}
        </button>
      </div>

      {creating && (
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-brand-blue">New blood bank (approved immediately)</h2>
          <BankForm
            submitLabel="Create blood bank"
            busyLabel="Creating..."
            onSubmit={async (payload) => {
              try {
                await createBank(payload);
              } catch (err) {
                toast.error(parseError(err).message);
                throw err;
              }
              toast.success("Blood bank created. Assign staff from its Staff button.");
              setCreating(false);
              list.reload();
            }}
          />
        </div>
      )}

      {list.loading ? (
        <Spinner />
      ) : list.error && !list.stale ? (
        <p className="mt-6 text-sm text-red-600">{parseError(list.error).message}</p>
      ) : (
        <div className={list.stale ? "opacity-60 transition" : "transition"}>
          <p className="mt-4 text-sm text-gray-500">
            {list.total} blood bank{list.total === 1 ? "" : "s"}
          </p>
          <ul className="mt-2 space-y-3">
            {list.rows.map((b) => (
              <li key={b.id} className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-gray-800">{b.name}</h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          b.isApproved ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {b.isApproved ? "Approved" : "Waiting for approval"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {[b.address, b.district, b.division].filter(Boolean).join(", ")}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {[b.phone, b.email, b.licenseNo && `License ${b.licenseNo}`].filter(Boolean).join(" · ")}
                      {" · "}
                      {b.staffCount} staff · added {formatDate(b.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {b.isApproved ? (
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() => approve(b, false)}
                        className={`${smallBtn} border-gray-300 text-gray-600 hover:bg-gray-50`}
                      >
                        Unpublish
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() => approve(b, true)}
                        className={`${smallBtn} border-green-600 bg-green-600 text-white hover:bg-green-700`}
                      >
                        Approve
                      </button>
                    )}
                    <button type="button" onClick={() => toggle(b.id, "edit")} className={`${smallBtn} border-gray-300 text-gray-700 hover:bg-gray-50`}>
                      <Pencil size={14} /> Edit
                    </button>
                    <button type="button" onClick={() => toggle(b.id, "staff")} className={`${smallBtn} border-gray-300 text-gray-700 hover:bg-gray-50`}>
                      <Users size={14} /> Staff
                    </button>
                  </div>
                </div>

                {open?.id === b.id && open.panel === "edit" && (
                  <div className="mt-5 border-t border-gray-100 pt-5">
                    <BankForm
                      key={b.id}
                      initial={b}
                      onSubmit={async (payload) => {
                        let data;
                        try {
                          data = await updateBank(b.id, payload);
                        } catch (err) {
                          toast.error(parseError(err).message);
                          throw err;
                        }
                        list.patchRow(b.id, data.bank);
                        toast.success("Blood bank saved");
                        setOpen(null);
                      }}
                    />
                  </div>
                )}

                {open?.id === b.id && open.panel === "staff" && (
                  <StaffPanel bank={b} onCountChange={(n) => list.patchRow(b.id, { staffCount: n })} />
                )}
              </li>
            ))}
          </ul>
          {list.rows.length === 0 && (
            <p className="mt-4 rounded-2xl bg-white p-8 text-center text-gray-500 shadow-sm">No blood banks match these filters.</p>
          )}
          <Pagination
            page={filters.page}
            pages={list.pages}
            onChange={(p) => {
              setFilters((f) => ({ ...f, page: p }));
              setOpen(null);
            }}
          />
        </div>
      )}
    </section>
  );
}

function StaffPanel({ bank, onCountChange }) {
  const [staff, setStaff] = useState(null);
  const [error, setError] = useState(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listStaff(bank.id)
      .then((data) => !cancelled && setStaff(data.staff || []))
      .catch((err) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [bank.id]);

  const update = (next) => {
    setStaff(next);
    onCountChange(next.length);
  };

  async function add(e) {
    e.preventDefault();
    if (!phone.trim()) return;
    setBusy(true);
    try {
      const data = await assignStaff(bank.id, phone.replace(/[\s-]/g, ""));
      const s = data.staff;
      update([...staff.filter((x) => x.id !== s.id), s]);
      setPhone("");
      toast.success(`${s.name} can now manage ${bank.name}`);
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(s) {
    if (!window.confirm(`Remove ${s.name} from ${bank.name}? Their account becomes a normal member account.`)) return;
    setBusy(true);
    try {
      await removeStaff(bank.id, s.id);
      update(staff.filter((x) => x.id !== s.id));
      toast.success(`${s.name} removed`);
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border-t border-gray-100 pt-5">
      <h4 className="text-sm font-semibold text-brand-blue">Staff</h4>
      {error && <p className="mt-2 text-sm text-red-600">{parseError(error).message}</p>}
      {!error && staff === null && <Spinner className="py-4" />}
      {staff && (
        <>
          {staff.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No staff yet. Nobody can manage this bank's stock except admins.</p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100">
              {staff.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <span className="font-medium text-gray-800">{s.name}</span>{" "}
                    <span className="text-gray-500">{[s.phone, s.email].filter(Boolean).join(" · ")}</span>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(s)}
                    className={`${smallBtn} border-red-200 text-red-600 hover:bg-red-50`}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={add} className="mt-3 flex max-w-md gap-2">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Member's phone, e.g. 01711111111"
              aria-label="Phone number of the member to add as staff"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-blue-200"
            />
            <button
              type="submit"
              disabled={busy || !phone.trim()}
              className="whitespace-nowrap rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-blue-dark disabled:opacity-50"
            >
              Add staff
            </button>
          </form>
          <p className="mt-1 text-xs text-gray-400">The person must already have a RoktoLagbe account with this phone number.</p>
        </>
      )}
    </div>
  );
}
