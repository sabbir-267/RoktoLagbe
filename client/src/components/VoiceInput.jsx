import { useEffect, useState } from "react";
import { Mic, Square, MicOff, Loader2 } from "lucide-react";
import useSpeechRecognition, { voiceBlocker } from "../hooks/useSpeechRecognition";
import useT from "../i18n/useT";
import voice from "../i18n/voice";

const LANGS = [
  { code: "bn-BD", label: "বাংলা" },
  { code: "en-US", label: "English" },
];

// Mic button that records speech and hands the text back when the person stops.
// onText(text) receives the full transcript once listening stops.
export default function VoiceInput({ onText, disabled }) {
  const { t } = useT(voice);
  const [lang, setLang] = useState("bn-BD");
  const [blocked, setBlocked] = useState(undefined); // undefined while checking, null when fine
  const { listening, starting, finalText, interim, error, start, stop } = useSpeechRecognition({
    lang,
    onFinish: (text) => {
      if (text.trim()) onText(text.trim());
    },
  });

  useEffect(() => {
    let cancelled = false;
    voiceBlocker().then((reason) => !cancelled && setBlocked(reason));
    return () => {
      cancelled = true;
    };
  }, []);

  if (blocked === undefined) return null;
  if (blocked) {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-white px-3 py-2 text-xs text-gray-600 ring-1 ring-gray-200">
        <MicOff size={14} className="mt-0.5 shrink-0 text-gray-400" />
        {t(`block_${blocked}`, { origin: window.location.origin })}
      </p>
    );
  }

  const live = `${finalText} ${interim}`.trim();
  const busy = listening || starting;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={busy ? stop : start}
          disabled={disabled && !busy}
          aria-pressed={listening}
          className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
            busy
              ? "bg-brand-red text-white hover:bg-brand-red-dark"
              : "border border-brand-red/30 bg-white text-brand-red hover:bg-red-50"
          }`}
        >
          {listening && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-brand-red/30" />}
          {starting ? (
            <Loader2 size={16} className="relative animate-spin" />
          ) : listening ? (
            <Square size={14} className="relative fill-current" />
          ) : (
            <Mic size={16} />
          )}
          <span className="relative">
            {starting ? t("starting") : listening ? t("stop") : t("speak")}
          </span>
        </button>

        <div
          className="inline-flex rounded-full border border-gray-200 bg-white p-0.5 text-xs font-semibold"
          role="radiogroup"
          aria-label={t("voiceLanguage")}
        >
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              role="radio"
              aria-checked={lang === l.code}
              disabled={busy}
              onClick={() => setLang(l.code)}
              className={`rounded-full px-3 py-1 transition disabled:cursor-not-allowed ${
                lang === l.code ? "bg-brand-blue text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {starting && (
        <p className="mt-2 text-sm text-gray-500" aria-live="polite">
          {t("allowMic")}
        </p>
      )}
      {listening && (
        <p className="mt-2 text-sm text-gray-600" aria-live="polite">
          <span className="font-semibold text-brand-red">{t("listening")}</span>{" "}
          {live ? (
            <span>{live}</span>
          ) : (
            <span className="text-gray-400">
              {t("sayHint")}
            </span>
          )}
        </p>
      )}
      {error && !busy && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {voice.en[`err_${error}`] ? t(`err_${error}`) : t("err_other", { code: error })}
        </p>
      )}
    </div>
  );
}
