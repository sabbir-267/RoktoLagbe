import { Link } from "react-router-dom";
import { Droplet, Search, Home } from "lucide-react";
import useT from "../i18n/useT";
import layout from "../i18n/layout";

export default function NotFound() {
  const { t } = useT(layout);
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-brand-red">
        <Droplet size={30} />
      </div>
      <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-brand-red">{t("notFoundCode")}</p>
      <h1 className="mt-2 text-3xl font-extrabold text-gray-900">{t("notFoundTitle")}</h1>
      <p className="mt-3 text-gray-500">{t("notFoundText")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn-primary">
          <Home size={16} /> {t("backHome")}
        </Link>
        <Link to="/donors" className="btn-secondary">
          <Search size={16} /> {t("findDonors")}
        </Link>
      </div>
    </div>
  );
}
