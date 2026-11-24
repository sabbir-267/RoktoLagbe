import { useEffect, useState } from "react";
import { HeartHandshake, Building2 } from "lucide-react";
import { getMyDonations } from "../services/donors";
import { parseError } from "../utils/errors";
import Spinner from "./Spinner";
import useT from "../i18n/useT";
import dict from "../i18n/dashboard";

const STATUS = {
  verified: { chip: "bg-green-100 text-green-800" },
  pending_verification: { chip: "bg-amber-100 text-amber-800" },
  rejected: { chip: "bg-red-100 text-red-700" },
};

export default function DonationHistory() {
  const { t, date } = useT(dict);
  const [res, setRes] = useState({ status: "loading", donations: [], error: null });

  useEffect(() => {
    let cancelled = false;
    getMyDonations()
      .then((data) => !cancelled && setRes({ status: "ready", donations: data.donations || [], error: null }))
      .catch((err) => !cancelled && setRes({ status: "error", donations: [], error: err }));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 text-brand-blue">
        <HeartHandshake size={20} />
        <h2 className="font-semibold">{t("donationHistory")}</h2>
      </div>

      {res.status === "loading" && <Spinner className="py-6" />}
      {res.status === "error" && <p className="mt-4 text-sm text-red-600">{parseError(res.error).message}</p>}

      {res.status === "ready" && res.donations.length === 0 && (
        <p className="mt-3 text-sm text-gray-500">
          {t("noDonations")}
        </p>
      )}

      {res.status === "ready" && res.donations.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-100">
          {res.donations.map((d) => {
            const statusKey = STATUS[d.status] ? d.status : "pending_verification";
            const status = STATUS[statusKey];
            return (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <Building2 size={18} className="shrink-0 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-800">{d.bankName || t("bloodBank")}</p>
                    <p className="text-gray-500">
                      {date(d.donatedAt)} · {t("common:units", { count: Number(d.units) || 0 })}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.chip}`}>
                  {t(`status_${statusKey}`)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
