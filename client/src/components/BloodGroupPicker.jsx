import { useNavigate } from "react-router-dom";
import useT from "../i18n/useT";
import dict from "../i18n/widgets";

const groups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function BloodGroupPicker() {
  const navigate = useNavigate();
  const { t } = useT(dict);

  return (
    <div className="rounded-2xl bg-white p-6 text-gray-800 shadow-2xl shadow-black/20 ring-1 ring-black/5">
      <h2 className="text-lg font-bold text-gray-900">{t("pickTitle")}</h2>
      <p className="mt-1 text-sm text-gray-500">
        {t("pickText")}
      </p>

      <div className="mt-4 grid grid-cols-4 gap-3">
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            aria-label={t("pickAria", { group: g })}
            onClick={() => navigate(`/donors?bloodGroup=${encodeURIComponent(g)}`)}
            className="rounded-xl border border-red-100 bg-red-50/50 py-3 text-lg font-bold text-brand-red transition hover:-translate-y-0.5 hover:border-brand-red hover:bg-brand-red hover:text-white hover:shadow-md"
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  );
}