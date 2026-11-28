import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import QRCode from "qrcode";
import { ShieldCheck, Smartphone, KeyRound, Copy, Download } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { startTwoFactorSetup, enableTwoFactor, verifyTwoFactor } from "../services/twoFactor";
import { parseError } from "../utils/errors";
import usePageTitle from "../hooks/usePageTitle";
import useT from "../i18n/useT";
import dict from "../i18n/twoStep";

// Second step of logging in for admin, doctor and bank staff accounts.
// Reached from the login page with state { challenge, twoFactor: "verify" | "setup", from }.
export default function TwoStep() {
  const { t } = useT(dict);
  usePageTitle(t("pageTitle"));
  const location = useLocation();
  const navigate = useNavigate();
  const { saveSession } = useAuth();
  const { challenge, twoFactor: mode, from = "/dashboard", user: who } = location.state || {};

  const [expired, setExpired] = useState(!challenge);
  const [code, setCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState(null); // { secret, qr }
  const [done, setDone] = useState(null); // reply from /2fa/enable, held until the codes are saved
  const [saved, setSaved] = useState(false);

  // Setup: ask the server for a new key and draw its QR code
  useEffect(() => {
    if (mode !== "setup" || !challenge) return;
    let cancelled = false;
    startTwoFactorSetup(challenge)
      .then(async (data) => {
        const qr = await QRCode.toDataURL(data.otpauthUrl, { margin: 1, width: 220 });
        if (!cancelled) setSetup({ secret: data.secret, qr });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 401) setExpired(true);
        else toast.error(parseError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, challenge]);

  function finish(data) {
    saveSession(data);
    toast.success(t("welcome"));
    navigate(data.user?.needsPhone ? "/add-phone" : from, { replace: true, state: { from } });
  }

  async function submit(e) {
    e.preventDefault();
    const value = code.trim();
    if (!useBackup && !/^\d{6}$/.test(value.replace(/\s+/g, ""))) return toast.error(t("enterCode"));
    if (useBackup && value.length < 6) return toast.error(t("enterBackup"));
    setBusy(true);
    try {
      if (mode === "setup") {
        setDone(await enableTwoFactor(challenge, value));
      } else {
        finish(await verifyTwoFactor(challenge, value));
      }
    } catch (err) {
      if (err.response?.status === 401) setExpired(true);
      else toast.error(parseError(err).message);
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text, okKey) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t(okKey));
    } catch {
      /* clipboard blocked: the text is on screen to copy by hand */
    }
  }

  function download(codes) {
    const blob = new Blob([`RoktoLagbe backup codes\n\n${codes.join("\n")}\n\nEach code works once.\n`], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "roktolagbe-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const card = "w-full rounded-2xl bg-white p-8 shadow-lg";

  if (expired) {
    return (
      <div className="mx-auto flex max-w-md px-4 py-12">
        <div className={`${card} text-center`}>
          <ShieldCheck className="mx-auto text-brand-blue" size={40} />
          <p className="mt-4 text-gray-700">{t("expired")}</p>
          <Link to="/login" className="btn-primary mt-6 inline-flex">
            {t("backToLogin")}
          </Link>
        </div>
      </div>
    );
  }

  // Setup finished: show the backup codes once before entering the site
  if (done) {
    const codes = done.backupCodes || [];
    return (
      <div className="mx-auto flex max-w-lg px-4 py-12">
        <div className={card}>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-brand-blue">
            <KeyRound size={24} /> {t("backupTitle")}
          </h1>
          <p className="mt-2 text-sm text-gray-600">{t("backupText")}</p>
          <ol className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-4 font-mono text-base tracking-wider text-gray-900">
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => copy(codes.join("\n"), "codesCopied")} className="btn-secondary">
              <Copy size={16} /> {t("copyCodes")}
            </button>
            <button type="button" onClick={() => download(codes)} className="btn-secondary">
              <Download size={16} /> {t("downloadCodes")}
            </button>
          </div>
          <label className="mt-6 flex items-center gap-2 text-sm font-medium text-gray-800">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="h-4 w-4 accent-brand-red" />
            {t("savedCodes")}
          </label>
          <button type="button" disabled={!saved} onClick={() => finish(done)} className="btn-primary mt-4 w-full disabled:opacity-50">
            {t("continue")}
          </button>
        </div>
      </div>
    );
  }

  const codeField = (
    <form onSubmit={submit} className="mt-5">
      <label className="block text-sm font-medium text-gray-700" htmlFor="code">
        {useBackup ? t("backupLabel") : t("codeLabel")}
      </label>
      <input
        id="code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode={useBackup ? "text" : "numeric"}
        autoComplete="one-time-code"
        autoFocus
        maxLength={useBackup ? 20 : 7}
        placeholder={useBackup ? "xxxx-xxxx" : "123456"}
        className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] outline-none focus:border-brand-blue focus:ring-2 focus:ring-blue-200"
      />
      <button type="submit" disabled={busy} className="btn-primary mt-4 w-full disabled:opacity-60">
        {busy ? t("verifying") : mode === "setup" ? t("finishSetup") : t("verify")}
      </button>
    </form>
  );

  if (mode === "setup") {
    return (
      <div className="mx-auto flex max-w-lg px-4 py-12">
        <div className={card}>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-brand-blue">
            <ShieldCheck size={24} /> {t("setupTitle")}
          </h1>
          {who?.name && <p className="mt-1 text-sm font-medium text-gray-700">{who.name}</p>}
          <p className="mt-2 text-sm text-gray-600">{t("setupWhy")}</p>

          <h2 className="mt-6 flex items-center gap-2 font-semibold text-gray-900">
            <Smartphone size={18} /> {t("step1")}
          </h2>
          <p className="mt-1 text-sm text-gray-600">{t("step1Text")}</p>

          <h2 className="mt-5 font-semibold text-gray-900">{t("step2")}</h2>
          <p className="mt-1 text-sm text-gray-600">{t("step2Text")}</p>
          {!setup ? (
            <p className="mt-3 text-sm text-gray-500">{t("loadingSetup")}</p>
          ) : (
            <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <img src={setup.qr} alt="" width={180} height={180} className="rounded-lg border border-gray-200" />
              <div className="min-w-0 text-sm text-gray-600">
                <p>{t("cantScan")}</p>
                <p className="mt-1 break-all rounded bg-gray-50 p-2 font-mono text-sm text-gray-900">
                  {setup.secret.match(/.{1,4}/g).join(" ")}
                </p>
                <button type="button" onClick={() => copy(setup.secret, "keyCopied")} className="mt-2 text-sm font-semibold text-brand-blue hover:underline">
                  {t("copyKey")}
                </button>
              </div>
            </div>
          )}

          <h2 className="mt-6 font-semibold text-gray-900">{t("step3")}</h2>
          {codeField}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md px-4 py-12">
      <div className={card}>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-brand-blue">
          <ShieldCheck size={24} /> {t("verifyTitle")}
        </h1>
        <p className="mt-2 text-sm text-gray-600">{useBackup ? t("enterBackup") : t("verifyText")}</p>
        {codeField}
        <button
          type="button"
          onClick={() => {
            setUseBackup((b) => !b);
            setCode("");
          }}
          className="mt-4 text-sm font-semibold text-brand-blue hover:underline"
        >
          {useBackup ? t("useApp") : t("useBackup")}
        </button>
        <p className="mt-4 text-xs text-gray-500">{t("lostPhone")}</p>
      </div>
    </div>
  );
}
