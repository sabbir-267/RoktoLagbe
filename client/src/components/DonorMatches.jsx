import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BadgeCheck, BellRing, MapPin, Phone, MessageCircle, RefreshCw, Users, CheckCircle2 } from "lucide-react";
import { getMatches, notifyMatches, getResponses } from "../services/requests";
import { parseError } from "../utils/errors";
import { toWhatsAppNumber } from "../utils/phone";
import Spinner from "./Spinner";
import useT from "../i18n/useT";
import requests from "../i18n/requests";

// Label shown as t(`resp_${key}`)
const RESPONSE = {
  accepted: "bg-green-50 text-green-700",
  declined: "bg-gray-100 text-gray-500",
  pending: "bg-amber-50 text-amber-700",
};

function ContactButtons({ phone }) {
  const { t } = useT(requests);
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <a
        href={`tel:${phone}`}
        className="flex items-center justify-center gap-1 rounded-lg bg-brand-red px-2 py-2 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
      >
        <Phone size={15} />
        {t("call")}
      </a>
      <a
        href={`https://wa.me/${toWhatsAppNumber(phone)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1 rounded-lg bg-green-600 px-2 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
      >
        <MessageCircle size={15} />
        WhatsApp
      </a>
    </div>
  );
}

// Shown to the requester (and bank staff / admins) of an active request
export default function DonorMatches({ requestId, active, onChanged }) {
  const { t, n: num, dist } = useT(requests);
  const [includeOther, setIncludeOther] = useState(false);
  const [version, setVersion] = useState(0);
  const [notifying, setNotifying] = useState(false);
  const [result, setResult] = useState({ key: null, matches: [], groups: [], note: "", responses: null, error: null });

  // A result counts only if it belongs to the current search, so "loading" is worked out here
  const loadKey = `${requestId}|${active}|${includeOther}|${version}`;
  const status = result.key !== loadKey ? "loading" : result.error ? "error" : "ready";

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      active ? getMatches(requestId, { limit: 10, includeOtherDistricts: includeOther }) : null,
      getResponses(requestId),
    ])
      .then(([m, r]) => {
        if (cancelled) return;
        setResult({
          key: loadKey,
          matches: m?.matches || [],
          groups: m?.compatibleGroups || [],
          note: m?.note || "",
          responses: r,
          error: null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setResult({ key: loadKey, matches: [], groups: [], note: "", responses: null, error: err });
      });

    return () => {
      cancelled = true;
    };
  }, [requestId, active, includeOther, loadKey]);

  async function notify() {
    setNotifying(true);
    try {
      const data = await notifyMatches(requestId, { limit: 10, includeOtherDistricts: includeOther });
      const n = data.notified?.length ?? 0;
      if (n > 0) {
        toast.success(t("notified", { count: n }));
      } else if (data.capReached) {
        toast(t("capReached"));
      } else if (data.skipped?.cooldown > 0) {
        toast(t("cooldown"));
      } else {
        toast(t("noNew"));
      }
      setVersion((v) => v + 1);
      onChanged?.();
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setNotifying(false);
    }
  }

  const { matches, groups, note, responses, error } = result;
  const counts = responses?.counts;
  const accepted = responses?.accepted || [];

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-brand-blue">
            <Users size={19} />
            {t("matchingDonors")}
          </h2>
          {groups.length > 0 && (
            <p className="mt-1 text-sm text-gray-500">{t("compatible", { groups: groups.join(", ") })}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setVersion((v) => v + 1)}
          aria-label={t("refresh")}
          className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {status === "loading" && <Spinner className="py-10" />}

      {status === "error" && (
        <div className="mt-4 text-center">
          <p className="text-sm text-red-600">{parseError(error).message}</p>
          <button
            type="button"
            onClick={() => setVersion((v) => v + 1)}
            className="mt-3 rounded-lg bg-brand-red px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
          >
            {t("common:tryAgain")}
          </button>
        </div>
      )}

      {status === "ready" && (
        <>
          {counts && counts.notified > 0 && (
            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              {[
                ["countNotified", counts.notified],
                ["countWaiting", counts.pending],
                ["countAccepted", counts.accepted],
                ["countDeclined", counts.declined],
              ].map(([label, n]) => (
                <div key={label} className="rounded-xl bg-gray-50 px-2 py-3">
                  <p className="text-xl font-bold text-gray-900">{num(n)}</p>
                  <p className="text-xs text-gray-500">{t(label)}</p>
                </div>
              ))}
            </div>
          )}

          {accepted.length > 0 && (
            <div className="mt-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-green-700">
                <CheckCircle2 size={17} />
                {t("saidYes")}
              </h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {accepted.map((d) => (
                  <div key={d.donorId} className="rounded-xl border border-green-200 bg-green-50/50 p-4">
                    <p className="flex items-center gap-1 font-semibold text-gray-900">
                      {d.name}
                      {d.isVerified && <BadgeCheck size={16} className="text-brand-blue" aria-label={t("verifiedDonor")} />}
                    </p>
                    <p className="text-sm text-gray-500">
                      {d.bloodGroup} · {[d.upazila, dist(d.district)].filter(Boolean).join(", ")}
                    </p>
                    {d.phone && <p className="mt-1 text-sm font-medium text-gray-700">{d.phone}</p>}
                    {d.phone && <ContactButtons phone={d.phone} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {active && (
            <>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={includeOther}
                    onChange={(e) => setIncludeOther(e.target.checked)}
                    className="h-4 w-4 accent-brand-red"
                  />
                  {t("includeOther")}
                </label>
                <button
                  type="button"
                  onClick={notify}
                  disabled={notifying}
                  className="flex items-center gap-2 rounded-lg bg-brand-red px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark disabled:opacity-50"
                >
                  <BellRing size={16} />
                  {notifying ? t("notifying") : t("notify")}
                </button>
              </div>

              {matches.length === 0 ? (
                <p className="mt-4 rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                  {t("noMatches")}
                  {!includeOther && t("tryOther")}
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-gray-100">
                  {matches.map((m) => {
                    const state = m.notified ? (RESPONSE[m.response] ? m.response : "pending") : null;
                    return (
                      <li key={m.donorId} className="flex items-start gap-3 py-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-base font-extrabold text-brand-red">
                          {m.bloodGroup}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-x-2 font-semibold text-gray-900">
                            <span className="flex items-center gap-1">
                              {m.name || t("donor")}
                              {m.isVerified && <BadgeCheck size={16} className="text-brand-blue" aria-label={t("verifiedDonor")} />}
                            </span>
                            {state && (
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${RESPONSE[state]}`}>
                                {t(`resp_${state}`)}
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-sm text-gray-500">
                            <MapPin size={13} className="shrink-0" />
                            {[m.upazila, dist(m.district)].filter(Boolean).join(", ") || t("locationNotSet")}
                            {m.distanceKm != null && t("kmAway", { km: Math.round(m.distanceKm * 10) / 10 })}
                          </p>
                          {m.reasons?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {m.reasons.map((r) => (
                                <span key={r} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-brand-blue">
                                  {r}
                                </span>
                              ))}
                            </div>
                          )}
                          {m.phone && (
                            <a href={`tel:${m.phone}`} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-blue hover:underline">
                              <Phone size={14} />
                              {m.phone}
                            </a>
                          )}
                        </div>
                        <span className="shrink-0 rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600" title={t("matchScore")}>
                          {t("pts", { score: m.score })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {note && <p className="mt-3 text-xs text-gray-400">{note}</p>}
            </>
          )}
        </>
      )}
    </section>
  );
}
