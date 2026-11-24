import { ChevronLeft, ChevronRight } from "lucide-react";
import useT from "../i18n/useT";

const dict = {
  en: { pagination: "Pagination", previous: "Previous page", next: "Next page" },
  bn: { pagination: "পাতা নির্বাচন", previous: "আগের পাতা", next: "পরের পাতা" },
};

// Builds [1, "gap-3", 4, 5, 6, "gap-9", 10]
function pageList(current, total) {
  const wanted = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...wanted].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

const btn =
  "flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm font-medium transition";

export default function Pagination({ page, pages, onChange }) {
  const { t } = useT(dict);
  if (pages <= 1) return null;

  return (
    <nav className="mt-8 flex items-center justify-center gap-1" aria-label={t("pagination")}>
      <button
        type="button"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        aria-label={t("previous")}
        className={`${btn} border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40`}
      >
        <ChevronLeft size={18} />
      </button>

      {pageList(page, pages).map((p) =>
        typeof p === "string" ? (
          <span key={p} className="px-1 text-gray-400">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={`${btn} ${
              p === page
                ? "border-brand-red bg-brand-red text-white"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        disabled={page === pages}
        onClick={() => onChange(page + 1)}
        aria-label={t("next")}
        className={`${btn} border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40`}
      >
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}