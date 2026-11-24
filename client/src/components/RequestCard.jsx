import { Link } from "react-router-dom";
import { MapPin, Clock, Droplets, Hospital, Phone } from "lucide-react";
import { URGENCY, STATUS, isActive } from "../utils/requests";
import useT from "../i18n/useT";
import requests, { timeLeftText, DATE_TIME } from "../i18n/requests";

export default function RequestCard({ request: r, showStatus = false }) {
  const { t, date, dist } = useT(requests);
  const urgency = URGENCY[r.urgency] || URGENCY.medium;
  const status = STATUS[r.status] || STATUS.open;
  const remaining = r.unitsNeeded - r.fulfilledUnits;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-md">
      <div className={`h-1.5 ${urgency.bar}`} />

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-xl font-extrabold text-brand-red">
            {r.bloodGroup}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${urgency.chip}`}>
                {t(`urgency_${URGENCY[r.urgency] ? r.urgency : "medium"}`)}
              </span>
              {showStatus && (
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.chip}`}>
                  {t(`status_${STATUS[r.status] ? r.status : "open"}`)}
                </span>
              )}
            </div>
            <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-gray-900">
              <Droplets size={15} className="shrink-0 text-brand-red" />
              {t("units", { count: isActive(r.status) ? remaining : r.unitsNeeded })} ·{" "}
              {requests.en[`component_${r.component}`] ? t(`component_${r.component}`) : t("blood")}
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-1.5 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <Hospital size={15} className="mt-0.5 shrink-0 text-gray-400" />
            <span className="min-w-0 break-words">{r.hospital}</span>
          </li>
          <li className="flex items-start gap-2">
            <MapPin size={15} className="mt-0.5 shrink-0 text-gray-400" />
            <span>{dist(r.district)}</span>
          </li>
          <li className="flex items-start gap-2">
            <Clock size={15} className="mt-0.5 shrink-0 text-gray-400" />
            <span>
              {date(r.neededBy, DATE_TIME)}
              {isActive(r.status) && (
                <span className="text-gray-400"> · {timeLeftText(t, r.neededBy)}</span>
              )}
            </span>
          </li>
        </ul>

        <div className="mt-auto flex gap-2 pt-5">
          <Link
            to={`/requests/${r.id}`}
            className="flex-1 rounded-lg bg-brand-red px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-brand-red-dark"
          >
            {r.isMine ? t("manageRequest") : t("viewDetails")}
          </Link>
          {r.contactPhone && isActive(r.status) && (
            <a
              href={`tel:${r.contactPhone}`}
              aria-label={t("callNumber", { phone: r.contactPhone })}
              className="flex items-center justify-center rounded-lg border border-gray-300 px-3.5 text-gray-700 transition hover:bg-gray-50"
            >
              <Phone size={17} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
