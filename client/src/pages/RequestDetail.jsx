import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { BellRing,
  ArrowLeft,
  Clock,
  Droplets,
  Hospital,
  MapPin,
  Phone,
  MessageCircle,
  Lock,
  User,
  HeartHandshake,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import MessageButton from "../components/MessageButton";
import { getRequest, setRequestStatus, respondToRequest } from "../services/requests";
import { URGENCY, STATUS, normalizeRequest, isActive } from "../utils/requests";
import { toWhatsAppNumber } from "../utils/phone";
import { parseError } from "../utils/errors";
import DonorMatches from "../components/DonorMatches";
import DonorTripCard from "../components/trip/DonorTripCard";
import RequesterTripsPanel from "../components/trip/RequesterTripsPanel";
import { fromLngLat } from "../components/map/geo";
import Spinner from "../components/Spinner";
import useT from "../i18n/useT";
import requests, { timeLeftText, DATE_TIME } from "../i18n/requests";

function BackLink() {
  const { t } = useT(requests);
  return (
    <Link to="/requests" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline">
      <ArrowLeft size={16} />
      {t("allRequests")}
    </Link>
  );
}

function InfoRow({ icon: Icon, children }) {
  return (
    <li className="flex items-start gap-3 text-sm text-gray-700">
      <Icon size={17} className="mt-0.5 shrink-0 text-gray-400" />
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

export default function RequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const { t, date, dist } = useT(requests);

  const [version, setVersion] = useState(0);
  const [result, setResult] = useState({ key: null, request: null, error: null });
  const [busy, setBusy] = useState(false);
  const [units, setUnits] = useState("");
  const [showFulfil, setShowFulfil] = useState(false);

  // A result counts only if it belongs to the current request, so "loading" is worked out here
  const requestKey = `${id}|${user?.id ?? "guest"}|${version}`;
  const status = result.key !== requestKey ? "loading" : result.error ? "error" : "ready";

  useEffect(() => {
    let cancelled = false;
    getRequest(id)
      .then((data) => {
        if (!cancelled) setResult({ key: requestKey, request: normalizeRequest(data.request), error: null });
      })
      .catch((err) => {
        if (!cancelled) setResult({ key: requestKey, request: null, error: err });
      });
    return () => {
      cancelled = true;
    };
  }, [id, requestKey]);

  const { request: r, error } = result;
  const reload = () => setVersion((v) => v + 1);

  if (status === "loading") return <Spinner />;

  if (status === "error") {
    const notFound = error?.response?.status === 404 || error?.response?.status === 400;
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-brand-blue">
          {notFound ? t("notFound") : t("somethingWrong")}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {notFound ? t("notFoundText") : parseError(error).message}
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          {!notFound && (
            <button
              type="button"
              onClick={reload}
              className="rounded-lg bg-brand-red px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
            >
              {t("common:tryAgain")}
            </button>
          )}
          <BackLink />
        </div>
      </div>
    );
  }

  const urgency = URGENCY[r.urgency] || URGENCY.medium;
  const st = STATUS[r.status] || STATUS.open;
  const active = isActive(r.status);
  const privileged = user && ["admin", "bank_staff"].includes(user.role);
  const canManage = r.isMine || privileged;
  const remaining = Math.max(r.unitsNeeded - r.fulfilledUnits, 0);
  const hospitalPoint = fromLngLat(r.coordinates);

  async function changeStatus(next, fulfilledUnits) {
    setBusy(true);
    try {
      await setRequestStatus(r.id, next, fulfilledUnits);
      toast.success(
        next === "fulfilled" ? t("toastFulfilled") : next === "cancelled" ? t("toastCancelled") : t("toastStatus")
      );
      setShowFulfil(false);
      reload();
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusy(false);
    }
  }

  function cancelRequest() {
    if (window.confirm(t("confirmCancel"))) {
      changeStatus("cancelled");
    }
  }

  function submitFulfil(e) {
    e.preventDefault();
    const n = Number(units || r.unitsNeeded);
    if (!Number.isInteger(n) || n < 1 || n > r.unitsNeeded) {
      toast.error(t("wholeNumber", { max: r.unitsNeeded }));
      return;
    }
    changeStatus("fulfilled", n);
  }

  async function respond(answer) {
    setBusy(true);
    try {
      await respondToRequest(r.id, answer);
      toast.success(answer === "accepted" ? t("toastAccepted") : t("toastResponse"));
      reload();
    } catch (err) {
      if (err.response?.status === 409) reload(); // already answered, or the request closed
      else toast.error(parseError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <BackLink />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-2xl font-extrabold text-brand-red">
          {r.bloodGroup}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-brand-blue sm:text-3xl">
            {t("heading", {
              count: remaining || r.unitsNeeded,
              component: requests.en[`component_${r.component}`] ? t(`component_${r.component}`) : t("bloodLower"),
            })}
          </h1>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${urgency.chip}`}>{t("urgencyChip", { level: t(`urgency_${URGENCY[r.urgency] ? r.urgency : "medium"}`) })}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.chip}`}>{t(`status_${STATUS[r.status] ? r.status : "open"}`)}</span>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          {/* Details */}
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-brand-blue">{t("details")}</h2>
            <ul className="mt-4 space-y-3">
              {r.patientName && <InfoRow icon={User}>{t("patient", { name: r.patientName })}</InfoRow>}
              <InfoRow icon={Hospital}>{r.hospital}</InfoRow>
              <InfoRow icon={MapPin}>{dist(r.district)}</InfoRow>
              <InfoRow icon={Clock}>
                {t("neededByOn", { date: date(r.neededBy, DATE_TIME) })}
                {active && <span className="text-gray-400"> · {timeLeftText(t, r.neededBy)}</span>}
              </InfoRow>
              <InfoRow icon={Droplets}>
                {r.fulfilledUnits > 0
                  ? t("received", { done: r.fulfilledUnits, total: r.unitsNeeded })
                  : t("unitsNeeded", { count: r.unitsNeeded })}
              </InfoRow>
            </ul>
            {r.notes && <p className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">{r.notes}</p>}
            <p className="mt-4 text-xs text-gray-400">
              {t("posted", { date: date(r.createdAt, DATE_TIME) })}
            </p>
          </section>

          {/* Requester tools */}
          {canManage && (active || r.isMine) && (
            <>
              {active && (
                <section className="rounded-2xl bg-white p-6 shadow-sm">
                  <h2 className="font-semibold text-brand-blue">{t("manage")}</h2>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setShowFulfil((s) => !s)}
                      className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                    >
                      <CheckCircle2 size={16} />
                      {t("markFulfilled")}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={cancelRequest}
                      className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                    >
                      <XCircle size={16} />
                      {t("cancelRequest")}
                    </button>
                    {privileged && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => changeStatus(r.status === "open" ? "in_progress" : "open")}
                        className="rounded-lg border border-brand-blue/30 px-4 py-2.5 text-sm font-semibold text-brand-blue transition hover:bg-blue-50 disabled:opacity-60"
                      >
                        {r.status === "open" ? t("markInProgress") : t("reopen")}
                      </button>
                    )}
                  </div>

                  {showFulfil && (
                    <form onSubmit={submitFulfil} className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-gray-50 p-4">
                      <label className="block text-sm font-medium text-gray-700">
                        {t("unitsReceived")}
                        <input
                          type="number"
                          min={1}
                          max={r.unitsNeeded}
                          value={units}
                          placeholder={String(r.unitsNeeded)}
                          onChange={(e) => setUnits(e.target.value)}
                          className="mt-1 block w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-brand-blue focus:ring-2 focus:ring-blue-200"
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={busy}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                      >
                        {t("confirm")}
                      </button>
                    </form>
                  )}
                </section>
              )}

              {r.isMine && r.autoNotify && (
                <p className="mt-6 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                  <BellRing size={18} className="mt-0.5 shrink-0" />
                  <span>
                    {r.autoNotify.notified
                      ? t(r.autoNotify.widened ? "autoAlertedWide" : "autoAlerted", { count: r.autoNotify.notified })
                      : t("autoNone")}
                    {r.autoNotify.emailed > 0 && ` ${t("autoEmailed", { count: r.autoNotify.emailed })}`}
                  </span>
                </p>
              )}

              {r.isMine && active && <RequesterTripsPanel requestId={r.id} hospital={hospitalPoint} />}

              <DonorMatches requestId={r.id} active={active} onChanged={reload} />
            </>
          )}

          {/* Donor response: only for donors who were notified about this request */}
          {user && !r.isMine && active && r.myResponse && (
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 font-semibold text-brand-blue">
                <HeartHandshake size={19} />
                {t("canYouDonate")}
              </h2>
              {r.myResponse === "accepted" ? (
                <p className="mt-3 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
                  {t("youAccepted")}
                </p>
              ) : r.myResponse === "declined" ? (
                <p className="mt-3 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  {t("youDeclined")}
                </p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-gray-500">
                    {t("matchedText")}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => respond("accepted")}
                      className="rounded-lg bg-brand-red px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
                    >
                      {t("yesDonate")}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => respond("declined")}
                      className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                    >
                      {t("notThisTime")}
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          {/* Live trip sharing for a donor who said yes */}
          {user && !r.isMine && active && r.myResponse === "accepted" && (
            <DonorTripCard requestId={r.id} hospital={hospitalPoint} />
          )}
        </div>

        {/* Contact */}
        <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-brand-blue">{t("contact")}</h2>
          {!user ? (
            <Link
              to="/login"
              state={{ from: location }}
              className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-brand-blue/30 px-4 py-2.5 text-sm font-semibold text-brand-blue transition hover:bg-blue-50"
            >
              <Lock size={16} />
              {t("loginForContact")}
            </Link>
          ) : r.contactPhone ? (
            <>
              <p className="mt-4 text-sm font-medium text-gray-800">{r.contactPhone}</p>
              {active ? (
                <div className="mt-3 space-y-2">
                  <a
                    href={`tel:${r.contactPhone}`}
                    className="flex items-center justify-center gap-2 rounded-lg bg-brand-red px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
                  >
                    <Phone size={16} />
                    {t("callNow")}
                  </a>
                  <a
                    href={`https://wa.me/${toWhatsAppNumber(r.contactPhone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
                  >
                    <MessageCircle size={16} />
                    WhatsApp
                  </a>
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-400">{t("closed")}</p>
              )}
            </>
          ) : (
            <p className="mt-4 text-sm text-gray-500">{t("noContact")}</p>
          )}
          {user && !r.isMine && (
            <MessageButton
              target={{ requestId: r.id }}
              label={t("messageRequester")}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-brand-blue/30 px-4 py-2.5 text-sm font-semibold text-brand-blue transition hover:bg-blue-50 disabled:opacity-60"
            />
          )}
          {!r.isMine && (
            <Link
              to={`/complaints?related=${encodeURIComponent(`/requests/${r.id}`)}&category=fake_request`}
              className="mt-4 block text-center text-xs font-medium text-gray-400 transition hover:text-red-600"
            >
              {t("reportRequest")}
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
