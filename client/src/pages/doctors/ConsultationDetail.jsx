import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Clock,
  Stethoscope,
  CheckCircle2,
  Lock,
  SearchX,
  Send,
  UserRound,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import useT from "../../i18n/useT";
import dict from "../../i18n/doctors";
import usePageTitle from "../../hooks/usePageTitle";
import { parseError } from "../../utils/errors";
import {
  getConsultation,
  claimConsultation,
  releaseConsultation,
  replyToConsultation,
  closeConsultation,
  setConsultationShare,
  adminSetConsultationVisibility,
  CONSULTATION_STATUS_CHIP,
  MESSAGE_MAX,
} from "../../services/consultations";
import Spinner from "../../components/Spinner";
import { DoctorAvatar } from "./DoctorsHome";

const POLL_MS = 20000;
const sameId = (a, b) => a != null && b != null && String(a) === String(b);

const BANNER = {
  open: { icon: Clock, cls: "border-amber-200 bg-amber-50 text-amber-900" },
  claimed: { icon: Stethoscope, cls: "border-blue-200 bg-blue-50 text-brand-blue" },
  answered: { icon: CheckCircle2, cls: "border-green-200 bg-green-50 text-green-800" },
  closed: { icon: Lock, cls: "border-gray-200 bg-gray-50 text-gray-700" },
};

export default function ConsultationDetail() {
  const { id } = useParams();
  const { t, date, locale } = useT(dict);
  const { user } = useAuth();
  const [res, setRes] = useState({ status: "loading", c: null });
  const [busy, setBusy] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const c = res.c;
  usePageTitle(c?.subject || t("pageTitle"));

  const load = useCallback(
    async (silent = false) => {
      try {
        const data = await getConsultation(id);
        setRes({ status: "ready", c: data.consultation });
      } catch (err) {
        const code = err.response?.status;
        if (code === 404 || code === 400 || code === 403) setRes({ status: "notfound", c: null });
        else if (!silent) setRes({ status: "error", c: null });
      }
    },
    [id]
  );

  useEffect(() => {
    let cancelled = false;
    getConsultation(id)
      .then((data) => !cancelled && setRes({ status: "ready", c: data.consultation }))
      .catch((err) => {
        if (cancelled) return;
        const code = err.response?.status;
        setRes({ status: code === 404 || code === 400 || code === 403 ? "notfound" : "error", c: null });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Poll for new replies while the tab is visible
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load(true);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (res.status === "loading") return <Spinner />;
  if (res.status === "notfound") return <NotFoundCard t={t} />;
  if (res.status === "error") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="card p-8 text-center">
          <p className="text-gray-600">{t("loadError")}</p>
          <button type="button" onClick={() => load()} className="btn-secondary mt-4">
            {t("common:tryAgain")}
          </button>
        </div>
      </div>
    );
  }

  // Who is looking at this thread
  const isAssignedDoctor = !!c.doctor && sameId(c.doctor.userId, user?.id);
  // The API sends `asker` only to the assigned doctor and admins, and canClaim only to other doctors
  const isAsker = !isAssignedDoctor && !c.asker && !c.canClaim;
  const isAdmin = user?.role === "admin";
  const backTo = isAsker
    ? { to: "/consultations", label: t("backToMine") }
    : isAdmin
      ? { to: "/admin?tab=doctors", label: t("backToAdmin") }
      : { to: "/doctor-portal", label: t("backToPortal") };

  async function run(key, action, successText) {
    setBusy(key);
    try {
      const data = await action();
      if (data?.consultation) setRes({ status: "ready", c: data.consultation });
      if (successText) toast.success(successText);
      await load(true);
      return true;
    } catch (err) {
      toast.error(parseError(err).message);
      await load(true);
      return false;
    } finally {
      setBusy("");
    }
  }

  const banner = BANNER[c.status] || BANNER.open;
  const BannerIcon = banner.icon;
  const doctorLabel = c.doctor
    ? [c.doctor.name, c.doctor.specialty && t(`specialty_${c.doctor.specialty}`)].filter(Boolean).join(" · ")
    : t("doctorFallback");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link to={backTo.to} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline">
        <ArrowLeft size={16} aria-hidden="true" /> {backTo.label}
      </Link>

      <div className={`mt-4 flex items-start gap-3 rounded-2xl border p-4 text-sm ${banner.cls}`} role="status">
        <BannerIcon size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <div className="font-semibold">{t(`status_${c.status}`)}</div>
          <p className="mt-0.5">{t(`banner_${c.status}`)}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
        <div className="space-y-6">
          {/* The question */}
          <article className="card p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2.5 py-0.5 font-semibold ${CONSULTATION_STATUS_CHIP[c.status] || ""}`}>
                {t(`status_${c.status}`)}
              </span>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-semibold text-brand-blue">
                {t(`category_${c.category}`)}
              </span>
              <span className="text-gray-400">{t("askedOn", { date: date(c.createdAt) })}</span>
            </div>
            <h1 className="mt-3 break-words text-2xl font-bold text-gray-800">{c.subject}</h1>
            {c.asker?.name && <p className="mt-1 text-sm text-gray-500">{t("askedBy", { name: c.asker.name })}</p>}
            {(c.patientAge != null || c.patientSex) && (
              <p className="mt-2 text-sm text-gray-600">
                <span className="font-medium">{t("patient")}:</span>{" "}
                {[c.patientAge != null && t("years", { age: c.patientAge }), c.patientSex && t(`sex_${c.patientSex}`)]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
            <p className="mt-4 whitespace-pre-wrap break-words text-gray-700">{c.question}</p>
          </article>

          {/* The conversation */}
          <section className="card p-4 sm:p-6" aria-labelledby="thread-title">
            <h2 id="thread-title" className="text-lg font-bold text-brand-blue">
              {t("thread")}
            </h2>
            {(c.messages || []).length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">{t("noReplies")}</p>
            ) : (
              <ol className="mt-4 space-y-4">
                {c.messages.map((m) => {
                  const fromDoctor = m.from === "doctor";
                  const mine = (isAsker && !fromDoctor) || (isAssignedDoctor && fromDoctor);
                  const right = mine || (!isAsker && !isAssignedDoctor && fromDoctor);
                  const who = mine ? t("you") : fromDoctor ? doctorLabel : c.asker?.name || t("asker");
                  return (
                    <li key={m.id || m.createdAt} className={`flex gap-2 ${right ? "flex-row-reverse" : ""}`}>
                      {fromDoctor ? (
                        <DoctorAvatar person={c.doctor} size="h-8 w-8 text-xs" />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500" aria-hidden="true">
                          <UserRound size={16} />
                        </span>
                      )}
                      <div className={`flex max-w-[85%] flex-col sm:max-w-[75%] ${right ? "items-end" : "items-start"}`}>
                        <span className={`mb-1 flex items-center gap-1 text-xs font-semibold ${fromDoctor ? "text-brand-blue" : "text-gray-500"}`}>
                          {fromDoctor && <Stethoscope size={12} aria-hidden="true" />}
                          {who}
                        </span>
                        <div
                          className={`rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                            fromDoctor
                              ? `bg-blue-50 text-gray-800 ring-1 ring-blue-100 ${right ? "rounded-tr-md" : "rounded-tl-md"}`
                              : mine
                                ? "rounded-tr-md bg-brand-red text-white"
                                : `bg-white text-gray-800 ring-1 ring-gray-100 ${right ? "rounded-tr-md" : "rounded-tl-md"}`
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.text}</p>
                        </div>
                        <time dateTime={m.createdAt} className="mt-1 text-[11px] text-gray-400">
                          {new Date(m.createdAt).toLocaleString(locale, {
                            day: "numeric",
                            month: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            {c.canReply && (
              <ReplyBox
                key={c.id}
                t={t}
                isDoctor={isAssignedDoctor}
                busy={busy === "reply"}
                onSend={(text) => run("reply", () => replyToConsultation(c.id, text), t("replySent"))}
              />
            )}
            {c.status !== "closed" && <p className="mt-3 text-xs text-gray-400">{t("autoRefresh")}</p>}
          </section>
        </div>

        {/* Side panel: actions */}
        <aside className="space-y-4">
          {c.doctor && (
            <div className="card p-5">
              <div className="flex items-center gap-3">
                <DoctorAvatar person={c.doctor} />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-gray-800">{c.doctor.name}</div>
                  <div className="text-sm text-brand-red">{t(`specialty_${c.doctor.specialty}`)}</div>
                  {c.doctor.hospital && <div className="text-xs text-gray-500">{c.doctor.hospital}</div>}
                </div>
              </div>
            </div>
          )}

          {(c.canClaim || c.canRelease || c.canClose || isAsker || (isAdmin && c.shareAnonymously)) && (
            <div className="card space-y-3 p-5">
              {c.canClaim && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => run("claim", () => claimConsultation(c.id), t("claimedToast"))}
                  className="btn-primary w-full"
                >
                  <Stethoscope size={18} aria-hidden="true" /> {t("claimBtn")}
                </button>
              )}
              {c.canRelease && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => run("release", () => releaseConsultation(c.id), t("releasedToast"))}
                  className="btn-secondary w-full"
                >
                  {t("releaseBtn")}
                </button>
              )}

              {isAsker && (
                <ShareSwitch
                  t={t}
                  checked={!!c.shareAnonymously}
                  disabled={!!busy}
                  onChange={(next) =>
                    run("share", () => setConsultationShare(c.id, next), next ? t("shareOnToast") : t("shareOffToast"))
                  }
                />
              )}
              {c.shareAnonymously && c.hiddenFromPublic && (isAsker || isAdmin) && (
                <p className="text-xs text-gray-500">{t("hiddenByAdmin")}</p>
              )}
              {isAdmin && c.shareAnonymously && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() =>
                    run("visibility", () => adminSetConsultationVisibility(c.id, !c.hiddenFromPublic), t("adminVisibilityToast"))
                  }
                  className="btn-secondary w-full"
                >
                  {c.hiddenFromPublic ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
                  {c.hiddenFromPublic ? t("adminShow") : t("adminHide")}
                </button>
              )}

              {c.canClose &&
                (confirmClose ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm" role="alert">
                    <p className="text-brand-red-dark">{t("closeConfirm")}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={async () => {
                          await run("close", () => closeConsultation(c.id), t("closedToast"));
                          setConfirmClose(false);
                        }}
                        className="btn-primary px-4 py-2"
                      >
                        {t("closeYes")}
                      </button>
                      <button type="button" onClick={() => setConfirmClose(false)} className="btn-secondary px-4 py-2">
                        {t("common:cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => setConfirmClose(true)}
                    className="btn-secondary w-full text-brand-red"
                  >
                    <Lock size={16} aria-hidden="true" /> {t("closeBtn")}
                  </button>
                ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ReplyBox({ t, isDoctor, busy, onSend }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const ref = useRef(null);

  async function send() {
    const value = text.trim();
    if (!value) {
      setError(t("errReplyEmpty"));
      ref.current?.focus();
      return;
    }
    if (busy) return;
    const ok = await onSend(value);
    if (ok) setText("");
  }

  return (
    <form
      className="mt-6 border-t border-gray-100 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label className="block">
        <span className="text-sm font-medium text-gray-700">{t("replyLabel")}</span>
        <textarea
          ref={ref}
          rows={4}
          value={text}
          maxLength={MESSAGE_MAX}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={isDoctor ? t("replyPlaceholderDoctor") : t("replyPlaceholderAsker")}
          aria-invalid={!!error}
          aria-describedby="reply-hint"
          className={`mt-1 w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 ${
            error ? "border-red-400 focus:ring-red-200" : "border-gray-300 focus:border-brand-blue focus:ring-blue-200"
          }`}
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <span id="reply-hint" className="text-xs">
          {error ? (
            <span className="text-red-600">{error}</span>
          ) : (
            <span className="text-gray-400">
              {t("sendHint")} · {t("chars", { used: text.length, max: MESSAGE_MAX })}
            </span>
          )}
        </span>
        <button type="submit" disabled={busy} className="btn-primary">
          <Send size={16} aria-hidden="true" /> {busy ? t("sending") : t("send")}
        </button>
      </div>
    </form>
  );
}

function ShareSwitch({ t, checked, disabled, onChange }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <span id="share-switch-label" className="text-sm font-semibold text-gray-800">
          {t("shareToggle")}
        </span>
        <p className="mt-1 text-xs text-gray-500">{t("shareHint")}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby="share-switch-label"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
          checked ? "bg-brand-blue" : "bg-gray-300"
        }`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

function NotFoundCard({ t }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="card p-8 text-center">
        <SearchX size={40} className="mx-auto text-gray-400" aria-hidden="true" />
        <h1 className="mt-3 text-xl font-bold text-gray-800">{t("notFoundTitle")}</h1>
        <p className="mt-2 text-sm text-gray-600">{t("notFoundBody")}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link to="/consultations" className="btn-primary">
            {t("backToMine")}
          </Link>
          <Link to="/doctors" className="btn-secondary">
            {t("pageTitle")}
          </Link>
        </div>
      </div>
    </div>
  );
}
