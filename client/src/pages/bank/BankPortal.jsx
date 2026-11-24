import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Building2, Droplet, Clock, AlertTriangle, PackagePlus, ExternalLink, Users, ClipboardList, HeartHandshake,
} from "lucide-react";
import { getMyBank, updateBank, listStaff, listBankDonations } from "../../services/banks";
import { listRequests } from "../../services/requests";
import { normalizeBank, normalizeStock, LOW_STOCK } from "../../utils/banks";
import { normalizeRequest, URGENCY, COMPONENT_LABEL, timeLeft } from "../../utils/requests";
import { parseError } from "../../utils/errors";
import { formatDate } from "../../utils/donors";
import StockGrid from "../../components/StockGrid";
import BankForm from "../../components/BankForm";
import Spinner from "../../components/Spinner";
import Pagination from "../../components/Pagination";
import RecordDonationForm from "../../components/RecordDonationForm";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "donations", label: "Donations" },
  { key: "requests", label: "Nearby requests" },
  { key: "profile", label: "Bank profile" },
  { key: "staff", label: "Staff" },
];

function StatCard({ icon: Icon, label, value, tone = "text-brand-blue" }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className={`flex items-center gap-2 text-sm font-medium ${tone}`}>
        <Icon size={18} />
        {label}
      </div>
      <div className="mt-2 text-3xl font-extrabold text-gray-800">{value}</div>
    </div>
  );
}

export default function BankPortal() {
  const [tab, setTab] = useState("overview");
  const [state, setState] = useState({ status: "loading", data: null, error: null });

  const load = useCallback(() => {
    return getMyBank()
      .then((data) =>
        setState({
          status: "ready",
          error: null,
          data: {
            bank: normalizeBank(data.bank),
            isApproved: Boolean(data.bank?.isApproved),
            stock: normalizeStock(data.stock),
            inventory: data.inventory || { byStatus: {}, expiringSoon: 0 },
          },
        })
      )
      .catch((err) => setState({ status: "error", data: null, error: err }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === "loading") return <Spinner />;

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-brand-blue">Blood bank portal</h1>
        <p className="mt-3 text-gray-600">{parseError(state.error).message}</p>
        <button
          type="button"
          onClick={() => {
            setState({ status: "loading", data: null, error: null });
            load();
          }}
          className="mt-6 rounded-lg bg-brand-red px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-dark"
        >
          Try again
        </button>
      </div>
    );
  }

  const { bank, isApproved, stock, inventory } = state.data;
  const available = inventory.byStatus.available?.units ?? 0;
  const reserved = inventory.byStatus.reserved?.units ?? 0;
  const lowGroups = Object.entries(stock).filter(([, u]) => u <= LOW_STOCK).map(([g]) => g);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-brand-red">
            <Building2 size={16} /> Blood bank portal
          </p>
          <h1 className="mt-1 text-3xl font-bold text-brand-blue">{bank.name}</h1>
          <p className="mt-1 text-gray-500">
            {[bank.address, bank.district].filter(Boolean).join(", ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/blood-banks/${bank.id}/manage`}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-red px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
          >
            <PackagePlus size={18} /> Manage stock
          </Link>
          {isApproved && (
            <Link
              to={`/blood-banks/${bank.id}`}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <ExternalLink size={16} /> Public page
            </Link>
          )}
        </div>
      </div>

      {!isApproved && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Clock size={18} className="mt-0.5 shrink-0" />
          <span>
            <strong>Waiting for approval.</strong> Your blood bank is hidden from the public until an
            administrator approves it. You can already fill in your profile and add stock.
          </span>
        </div>
      )}

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-gray-200" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              tab === t.key
                ? "border-brand-red text-brand-red"
                : "border-transparent text-gray-500 hover:text-brand-blue"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Droplet} label="Units available" value={available} tone="text-green-700" />
            <StatCard icon={Clock} label="Units reserved" value={reserved} tone="text-amber-700" />
            <StatCard
              icon={AlertTriangle}
              label="Batches expiring in 7 days"
              value={inventory.expiringSoon}
              tone={inventory.expiringSoon ? "text-red-600" : "text-gray-500"}
            />
            <StatCard
              icon={Droplet}
              label="Low or out groups"
              value={lowGroups.length}
              tone={lowGroups.length ? "text-brand-red" : "text-gray-500"}
            />
          </div>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-brand-blue">Usable stock by blood group</h2>
            <p className="mt-1 text-sm text-gray-500">
              Available, unexpired units. {isApproved ? "This is what the public sees." : ""}
            </p>
            <div className="mt-4">
              <StockGrid stock={stock} />
            </div>
          </section>
        </div>
      )}

      {tab === "donations" && <Donations bankId={bank.id} onRecorded={load} />}

      {tab === "requests" && <NearbyRequests district={bank.district} stock={stock} />}

      {tab === "profile" && (
        <section className="mt-6 max-w-2xl rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-brand-blue">Bank profile</h2>
          <p className="mt-1 mb-5 text-sm text-gray-500">
            Contact details and hours shown on your public page. Only an administrator can change
            the license number{bank.licenseNo ? ` (${bank.licenseNo})` : ""}.
          </p>
          <BankForm
            key={bank.id}
            initial={bank}
            showLicense={false}
            onSubmit={async (payload) => {
              try {
                await updateBank(bank.id, payload);
              } catch (err) {
                toast.error(parseError(err).message);
                throw err;
              }
              toast.success("Bank profile saved");
              load();
            }}
          />
        </section>
      )}

      {tab === "staff" && <StaffList bankId={bank.id} />}
    </div>
  );
}

function Donations({ bankId, onRecorded }) {
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [res, setRes] = useState({ status: "loading", donations: [], pages: 1, error: null });

  useEffect(() => {
    let cancelled = false;
    listBankDonations(bankId, { page, limit: 20 })
      .then((data) => {
        if (!cancelled) {
          setRes({ status: "ready", donations: data.donations || [], pages: data.pages || 1, error: null });
        }
      })
      .catch((err) => {
        if (!cancelled) setRes({ status: "error", donations: [], pages: 1, error: err });
      });
    return () => {
      cancelled = true;
    };
  }, [bankId, page, refreshKey]);

  const handleRecorded = () => {
    setPage(1);
    setRefreshKey((k) => k + 1);
    onRecorded(); // the new batch changes the stock numbers
  };

  return (
    <div className="mt-6 space-y-6">
      <RecordDonationForm bankId={bankId} onRecorded={handleRecorded} />

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-brand-blue">
          <HeartHandshake size={20} />
          <h2 className="font-semibold">Recent donations</h2>
        </div>

        {res.status === "loading" && <Spinner className="py-6" />}
        {res.status === "error" && <p className="mt-4 text-sm text-red-600">{parseError(res.error).message}</p>}
        {res.status === "ready" && res.donations.length === 0 && (
          <p className="mt-3 text-sm text-gray-500">No donations recorded at this bank yet.</p>
        )}
        {res.status === "ready" && res.donations.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Date</th>
                  <th className="py-2 pr-4 font-semibold">Donor</th>
                  <th className="py-2 pr-4 font-semibold">Group</th>
                  <th className="py-2 pr-4 font-semibold">Phone</th>
                  <th className="py-2 font-semibold">Units</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {res.donations.map((d) => (
                  <tr key={d.id}>
                    <td className="whitespace-nowrap py-3 pr-4 text-gray-600">{formatDate(d.donatedAt)}</td>
                    <td className="py-3 pr-4 font-medium text-gray-800">{d.donorName}</td>
                    <td className="py-3 pr-4 font-bold text-brand-red">{d.bloodGroup}</td>
                    <td className="whitespace-nowrap py-3 pr-4 text-gray-600">{d.phone}</td>
                    <td className="py-3 text-gray-800">{d.units}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {res.status === "ready" && <Pagination page={page} pages={res.pages} onChange={setPage} />}
      </section>
    </div>
  );
}

function NearbyRequests({ district, stock }) {
  const [res, setRes] = useState({ status: "loading", requests: [], error: null });

  useEffect(() => {
    let cancelled = false;
    listRequests({ district, limit: 30 })
      .then((data) => {
        if (!cancelled) setRes({ status: "ready", requests: (data.requests || []).map(normalizeRequest), error: null });
      })
      .catch((err) => {
        if (!cancelled) setRes({ status: "error", requests: [], error: err });
      });
    return () => {
      cancelled = true;
    };
  }, [district]);

  if (res.status === "loading") return <Spinner />;
  if (res.status === "error") {
    return <p className="mt-6 text-sm text-red-600">{parseError(res.error).message}</p>;
  }

  return (
    <section className="mt-6">
      <p className="text-sm text-gray-500">
        Open blood requests in <strong>{district}</strong>. Requests you can cover from your current stock are
        highlighted.
      </p>
      {res.requests.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-white p-10 text-center shadow-sm">
          <ClipboardList className="mx-auto text-gray-300" size={44} />
          <p className="mt-3 font-semibold text-gray-800">No open requests in {district} right now</p>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {res.requests.map((r) => {
            const have = stock[r.bloodGroup] ?? 0;
            const canCover = have >= r.unitsNeeded - r.fulfilledUnits;
            const urgency = URGENCY[r.urgency] || URGENCY.medium;
            return (
              <li key={r.id}>
                <Link
                  to={`/requests/${r.id}`}
                  className={`block rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow ${
                    canCover ? "border-green-300" : "border-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-extrabold text-brand-red">{r.bloodGroup}</span>
                      <div className="text-sm">
                        <p className="font-semibold text-gray-800">{r.hospital}</p>
                        <p className="text-gray-500">
                          {r.unitsNeeded} unit{r.unitsNeeded === 1 ? "" : "s"} · {COMPONENT_LABEL[r.component]}
                        </p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${urgency.chip}`}>
                      {urgency.label}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-gray-500">Needed {timeLeft(r.neededBy)}</span>
                    <span className={canCover ? "font-semibold text-green-700" : "text-gray-500"}>
                      You have {have} {r.bloodGroup} unit{have === 1 ? "" : "s"}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function StaffList({ bankId }) {
  const [res, setRes] = useState({ status: "loading", staff: [], error: null });

  useEffect(() => {
    let cancelled = false;
    listStaff(bankId)
      .then((data) => !cancelled && setRes({ status: "ready", staff: data.staff || [], error: null }))
      .catch((err) => !cancelled && setRes({ status: "error", staff: [], error: err }));
    return () => {
      cancelled = true;
    };
  }, [bankId]);

  return (
    <section className="mt-6 max-w-2xl rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 text-brand-blue">
        <Users size={20} />
        <h2 className="font-semibold">Staff accounts</h2>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        People who can manage this blood bank. To add or remove staff, contact an administrator.
      </p>
      {res.status === "loading" && <Spinner className="py-6" />}
      {res.status === "error" && <p className="mt-4 text-sm text-red-600">{parseError(res.error).message}</p>}
      {res.status === "ready" && (
        <ul className="mt-4 divide-y divide-gray-100">
          {res.staff.map((s) => (
            <li key={s.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
              <span className="font-medium text-gray-800">{s.name}</span>
              <span className="text-gray-500">{[s.phone, s.email].filter(Boolean).join(" · ")}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
