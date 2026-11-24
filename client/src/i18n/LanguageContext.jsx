import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// eslint-disable-next-line react-refresh/only-export-components
export const LANGUAGES = [
  { code: "en", label: "English", short: "EN", locale: "en-GB" },
  { code: "bn", label: "বাংলা", short: "বাং", locale: "bn-BD" },
];
const STORAGE_KEY = "rokto_lang";

const initialLang = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.some((l) => l.code === saved)) return saved;
  } catch {
    /* storage blocked */
  }
  return navigator.language?.toLowerCase().startsWith("bn") ? "bn" : "en";
};

const LanguageContext = createContext({ lang: "en", setLang: () => {} });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Other tabs follow a change made here
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY && LANGUAGES.some((l) => l.code === e.newValue)) setLangState(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLang = useCallback((code) => {
    setLangState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* storage blocked: still switches for this visit */
    }
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useLanguage = () => useContext(LanguageContext);
