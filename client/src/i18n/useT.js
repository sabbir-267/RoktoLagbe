import { useCallback, useMemo } from "react";
import { useLanguage, LANGUAGES } from "./LanguageContext";
import common from "./common";
import { DISTRICTS_BN, DIVISIONS_BN } from "./places";

// Translation hook. Each page keeps its own dictionary next to it:
//
//   // src/i18n/home.js
//   export default {
//     en: { title: "Find blood fast", donors_one: "{count} donor", donors_other: "{count} donors" },
//     bn: { title: "দ্রুত রক্ত খুঁজুন", donors_other: "{count} জন ডোনার" },
//   };
//
//   const { t, n, date } = useT(home);
//   t("title")                 → text in the current language (falls back to English, then the key)
//   t("donors", { count: 3 })  → uses donors_one / donors_other, and {count} is filled in
//   t("common:save")           → a shared word from src/i18n/common.js
//   n(1234)                    → "1,234" or "১,২৩৪"
//   date(value, options)       → a date in the current language
//   dist("Dhaka")              → "ঢাকা" in Bangla (district or division name; unknown names pass through)
export default function useT(dict = {}) {
  const { lang } = useLanguage();
  const locale = LANGUAGES.find((l) => l.code === lang)?.locale || "en-GB";

  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const n = useCallback((value) => (Number.isFinite(Number(value)) ? nf.format(Number(value)) : String(value ?? "")), [nf]);

  const t = useCallback(
    (key, vars) => {
      let source = dict;
      let k = key;
      if (key.startsWith("common:")) {
        source = common;
        k = key.slice(7);
      }
      const table = source[lang] || {};
      const fallback = source.en || {};
      const pick = (name) => table[name] ?? fallback[name];

      let text;
      if (vars && typeof vars.count === "number") {
        text = (vars.count === 1 ? pick(`${k}_one`) : undefined) ?? pick(`${k}_other`) ?? pick(k);
      } else {
        text = pick(k);
      }
      if (text === undefined) {
        if (import.meta.env.DEV) console.warn(`[i18n] missing "${key}" (${lang})`);
        return key;
      }
      if (!vars) return text;
      return text.replace(/\{(\w+)\}/g, (m, name) => {
        if (vars[name] === undefined) return m;
        return typeof vars[name] === "number" ? n(vars[name]) : String(vars[name]);
      });
    },
    [dict, lang, n]
  );

  const date = useCallback(
    (value, options = { day: "numeric", month: "short", year: "numeric" }) =>
      value ? new Date(value).toLocaleDateString(locale, options) : "",
    [locale]
  );

  const dist = useCallback(
    (name) => (lang === "bn" && name ? DISTRICTS_BN[name] || DIVISIONS_BN[name] || name : name),
    [lang]
  );

  return { t, n, date, dist, lang, locale };
}
