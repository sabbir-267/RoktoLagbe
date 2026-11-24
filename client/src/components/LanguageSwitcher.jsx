import { Languages } from "lucide-react";
import { useLanguage, LANGUAGES } from "../i18n/LanguageContext";

// Two-button toggle: EN | বাং
export default function LanguageSwitcher({ className = "" }) {
  const { lang, setLang } = useLanguage();
  return (
    <div
      role="radiogroup"
      aria-label="Language / ভাষা"
      className={`inline-flex items-center rounded-full border border-gray-200 bg-white p-0.5 text-xs font-semibold ${className}`}
    >
      <Languages size={14} className="mx-1.5 text-gray-400" aria-hidden />
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          role="radio"
          aria-checked={lang === l.code}
          aria-label={l.label}
          lang={l.code}
          onClick={() => setLang(l.code)}
          className={`rounded-full px-2.5 py-1 transition ${
            lang === l.code ? "bg-brand-blue text-white" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
