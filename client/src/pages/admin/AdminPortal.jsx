import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ShieldCheck, Users, Building2, HeartPulse, ClipboardList, Droplet, MessageSquareWarning, Stethoscope } from "lucide-react";
import { getAdminStats } from "../../services/admin";
import { normalizeStock } from "../../utils/banks";
import { parseError } from "../../utils/errors";
import StockGrid from "../../components/StockGrid";
import Spinner from "../../components/Spinner";
import AdminUsers from "./AdminUsers";
import AdminBanks from "./AdminBanks";
import AdminDonors from "./AdminDonors";
import AdminComplaints from "./AdminComplaints";
import AdminDoctors from "./AdminDoctors";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "banks", label: "Blood banks" },
  { key: "donors", label: "Donors" },
  { key: "doctors", label: "Doctors" },
  { key: "users", label: "Users" },
  { key: "complaints", label: "Complaints" },
];

export default function AdminPortal() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "overview";
  const goTo = (key) => setParams(key === "overview" ? {} : { tab: key });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-brand-red">
        <ShieldCheck size={16} /> Admin portal
      </p>
      <h1 className="mt-1 text-3xl font-bold text-brand-blue">RoktoLagbe administration</h1>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-gray-200" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => goTo(t.key)}
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

      <div className="mt-6">
        {tab === "overview" && <Overview goTo={goTo} />}
        {tab === "banks" && <AdminBanks />}
        {tab === "donors" && <AdminDonors />}
        {tab === "doctors" && <AdminDoctors />}
        {tab === "users" && <AdminUsers />}
        {tab === "complaints" && <AdminComplaints />}
      </div>
    </div>
  );
}

function Card({ icon: Icon, title, value, lines, action, onAction, tone = "text-brand-blue" }) {
  return (
    <div className="flex flex-col rounded-2xl bg-white p-5 shadow-sm">
      <div className={`flex items-center gap-2 text-sm font-semibold ${tone}`}>
        <Icon size={18} /> {title}
      </div>
      <div className="mt-2 text-3xl font-extrabold text-gray-800">{value}</div>
      <ul className="mt-2 flex-1 space-y-0.5 text-sm text-gray-500">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 self-start text-sm font-semibold text-brand-red hover:underline"
        >
          {action} →
        </button>
      )}
    </div>
  );
}

function Overview({ goTo }) {
  const [res, setRes] = useState({ status: "loading", stats: null, error: null });

  useEffect(() => {
    let cancelled = false;
    getAdminStats()
      .then((data) => !cancelled && setRes({ status: "ready", stats: data.stats, error: null }))
      .catch((err) => !cancelled && setRes({ status: "error", stats: null, error: err }));
    return () => {
      cancelled = true;
    };
  }, []);

  if (res.status === "loading") return <Spinner />;
  if (res.status === "error") return <p className="text-sm text-red-600">{parseError(res.error).message}</p>;

  const { users, donors, banks, requests, stock } = res.stats;
  const complaints = res.stats.complaints || { open: 0, inReview: 0 };
  const activeRequests = (requests.open || 0) + (requests.in_progress || 0);
  const doctors = res.stats.doctors || null;
  const consultations = res.stats.consultations || null;
  const pendingDoctors = doctors?.pending || 0;

  return (
    <div className="space-y-6">
      {banks.pending > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <span>
            <strong>{banks.pending}</strong> blood bank{banks.pending === 1 ? " is" : "s are"} waiting for approval.
          </span>
          <button
            type="button"
            onClick={() => goTo("banks")}
            className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700"
          >
            Review
          </button>
        </div>
      )}

      {pendingDoctors > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <span className="flex items-center gap-2">
            <Stethoscope size={18} />
            <span>
              <strong>{pendingDoctors}</strong> doctor application{pendingDoctors === 1 ? " is" : "s are"} waiting for review.
            </span>
          </span>
          <button
            type="button"
            onClick={() => goTo("doctors")}
            className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700"
          >
            Review
          </button>
        </div>
      )}

      {complaints.open > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-brand-red-dark">
          <span className="flex items-center gap-2">
            <MessageSquareWarning size={18} />
            <span>
              <strong>{complaints.open}</strong> new complaint{complaints.open === 1 ? " needs" : "s need"} a look.
            </span>
          </span>
          <button
            type="button"
            onClick={() => goTo("complaints")}
            className="rounded-lg bg-brand-red px-4 py-2 font-semibold text-white hover:bg-brand-red-dark"
          >
            Review
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          icon={Users}
          title="Users"
          value={users.total}
          lines={[`${users.admins} admins`, `${users.bankStaff} bank staff`, `${users.inactive} deactivated`]}
          action="Manage users"
          onAction={() => goTo("users")}
        />
        <Card
          icon={HeartPulse}
          title="Donors"
          value={donors.total}
          tone="text-brand-red"
          lines={[`${donors.verified} verified`, `${donors.total - donors.verified} not verified`, `${donors.available} available now`]}
          action="Verify donors"
          onAction={() => goTo("donors")}
        />
        <Card
          icon={Building2}
          title="Blood banks"
          value={banks.approved + banks.pending}
          lines={[`${banks.approved} approved`, `${banks.pending} pending`]}
          action="Manage banks"
          onAction={() => goTo("banks")}
        />
        <Card
          icon={ClipboardList}
          title="Active requests"
          value={activeRequests}
          tone="text-amber-700"
          lines={[
            `${requests.open || 0} open, ${requests.in_progress || 0} in progress`,
            `${requests.fulfilled || 0} fulfilled`,
            `${(requests.cancelled || 0) + (requests.expired || 0)} cancelled or expired`,
          ]}
        />
        <Card
          icon={MessageSquareWarning}
          title="Open complaints"
          value={complaints.open + complaints.inReview}
          tone="text-brand-red"
          lines={[`${complaints.open} new`, `${complaints.inReview} in review`]}
          action="Handle complaints"
          onAction={() => goTo("complaints")}
        />
        {(doctors || consultations) && (
          <Card
            icon={Stethoscope}
            title="Ask a doctor"
            value={doctors ? doctors.approved || 0 : (consultations.open || 0) + (consultations.answered || 0)}
            tone="text-green-700"
            lines={[
              ...(doctors ? [`${doctors.approved || 0} verified doctors`, `${pendingDoctors} applications pending`] : []),
              ...(consultations
                ? [`${consultations.open || 0} questions waiting for a doctor`, `${consultations.answered || 0} answered`]
                : []),
            ]}
            action="Review doctors"
            onAction={() => goTo("doctors")}
          />
        )}
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-brand-blue">
          <Droplet size={18} />
          <h2 className="font-semibold">Usable stock across all blood banks</h2>
        </div>
        <div className="mt-4">
          <StockGrid stock={normalizeStock(Object.entries(stock).map(([bloodGroup, units]) => ({ bloodGroup, units })))} />
        </div>
      </section>
    </div>
  );
}
