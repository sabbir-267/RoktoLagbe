import { BLOOD_GROUPS } from "../data/bangladesh";
import { stockLevel } from "../utils/banks";

const LEVEL = {
  ok: { box: "border-green-200 bg-green-50", text: "text-green-700", label: "In stock" },
  low: { box: "border-amber-200 bg-amber-50", text: "text-amber-700", label: "Low" },
  out: { box: "border-gray-200 bg-gray-50", text: "text-gray-400", label: "Out of stock" },
};

export default function StockGrid({ stock }) {
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
              {units}{" "}
              <span className="text-xs font-medium text-gray-500">
                unit{units === 1 ? "" : "s"}
              </span>
            </div>
            <div className={`mt-1 text-xs font-semibold ${level.text}`}>{level.label}</div>
          </div>
        );
      })}
    </div>
  );
}