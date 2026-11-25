import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Inbox, MessageCircleQuestion, ChevronRight, Stethoscope } from "lucide-react";
import useT from "../../i18n/useT";
import dict from "../../i18n/doctors";
import usePageTitle from "../../hooks/usePageTitle";
import { listMyConsultations, CONSULTATION_STATUS_CHIP } from "../../services/consultations";
import Spinner from "../../components/Spinner";
import { DoctorAvatar } from "./DoctorsHome";

export default function MyConsultations() {
  const { t, date } = useT(dict);
  const [res, setRes] = useState({ status: "loading", rows: [] });
  usePageTitle(t("mineTitle"));

  useEffect(() => {
    let cancelled = false;
    listMyConsultations()
      .then((data) => !cancelled && setRes({ status: "ready", rows: data.consultations || [] }))
      .catch(() => !cancelled && setRes({ status: "error", rows: [] }));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-brand-blue">
            <Inbox size={28} aria-hidden="true" /> {t("mineTitle")}
          </h1>
          <p className="mt-1 text-gray-600">{t("mineIntro")}</p>
        </div>
        <Link to="/doctors/ask" className="btn-primary">
          <MessageCircleQuestion size={18} aria-hidden="true" /> {t("askCta")}
        </Link>
      </div>

      {res.status === "loading" ? (
        <Spinner />
      ) : res.status === "error" ? (
        <p className="mt-6 text-sm text-red-600">{t("mineError")}</p>
      ) : res.rows.length === 0 ? (
        <div className="card mt-6 p-8 text-center">
          <Stethoscope size={40} className="mx-auto text-brand-red" aria-hidden="true" />
          <p className="mt-3 text-gray-600">{t("mineEmpty")}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link to="/doctors/ask" className="btn-primary">
              {t("askCta")}
            </Link>
            <Link to="/doctors" className="btn-secondary">
              {t("pageTitle")}
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {res.rows.map((c) => (
            <li key={c.id}>
              <Link
                to={`/consultations/${c.id}`}
                className="card flex items-center gap-4 p-5 transition hover:border-brand-blue/30 hover:shadow-md"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2.5 py-0.5 font-semibold ${CONSULTATION_STATUS_CHIP[c.status] || ""}`}>
                      {t(`status_${c.status}`)}
                    </span>
                    {c.unreadForMe && (
                      <span className="rounded-full bg-brand-red px-2.5 py-0.5 font-semibold text-white">{t("newReply")}</span>
                    )}
                    <span className="text-gray-400">{t(`category_${c.category}`)}</span>
                  </div>
                  <h2 className="mt-2 truncate font-semibold text-gray-800">{c.subject}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                    {c.doctor ? (
                      <span className="flex items-center gap-1.5">
                        <DoctorAvatar person={c.doctor} size="h-6 w-6 text-[10px]" />
                        <span className="font-medium text-gray-700">{c.doctor.name}</span>
                        <span>· {t(`specialty_${c.doctor.specialty}`)}</span>
                      </span>
                    ) : (
                      <span>{t("noDoctorYet")}</span>
                    )}
                    {c.messageCount > 0 && <span>{t("replies", { count: c.messageCount })}</span>}
                    <span>{t("lastActivity", { date: date(c.lastActivityAt || c.createdAt) })}</span>
                  </div>
                </div>
                <ChevronRight size={20} className="shrink-0 text-gray-300" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
