import { useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { listUsers, updateUser } from "../../services/admin";
import { parseError } from "../../utils/errors";
import { formatDate } from "../../utils/donors";
import SelectField from "../../components/SelectField";
import Pagination from "../../components/Pagination";
import Spinner from "../../components/Spinner";
import SearchBox from "./SearchBox";
import usePagedList from "./usePagedList";

const ROLE_LABEL = { user: "Member", bank_staff: "Bank staff", admin: "Admin" };
const ROLE_CHIP = {
  user: "bg-gray-100 text-gray-600",
  bank_staff: "bg-blue-50 text-brand-blue",
  admin: "bg-red-50 text-brand-red",
};

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [filters, setFilters] = useState({ q: "", role: "", status: "", page: 1 });
  const [busyId, setBusyId] = useState(null);

  const params = { page: filters.page, limit: 20 };
  for (const k of ["q", "role", "status"]) if (filters[k]) params[k] = filters[k];
  const list = usePagedList(listUsers, "users", params);

  const change = (patch) => setFilters((f) => ({ ...f, ...patch, page: 1 }));

  async function apply(u, patch, message) {
    setBusyId(u.id);
    try {
      const data = await updateUser(u.id, patch);
      list.patchRow(u.id, data.user);
      toast.success(message);
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusyId(null);
    }
  }

  function changeRole(u, role) {
    if (role === u.role) return;
    const warn =
      role === "admin"
        ? `Make ${u.name} an administrator? They will have full control of the site.`
        : u.role === "bank_staff"
          ? `Remove ${u.name} from ${u.bloodBank?.name || "their blood bank"}?`
          : `Remove admin rights from ${u.name}?`;
    if (!window.confirm(warn)) return;
    apply(u, { role }, `${u.name} is now ${ROLE_LABEL[role].toLowerCase()}`);
  }

  function toggleActive(u) {
    const next = !u.isActive;
    if (!next && !window.confirm(`Deactivate ${u.name}? They will be logged out and unable to sign in.`)) return;
    apply(u, { isActive: next }, next ? `${u.name} reactivated` : `${u.name} deactivated`);
  }

  return (
    <section>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px_180px]">
        <SearchBox placeholder="Search name, phone or email" onSearch={(q) => change({ q })} />
        <SelectField label="Role" value={filters.role} onChange={(e) => change({ role: e.target.value })}>
          <option value="">All roles</option>
          <option value="user">Members</option>
          <option value="bank_staff">Bank staff</option>
          <option value="admin">Admins</option>
        </SelectField>
        <SelectField label="Status" value={filters.status} onChange={(e) => change({ status: e.target.value })}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Deactivated</option>
        </SelectField>
      </div>

      {list.loading ? (
        <Spinner />
      ) : list.error && !list.stale ? (
        <p className="mt-6 text-sm text-red-600">{parseError(list.error).message}</p>
      ) : (
        <div className={list.stale ? "opacity-60 transition" : "transition"}>
          <p className="mt-4 text-sm text-gray-500">{list.total} user{list.total === 1 ? "" : "s"}</p>
          <div className="mt-2 overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {list.rows.map((u) => {
                  const isMe = u.id === me.id;
                  const busy = busyId === u.id;
                  return (
                    <tr key={u.id} className="align-middle">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800">
                          {u.name} {isMe && <span className="text-xs font-normal text-gray-400">(you)</span>}
                        </div>
                        {u.bloodBank && <div className="text-xs text-brand-blue">{u.bloodBank.name}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <div>{u.phone || <span className="text-gray-400">No phone</span>}</div>
                        <div className="text-xs">
                          {u.email || <span className="text-gray-400">No email</span>}
                          {u.email && (u.isEmailVerified ? " ✓" : " (unverified)")}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(u.createdAt)}</td>
                      <td className="px-4 py-3">
                        {isMe ? (
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_CHIP[u.role]}`}>
                            {ROLE_LABEL[u.role]}
                          </span>
                        ) : (
                          <select
                            aria-label={`Role of ${u.name}`}
                            value={u.role}
                            disabled={busy}
                            onChange={(e) => changeRole(u, e.target.value)}
                            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-blue-200"
                          >
                            <option value="user">Member</option>
                            {/* Bank staff are assigned from the Blood banks tab */}
                            {u.role === "bank_staff" && <option value="bank_staff">Bank staff</option>}
                            <option value="admin">Admin</option>
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isMe ? (
                          <span className="text-xs text-green-700">Active</span>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => toggleActive(u)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                              u.isActive
                                ? "border-red-200 text-red-600 hover:bg-red-50"
                                : "border-green-300 text-green-700 hover:bg-green-50"
                            }`}
                          >
                            {u.isActive ? "Deactivate" : "Reactivate"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {list.rows.length === 0 && <p className="p-8 text-center text-gray-500">No users match these filters.</p>}
          </div>
          <Pagination page={filters.page} pages={list.pages} onChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
        </div>
      )}
    </section>
  );
}
