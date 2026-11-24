import { BLOOD_GROUPS } from "../data/bangladesh";
import { stockLevel } from "../utils/banks";
import useT from "../i18n/useT";
import dict from "../i18n/widgets";

const LEVEL = {
  ok: { box: "border-green-200 bg-green-50", text: "text-green-700", label: "inStock" },
  low: { box: "border-amber-200 bg-amber-50", text: "text-amber-700", label: "low" },
  out: { box: "border-gray-200 bg-gray-50", text: "text-gray-400", label: "outOfStock" },
};

export default function StockGrid({ stock }) {
  const { t, n } = useT(dict);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {BLOOD_GROUPS.map((g) => {
        const units = stock[g] ?? 0;
        const level = LEVEL[stockLevel(units)];
        return (
          <div key={g} className={`rounded-xl border p-4 text-center ${level.box}`}>
            <div
              className={`text-2xl font-extrabold ${units > 0 ? "text-brand-red" : "text-gray-400"}`}
            >
              {g}
            </div>
            <div className="mt-1 text-lg font-bold text-gray-800">
              {n(units)}{" "}
              <span className="text-xs font-medium text-gray-500">
                {t("unitWord", { count: units })}
              </span>
            </div>
            <div className={`mt-1 text-xs font-semibold ${level.text}`}>{t(level.label)}</div>
          </div>
        );
      })}
    </div>
  );
}