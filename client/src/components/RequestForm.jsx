import { useState } from "react";
import toast from "react-hot-toast";
import { Sparkles, AlertTriangle, Info } from "lucide-react";
import { parseRequestText, createRequest } from "../services/requests";
import { parseError } from "../utils/errors";
import VoiceInput from "./VoiceInput";
import { PHONE_RE, cleanPhone } from "../utils/phone";
import { COMPONENTS, localToISO, neededByLimits, toDateTimeLocal } from "../utils/requests";
import { BLOOD_GROUPS, DIVISIONS, DIVISION_NAMES } from "../data/bangladesh";
import FormField from "./FormField";
import SelectField from "./SelectField";
import useT from "../i18n/useT";
import requests from "../i18n/requests";

const EMPTY = {
  patientName: "",
  bloodGroup: "",
  component: "whole_blood",
  unitsNeeded: "1",
  hospital: "",
  district: "",
  neededBy: "",
  contactPhone: "",
  notes: "",
};

// Field names the parser can report as missing; shown as t(`field_${name}`)
const FIELD_NAMES = ["patientName", "bloodGroup", "unitsNeeded", "hospital", "district", "neededBy"];

function validate(f, t) {
  const e = {};
  const name = f.patientName.trim();
  const hospital = f.hospital.trim();
  const units = Number(f.unitsNeeded);
  const phone = cleanPhone(f.contactPhone);
  const { min, max } = neededByLimits();

  if (name.length < 2 || name.length > 80) e.patientName = t("errName");
  if (!f.bloodGroup) e.bloodGroup = t("errGroup");
  if (!Number.isInteger(units) || units < 1 || units > 20) e.unitsNeeded = t("errUnits");
  if (hospital.length < 2 || hospital.length > 120) e.hospital = t("errHospital");
  if (!f.district) e.district = t("errDistrict");
  if (!f.neededBy) e.neededBy = t("errNeededBy");
  else if (f.neededBy <= min) e.neededBy = t("errPast");
  else if (f.neededBy > max) e.neededBy = t("errTooFar");
  if (phone && !PHONE_RE.test(phone)) e.contactPhone = t("errPhone");
  if (f.notes.length > 500) e.notes = t("errNotes");
  return e;
}

export default function RequestForm({ defaultPhone, onCreated }) {
  const { t, n, dist } = useT(requests);
  const [form, setForm] = useState({ ...EMPTY, contactPhone: defaultPhone || "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // AI helper state
  const [rawText, setRawText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);
  const [aiNote, setAiNote] = useState(null); // { assumptions, warnings, missing } | { notRequest: true }

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const onChange = (e) => {
    set({ [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors((x) => ({ ...x, [e.target.name]: undefined }));
  };

  // text is passed in when it comes from voice, because rawText state isn't updated yet
  async function fillFromMessage(fromVoice) {
    const text = (typeof fromVoice === "string" ? fromVoice : rawText).trim();
    if (text.length < 10) {
      toast.error(
        typeof fromVoice === "string" ? t("tooShortVoice") : t("tooShortText")
      );
      return;
    }
    setParsing(true);
    setAiNote(null);
    try {
      const data = await parseRequestText(text);
      if (!data.isBloodRequest) {
        setAiNote({ notRequest: true });
        return;
      }
      const f = data.fields || {};
      const patch = {};
      for (const k of ["patientName", "bloodGroup", "component", "hospital", "district", "contactPhone", "notes"]) {
        if (f[k]) patch[k] = f[k];
      }
      if (f.unitsNeeded) patch.unitsNeeded = String(f.unitsNeeded);
      if (f.neededBy) patch.neededBy = toDateTimeLocal(f.neededBy);
      set(patch);
      setErrors({});
      setAiUsed(true);
      setAiNote({
        engine: data.engine || "ai",
        assumptions: data.assumptions || [],
        warnings: data.warnings || [],
        missing: data.missing || [],
      });
      toast.success(
        data.engine === "rules" ? t("filledRules") : t("filledAi")
      );
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setParsing(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validate(form, t);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error(t("fixFields"));
      return;
    }

    const payload = {
      patientName: form.patientName.trim(),
      bloodGroup: form.bloodGroup,
      component: form.component,
      unitsNeeded: Number(form.unitsNeeded),
      hospital: form.hospital.trim(),
      district: form.district,
      neededBy: localToISO(form.neededBy),
    };
    if (form.contactPhone.trim()) payload.contactPhone = cleanPhone(form.contactPhone);
    if (form.notes.trim()) payload.notes = form.notes.trim();
    if (aiUsed && rawText.trim()) {
      payload.rawText = rawText.trim();
      payload.parsedFromText = true;
    }

    setSubmitting(true);
    try {
      const { request, autoNotify } = await createRequest(payload);
      const alerted = autoNotify?.notified || 0;
      toast.success(alerted ? t("liveAlerted", { count: alerted }) : t("live"), { duration: 6000 });
      onCreated(request);
    } catch (err) {
      const { message, fields } = parseError(err);
      if (Object.keys(fields).length) setErrors(fields);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const { min, max } = neededByLimits();

  return (
    <div className="space-y-6">
      {/* AI helper */}
      <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-brand-blue">
          <Sparkles size={18} />
          {t("aiTitle")}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {t("aiText")}
        </p>
        <div className="mt-3">
          <VoiceInput
            disabled={parsing}
            onText={(spoken) => {
              const text = spoken.slice(0, 1000);
              setRawText(text);
              fillFromMessage(text);
            }}
          />
        </div>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder={t("aiPlaceholder")}
          className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-200"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-gray-400">{n(rawText.length)}/{n(1000)}</span>
          <button
            type="button"
            onClick={() => fillFromMessage()}
            disabled={parsing}
            className="flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-blue-dark disabled:opacity-60"
          >
            <Sparkles size={16} />
            {parsing ? t("reading") : t("fillFromMessage")}
          </button>
        </div>

        {aiNote?.notRequest && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            {t("notRequest")}
          </p>
        )}
        {aiNote && !aiNote.notRequest && (
          <div className="mt-3 space-y-2 text-sm">
            {aiNote.engine === "rules" && (
              <p className="flex items-start gap-2 rounded-lg bg-white px-3 py-2 text-gray-600 ring-1 ring-blue-100">
                <Info size={16} className="mt-0.5 shrink-0 text-brand-blue" />
                {t("rulesNote")}
              </p>
            )}
            {aiNote.missing.length > 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>
                  {t("missing", {
                    fields: aiNote.missing.map((m) => (FIELD_NAMES.includes(m) ? t(`field_${m}`) : m)).join(", "),
                  })}
                </span>
              </p>
            )}
            {[...aiNote.warnings, ...aiNote.assumptions].map((note) => (
              <p key={note} className="flex items-start gap-2 rounded-lg bg-white px-3 py-2 text-gray-600">
                <Info size={16} className="mt-0.5 shrink-0 text-brand-blue" />
                {note}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-medium text-gray-700">{t("groupNeeded")}</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t("groupNeeded")}>
            {BLOOD_GROUPS.map((g) => {
              const active = form.bloodGroup === g;
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    set({ bloodGroup: g });
                    setErrors((x) => ({ ...x, bloodGroup: undefined }));
                  }}
                  className={`rounded-lg border-2 px-4 py-2 text-sm font-bold transition ${
                    active
                      ? "border-brand-red bg-brand-red text-white"
                      : "border-red-100 text-brand-red hover:border-brand-red"
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
          {errors.bloodGroup && <p className="mt-1 text-xs text-red-600">{errors.bloodGroup}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("patientName")} name="patientName" value={form.patientName} onChange={onChange} error={errors.patientName} />
          <FormField
            label={t("unitsBags")}
            name="unitsNeeded"
            type="number"
            min={1}
            max={20}
            value={form.unitsNeeded}
            onChange={onChange}
            error={errors.unitsNeeded}
          />
          <SelectField label={t("whatNeeded")} name="component" value={form.component} onChange={onChange}>
            {COMPONENTS.map((c) => (
              <option key={c.value} value={c.value}>
                {t(`component_${c.value}`)}
              </option>
            ))}
          </SelectField>
          <FormField
            label={t("neededBy")}
            name="neededBy"
            type="datetime-local"
            min={min}
            max={max}
            value={form.neededBy}
            onChange={onChange}
            error={errors.neededBy}
            hint={t("neededByHint")}
          />
          <FormField label={t("hospital")} name="hospital" value={form.hospital} onChange={onChange} error={errors.hospital} />
          <SelectField label={t("common:district")} name="district" value={form.district} onChange={onChange} error={errors.district}>
            <option value="">{t("selectDistrict")}</option>
            {DIVISION_NAMES.map((div) => (
              <optgroup key={div} label={div}>
                {DIVISIONS[div].map((d) => (
                  <option key={d} value={d}>
                    {dist(d)}
                  </option>
                ))}
              </optgroup>
            ))}
          </SelectField>
          <FormField
            label={t("contactPhone")}
            name="contactPhone"
            type="tel"
            placeholder="01711111111"
            value={form.contactPhone}
            onChange={onChange}
            error={errors.contactPhone}
            hint={t("contactPhoneHint")}
          />
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">{t("notes")}</span>
          <textarea
            name="notes"
            value={form.notes}
            onChange={onChange}
            rows={3}
            maxLength={500}
            placeholder={t("notesPlaceholder")}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-200"
          />
          {errors.notes && <span className="mt-1 block text-xs text-red-600">{errors.notes}</span>}
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-red py-3 font-semibold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
        >
          {submitting ? t("posting") : t("postBloodRequest")}
        </button>
        <p className="text-center text-xs text-gray-400">
          {t("formFooter")}
        </p>
      </form>
    </div>
  );
}
