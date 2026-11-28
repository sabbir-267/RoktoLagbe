import { Fragment, useCallback, useState } from "react";
import toast from "react-hot-toast";
import { BadgeCheck } from "lucide-react";
import { listAllDonors, verifyDonor, getDonorDonations } from "../../services/admin";
import DonationHistory from "../../components/DonationHistory";
import { parseError } from "../../utils/errors";
import { formatDate } from "../../utils/donors";
import { BLOOD_GROUPS } from "../../data/bangladesh";
import SelectField from "../../components/SelectField";
import Pagination from "../../components/Pagination";
import Spinner from "../../components/Spinner";
import SearchBox from "./SearchBox";
import usePagedList from "./usePagedList";

// Loads one donor's full history (bank, requester-confirmed and self-reported)
function DonorHistory({ donorId }) {
  const load = useCallback(() => getDonorDonations(donorId), [donorId]);
  return <DonationHistory load={load} bare admin />;
}

export default function AdminDonors() {
  const [filters, setFilters] = useState({ q: "", verified: "false", bloodGroup: "", page: 1 });
  const [busyId, setBusyId] = useState(null);
  const [openId, setOpenId] = useState(null);

  const params = { page: filters.page, limit: 20 };
  for (const k of ["q", "verified", "bloodGroup"]) if (filters[k]) params[k] = filters[k];
  const list = usePagedList(listAllDonors, "donors", params);

  const change = (patch) => setFilters((f) => ({ ...f, ...patch, page: 1 }));

  async function setVerified(d, isVerified) {
    setBusyId(d.id);
    try {
      await verifyDonor(d.id, isVerified);
      list.patchRow(d.id, { isVerified });
      toast.success(isVerified ? `${d.name} verified` : `Verification removed from ${d.name}`);
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px_160px]">
        <SearchBox placeholder="Search name, phone, email or district" onSearch={(q) => change({ q })} />
        <SelectField label="Verification" value={filters.verified} onChange={(e) => change({ verified: e.target.value })}>
          <option value="false">Not verified</option>
          <option value="true">Verified</option>
          <option value="">All donors</option>
        </SelectField>
        <SelectField label="Blood group" value={filters.bloodGroup} onChange={(e) => change({ bloodGroup: e.target.value })}>
          <option value="">All groups</option>
          {BLOOD_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
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
          <p className="mt-4 text-sm text-gray-500">{list.total} donor{list.total === 1 ? "" : "s"}</p>
          <div className="mt-2 overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Group</th>
                  <th className="px-4 py-3 font-semibold">Donor</th>
                  <th className="px-4 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 font-semibold">Donations</th>
                  <th className="px-4 py-3 font-semibold">Registered</th>
                  <th className="px-4 py-3 font-semibold">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {list.rows.map((d) => (
                  <Fragment key={d.id}>
                  <tr className="align-middle">
                    <td className="px-4 py-3 text-lg font-extrabold text-brand-red">{d.bloodGroup}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800">
                        {d.name}
                        {d.userActive === false && (
                          <span className="ml-2 text-xs font-normal text-red-600">(account deactivated)</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{[d.phone, d.email].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{[d.upazila, d.district].filter(Boolean).join(", ")}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {d.totalDonations || 0}
                      {d.lastDonationDate && (
                        <div className="text-xs text-gray-400">Last: {formatDate(d.lastDonationDate)}</div>
                      )}
                      <button
                        type="button"
                        onClick={() => setOpenId((id) => (id === d.id ? null : d.id))}
                        aria-expanded={openId === d.id}
                        className="mt-1 text-xs font-semibold text-brand-blue hover:underline"
                      >
                        {openId === d.id ? "Hide history" : "History"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(d.createdAt)}</td>
                    <td className="px-4 py-3">
                      {d.isVerified ? (
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                            <BadgeCheck size={16} /> Verified
                          </span>
                          <button
                            type="button"
                            disabled={busyId === d.id}
                            onClick={() => setVerified(d, false)}
                            className="text-xs font-semibold text-gray-500 hover:text-red-600 disabled:opacity-50"
                          >
                            Undo
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === d.id}
                          onClick={() => setVerified(d, true)}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                        >
                          Verify
                        </button>
                      )}
                    </td>
                  </tr>
                  {openId === d.id && (
                    <tr>
                      <td colSpan={6} className="bg-gray-50/60 px-6 py-4">
                        <DonorHistory donorId={d.id} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {list.rows.length === 0 && <p className="p-8 text-center text-gray-500">No donors match these filters.</p>}
          </div>
          <Pagination page={filters.page} pages={list.pages} onChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
        </div>
      )}
    </section>
  );
}
