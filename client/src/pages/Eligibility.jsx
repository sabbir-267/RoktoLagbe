import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, Clock, HeartPulse, Info, RotateCcw } from "lucide-react";
import { BLOOD_GROUPS } from "../data/bangladesh";
import useT from "../i18n/useT";
import dict from "../i18n/eligibility";

// These match the rules the app enforces on donor profiles (age 18–65, 45 kg, 120-day gap)
const basics = ["basicAge", "basicWeight", "basicGap", "basicWell"];

// Each key has a matching "<key>Time" entry with the waiting period
const waits = ["waitTattoo", "waitSurgery", "waitPregnancy", "waitMalaria", "waitDental", "waitAntibiotics", "waitFever"];

const never = ["neverHiv", "neverHeart", "neverCancer", "neverDiabetes", "neverDrugs"];

// Who a donor of each group can give red cells to
const CAN_GIVE = {
  "O-": BLOOD_GROUPS,
  "O+": ["O+", "A+", "B+", "AB+"],
  "A-": ["A-", "A+", "AB-", "AB+"],
  "A+": ["A+", "AB+"],
  "B-": ["B-", "B+", "AB-", "AB+"],
  "B+": ["B+", "AB+"],
  "AB-": ["AB-", "AB+"],
  "AB+": ["AB+"],
};

const QUESTIONS = [
  { id: "age", q: "qAge", pass: true },
  { id: "weight", q: "qWeight", pass: true },
  { id: "gap", q: "qGap", pass: true },
  { id: "well", q: "qWell", pass: true },
  { id: "recent", q: "qRecent", pass: false },
  { id: "chronic", q: "qChronic", pass: false },
];

function SelfCheck() {
  const { t, n } = useT(dict);
  const [answers, setAnswers] = useState({});
  const answered = QUESTIONS.filter((q) => answers[q.id] !== undefined).length;
  const done = answered === QUESTIONS.length;
  const failed = QUESTIONS.filter((q) => answers[q.id] !== undefined && answers[q.id] !== q.pass);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-900">{t("selfCheckTitle")}</h2>
        {answered > 0 && (
          <button
            type="button"
            onClick={() => setAnswers({})}
            className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-800"
          >
            <RotateCcw size={14} /> {t("startOver")}
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-500">{t("selfCheckNote")}</p>

      <ol className="mt-5 space-y-3">
        {QUESTIONS.map((item, i) => {
          const a = answers[item.id];
          return (
            <li key={item.id} className="flex flex-col gap-3 rounded-xl bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-gray-800">
                <span className="mr-2 font-semibold text-gray-400">{n(i + 1)}.</span>
                {t(item.q)}
              </span>
              <div className="flex shrink-0 gap-2" role="group" aria-label={t(item.q)}>
                {[true, false].map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    aria-pressed={a === val}
                    onClick={() => setAnswers((s) => ({ ...s, [item.id]: val }))}
                    className={`w-16 rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                      a === val
                        ? "border-brand-blue bg-brand-blue text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {val ? t("common:yes") : t("common:no")}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ol>

      {done && failed.length === 0 && (
        <div className="mt-5 flex gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <CheckCircle2 className="shrink-0 text-green-600" size={20} />
          <div>
            <p className="font-semibold">{t("passTitle")}</p>
            <p className="mt-1">
              {t("passBefore")}{" "}
              <Link to="/register" className="font-semibold underline">
                {t("passLink")}
              </Link>{" "}
              {t("passAfter")}
            </p>
          </div>
        </div>
      )}
      {failed.length > 0 && (
        <div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Clock className="shrink-0 text-amber-600" size={20} />
          <div>
            <p className="font-semibold">{t("failTitle")}</p>
            <p className="mt-1">
              {t("failText")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Eligibility() {
  const { t } = useT(dict);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-red">{t("eyebrow")}</p>
        <h1 className="mt-1 text-4xl font-extrabold text-gray-900">{t("title")}</h1>
        <p className="mt-3 text-lg leading-relaxed text-gray-600">
          {t("intro")}
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {basics.map((b) => (
          <div key={b} className="card flex gap-4 p-5">
            <CheckCircle2 className="mt-0.5 shrink-0 text-green-600" size={22} />
            <div>
              <h2 className="font-semibold text-gray-900">{t(`${b}Title`)}</h2>
              <p className="mt-1 text-sm text-gray-600">{t(`${b}Text`)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <SelfCheck />
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <section className="card p-6">
          <div className="flex items-center gap-2 text-amber-700">
            <Clock size={20} />
            <h2 className="text-lg font-bold">{t("waitTitle")}</h2>
          </div>
          <dl className="mt-4 divide-y divide-gray-100 text-sm">
            {waits.map((w) => (
              <div key={w} className="flex justify-between gap-4 py-2.5">
                <dt className="text-gray-700">{t(w)}</dt>
                <dd className="text-right font-medium text-gray-900">{t(`${w}Time`)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="card p-6">
          <div className="flex items-center gap-2 text-red-700">
            <XCircle size={20} />
            <h2 className="text-lg font-bold">{t("neverTitle")}</h2>
          </div>
          <ul className="mt-4 space-y-2.5 text-sm text-gray-700">
            {never.map((k) => (
              <li key={k} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                {t(k)}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-10 card p-6">
        <div className="flex items-center gap-2 text-brand-blue">
          <HeartPulse size={20} />
          <h2 className="text-lg font-bold">{t("compatTitle")}</h2>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {t("compatText")}
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[560px] text-center text-sm">
            <thead>
              <tr>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t("compatHeader")}
                </th>
                {BLOOD_GROUPS.map((g) => (
                  <th key={g} className="px-2 py-2 font-bold text-brand-red">
                    {g}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {BLOOD_GROUPS.map((donor) => (
                <tr key={donor}>
                  <th className="px-2 py-2 text-left font-bold text-brand-red">{donor}</th>
                  {BLOOD_GROUPS.map((patient) => {
                    const ok = CAN_GIVE[donor].includes(patient);
                    return (
                      <td key={patient} className="px-2 py-2">
                        {ok ? (
                          <CheckCircle2 size={18} className="mx-auto text-green-600" aria-label={t("compatible")} />
                        ) : (
                          <span className="text-gray-300" aria-label={t("notCompatible")}>
                            –
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-10 flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
        <Info size={20} className="shrink-0 text-brand-blue" />
        <p>
          {t("disclaimer")}
        </p>
      </div>
    </div>
  );
}
