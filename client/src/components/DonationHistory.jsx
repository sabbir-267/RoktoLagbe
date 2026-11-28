import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HeartHandshake, Building2, Hospital, PenLine } from "lucide-react";
import { getMyDonations } from "../services/donors";
import { parseError } from "../utils/errors";
import Spinner from "./Spinner";
import useT from "../i18n/useT";
import dict from "../i18n/donationHistory";

// How each kind of record is shown (server: services/donationHistory.js)
const SOURCE = {
  bank: { icon: Building2, chip: "bg-green-100 text-green-800" },
  request: { icon: Hospital, chip: "bg-blue-100 text-brand-blue" },
  self: { icon: PenLine, chip: "bg-gray-100 text-gray-600" },
};

// `load` returns { donations }; defaults to the logged-in donor's own history.
// `bare` drops the card styling (for use inside another panel, e.g. the admin donor list).
export default function DonationHistory({ load = getMyDonations, bare = false, admin = false }) {
  const { t, date, dist } = useT(dict);
  const [res, setRes] = useState({ status: "loading", donations: [], error: null });

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => !cancelled && setRes({ status: "ready", donations: data.donations || [], error: null }))
      .catch((err) => !cancelled && setRes({ status: "error", donations: [], error: err }));
    return () => {
      cancelled = true;
    };
  }, [load]);

  const list = res.donations;
  const latest = list[0]?.donatedAt;

  return (
    <section className={bare ? "" : "rounded-2xl bg-white p-6 shadow-sm"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-brand-blue">
          <HeartHandshake size={20} />
          <h2 className="font-semibold">{t("donationHistory")}</h2>
        </div>
        {res.status === "ready" && list.length > 0 && (
          <p className="text-sm text-gray-500">
            {latest
              ? t("summary", { count: list.length, date: date(latest) })
              : t("summaryNoDate", { count: list.length })}
          </p>
        )}
      </div>

      {res.status === "loading" && <Spinner className="py-6" />}
      {res.status === "error" && <p className="mt-4 text-sm text-red-600">{parseError(res.error).message}</p>}

      {res.status === "ready" && list.length === 0 && (
        <p className="mt-3 text-sm text-gray-500">{admin ? t("noDonationsAdmin") : t("noDonations")}</p>
      )}

      {res.status === "ready" && list.length > 0 && (
        <ol className="mt-4 divide-y divide-gray-100">
          {list.map((d) => {
            const key = SOURCE[d.source] ? d.source : "bank";
            const { icon: Icon, chip } = SOURCE[key];
            const place =
              key === "bank"
                ? d.bankName || t("bloodBank")
                : key === "request"
                  ? d.hospital || t("viaRequest")
                  : t("selfEntry");
            const area = key === "bank" ? d.bankDistrict : d.district;
            return (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <Icon size={18} className="shrink-0 text-gray-400" />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800">
                      {place}
                      {area && <span className="font-normal text-gray-500"> · {dist(area)}</span>}
                    </p>
                    <p className="text-gray-500">
                      {date(d.donatedAt)}
                      {d.units > 1 && ` · ${t("common:units", { count: Number(d.units) })}`}
                      {key === "request" && d.requestId && (
                        <>
                          {" · "}
                          <Link to={`/requests/${d.requestId}`} className="font-semibold text-brand-blue hover:underline">
                            {t("viewRequest")}
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${chip}`}>{t(`source_${key}`)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
