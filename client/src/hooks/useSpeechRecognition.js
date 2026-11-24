import { useCallback, useEffect, useRef, useState } from "react";

const Recognition =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

export const speechSupported = Boolean(Recognition);

// Reasons voice input can't work at all here, checked before showing the mic button.
// Returns a code ("unsupported" | "insecure" | "brave") or null; the UI turns it into text.
export async function voiceBlocker() {
  if (!Recognition) return "unsupported";
  if (!window.isSecureContext) return "insecure";
  // Brave exposes the API, but its speech service always fails with a "network" error
  try {
    if (navigator.brave && (await navigator.brave.isBrave())) return "brave";
  } catch {
    /* not Brave */
  }
  return null;
}

// Turns speech into text with the browser's built-in recognition.
// onFinish(fullText) runs once when listening stops (by the user, silence or an error).
// error is a code: the browser's own (e.g. "not-allowed", "network"), "no-speech" or "start-failed".
export default function useSpeechRecognition({ lang = "bn-BD", onFinish } = {}) {
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState(null);

  const recRef = useRef(null);
  const textRef = useRef("");
  const interimRef = useRef("");
  const errorRef = useRef(null);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  // Stop listening if the component goes away
  useEffect(() => () => recRef.current?.abort(), []);

  const start = useCallback(() => {
    if (!Recognition || recRef.current) return;
    const rec = new Recognition();
    rec.lang = lang;
    rec.continuous = true; // keep listening through short pauses
    rec.interimResults = true; // show words as they are heard
    rec.maxAlternatives = 1;

    textRef.current = "";
    interimRef.current = "";
    errorRef.current = null;
    setFinalText("");
    setInterim("");
    setError(null);

    rec.onstart = () => {
      setStarting(false);
      setListening(true);
    };
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const piece = e.results[i][0].transcript;
        if (e.results[i].isFinal) textRef.current = `${textRef.current} ${piece}`.trim();
        else live += piece;
      }
      interimRef.current = live.trim();
      setFinalText(textRef.current);
      setInterim(interimRef.current);
    };
    rec.onerror = (e) => {
      if (e.error === "aborted") return;
      errorRef.current = e.error;
      setError(e.error);
    };
    rec.onend = () => {
      recRef.current = null;
      setStarting(false);
      setListening(false);
      setInterim("");
      // Some browsers end before marking the last words final; keep them instead of losing them
      const text = `${textRef.current} ${interimRef.current}`.trim();
      if (!text && !errorRef.current) setError("no-speech");
      onFinishRef.current?.(text);
    };

    recRef.current = rec;
    setStarting(true); // waiting for the permission prompt / microphone
    try {
      rec.start();
    } catch {
      recRef.current = null;
      setStarting(false);
      setError("start-failed");
    }
  }, [lang]);

  const stop = useCallback(() => recRef.current?.stop(), []);

  return { listening, starting, finalText, interim, error, start, stop };
}
