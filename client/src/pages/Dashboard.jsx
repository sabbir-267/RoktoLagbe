import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Stethoscope, UserRound, HeartPulse, ClipboardList, Smartphone, ShieldCheck, Building2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getMyProfile, setAvailability } from "../services/donors";
import { unwrapDonor, normalizeDonor } from "../utils/donors";
import { parseError } from "../utils/errors";
import Spinner from "../components/Spinner";
import EmailVerifyCard from "../components/EmailVerifyCard";
import DonationHistory from "../components/DonationHistory";
import useT from "../i18n/useT";
import dict from "../i18n/dashboard";

const ROLES = ["user", "bank_staff", "admin", "doctor"];

export default function Dashboard() {
  const { t, date, dist } = useT(dict);
  const { user } = useAuth();
  const [donor, setDonor] = useState(null); // null = no donor profile yet
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyProfile()
      .then((data) => {
        if (cancelled) return;
        setDonor(normalizeDonor(unwrapDonor(data)));
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 404) {
          setDonor(null);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleAvailability() {
    const next = !donor.availabilityOn;
    setToggling(true);
    try {
      await setAvailability(next);
      setDonor({ ...donor, availabilityOn: next, available: next && donor.eligible });
      toast.success(
        !next
          ? t("markedUnavailable")
          : donor.eligible
            ? t("nowAvailable")
            : t("savedAvailableLater")
      );
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold text-brand-blue">{t("welcome", { name: user.name })}</h1>
      <p className="mt-1 text-gray-500">{ROLES.includes(user.role) ? t(`role_${user.role}`) : user.role}</p>

      {user.needsPhone && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <span className="flex items-center gap-2">
            <Smartphone size={18} /> {t("addPhoneHint")}
          </span>
          <Link
            to="/add-phone"
            className="rounded-lg bg-brand-blue px-4 py-2 font-semibold text-white transition hover:opacity-90"
          >
            {t("addPhone")}
          </Link>
        </div>
      )}

      {user.role === "admin" && (
        <PortalBanner
          icon={ShieldCheck}
          to="/admin"
          title={t("adminTitle")}
          text={t("adminText")}
          action={t("adminAction")}
        />
      )}
      {user.role === "doctor" && (
        <PortalBanner
          icon={Stethoscope}
          to="/doctor-portal"
          title={t("doctorTitle")}
          text={t("doctorText")}
          action={t("doctorAction")}
        />
      )}
      {user.role === "bank_staff" && (
        <PortalBanner
          icon={Building2}
          to="/bank-portal"
          title={t("bankTitle")}
          text={t("bankText")}
          action={t("bankAction")}
        />
      )}

      <div className="mt-6">
        <EmailVerifyCard compact />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-brand-blue">
            <UserRound size={20} />
            <h2 className="font-semibold">{t("yourAccount")}</h2>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">{t("common:name")}</dt>
              <dd>{user.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">{t("common:phone")}</dt>
              <dd>{user.phone || t("notAdded")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">{t("common:email")}</dt>
              <dd>{user.email || t("notAdded")}</dd>
            </div>
          </dl>
          <Link to="/settings" className="mt-4 inline-block text-sm font-semibold text-brand-blue hover:underline">
            {t("accountSettings")}
          </Link>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-brand-red">
            <HeartPulse size={20} />
            <h2 className="font-semibold">{t("donorProfile")}</h2>
          </div>

          {status === "loading" && <Spinner className="py-6" />}

          {status === "error" && (
            <p className="mt-4 text-sm text-red-600">{t("donorLoadError")}</p>
          )}

          {status === "ready" && !donor && (
            <>
              <p className="mt-4 text-sm text-gray-600">
                {t("notDonorYet")}
              </p>
              <Link
                to="/donor-profile"
                className="mt-4 inline-block rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
              >
                {t("createDonorProfile")}
              </Link>
            </>
          )}

          {status === "ready" && donor && (
            <>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-2xl font-extrabold text-brand-red">
                  {donor.bloodGroup}
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-gray-800">
                    {[donor.area, donor.upazila, dist(donor.district)].filter(Boolean).join(", ")}
                  </p>
                  <p className={donor.eligible ? "text-green-700" : "text-amber-600"}>
                    {donor.eligible
                     ? t("eligible")
                     : donor.nextEligibleDate
                       ? t("eligibleAgainOn", { date: date(donor.nextEligibleDate) })
                       : t("donatedRecently")}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{t("availableToDonate")}</p>
                  <p className="text-xs text-gray-500">
                    {!donor.availabilityOn
                      ? t("hiddenFromFilters")
                      : donor.available
                        ? t("shownInSearch")
                        : donor.nextEligibleDate
                          ? t("shownFrom", { date: date(donor.nextEligibleDate) })
                          : t("shownOnceEligible")}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={donor.availabilityOn}
                  aria-label={t("toggleAvailability")}
                  onClick={toggleAvailability}
                  disabled={toggling}
                  className={`relative h-7 w-12 rounded-full transition disabled:opacity-60 ${
                    donor.availabilityOn ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                      donor.availabilityOn ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>

              <Link
                to="/donor-profile"
                className="mt-4 inline-block text-sm font-semibold text-brand-blue hover:underline"
              >
                {t("editDonorProfile")}
              </Link>
            </>
          )}
        </div>
      </div>

      {donor && (
        <div className="mt-6">
          <DonationHistory />
        </div>
      )}

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-brand-blue">
          <ClipboardList size={20} />
          <h2 className="font-semibold">{t("bloodRequests")}</h2>
        </div>
        <p className="mt-3 text-sm text-gray-600">
          {t("requestsText")}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/requests/new"
            className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
          >
            {t("postRequest")}
          </Link>
          <Link
            to="/requests?tab=mine"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            {t("myRequests")}
          </Link>
          <Link
            to="/requests"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            {t("browseRequests")}
          </Link>
        </div>
      </div>

      {user.role === "user" && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-6 shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-brand-blue">
              <Building2 size={20} />
              <h2 className="font-semibold">{t("runBank")}</h2>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              {t("runBankText")}
            </p>
          </div>
          <Link
            to="/bank-portal/register"
            className="rounded-lg border border-brand-blue px-4 py-2 text-sm font-semibold text-brand-blue transition hover:bg-blue-50"
          >
            {t("registerBank")}
          </Link>
        </div>
      )}
    </div>
  );
}

function PortalBanner({ icon: Icon, to, title, text, action }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50 p-5">
      <div>
        <div className="flex items-center gap-2 font-semibold text-brand-red">
          <Icon size={20} /> {title}
        </div>
        <p className="mt-1 text-sm text-gray-700">{text}</p>
      </div>
      <Link
        to={to}
        className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
      >
        {action}
      </Link>
    </div>
  );
}