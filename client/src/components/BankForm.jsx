import { useState } from "react";
import { DIVISIONS, DIVISION_NAMES, divisionOfDistrict } from "../data/bangladesh";
import { parseError } from "../utils/errors";
import FormField from "./FormField";
import SelectField from "./SelectField";

const EMPTY = {
  name: "",
  licenseNo: "",
  phone: "",
  email: "",
  division: "",
  district: "",
  address: "",
  openingHours: "",
  is24Hours: false,
};

// Used to register, create and edit a blood bank.
// onSubmit(payload) must return a promise; field errors from the server are shown inline.
export default function BankForm({ initial, onSubmit, submitLabel = "Save", busyLabel = "Saving...", showLicense = true }) {
  const [form, setForm] = useState(() => {
    const start = { ...EMPTY, ...(initial || {}) };
    if (!start.division && start.district) start.division = divisionOfDistrict(start.district);
    return start;
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const onText = (e) => set({ [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    const found = {};
    if (form.name.trim().length < 2) found.name = "Enter the blood bank's name";
    if (!form.phone.trim()) found.phone = "Enter a contact number";
    if (!form.district) found.district = "Choose a district";
    setErrors(found);
    if (Object.keys(found).length) return;

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      division: form.division,
      district: form.district,
      address: form.address.trim(),
      openingHours: form.is24Hours ? "" : form.openingHours.trim(),
      is24Hours: form.is24Hours,
    };
    if (showLicense) payload.licenseNo = form.licenseNo.trim();

    setSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      setErrors(parseError(err).fields);
      throw err; // the caller shows the toast
    } finally {
      setSubmitting(false);
    }
  }

  const districts = form.division ? DIVISIONS[form.division] : [];

  return (
    <form onSubmit={(e) => handleSubmit(e).catch(() => {})} className="space-y-4" noValidate>
      <FormField label="Blood bank name" name="name" value={form.name} onChange={onText} error={errors.name} />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Contact phone"
          name="phone"
          type="tel"
          placeholder="01711111111 or 02-9xxxxxx"
          value={form.phone}
          onChange={onText}
          error={errors.phone}
        />
        <FormField label="Email (optional)" name="email" type="email" value={form.email} onChange={onText} error={errors.email} />
      </div>

      {showLicense && (
        <FormField
          label="License number (optional)"
          name="licenseNo"
          value={form.licenseNo}
          onChange={onText}
          error={errors.licenseNo}
          hint="Helps an administrator approve the registration faster."
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Division"
          value={form.division}
          onChange={(e) => set({ division: e.target.value, district: "" })}
          error={errors.division}
        >
          <option value="">Choose division</option>
          {DIVISION_NAMES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="District"
          value={form.district}
          disabled={!form.division}
          onChange={(e) => set({ district: e.target.value })}
          error={errors.district}
        >
          <option value="">{form.division ? "Choose district" : "Choose a division first"}</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </SelectField>
      </div>

      <FormField label="Address" name="address" value={form.address} onChange={onText} error={errors.address} />

      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <input
          type="checkbox"
          checked={form.is24Hours}
          onChange={(e) => set({ is24Hours: e.target.checked })}
          className="h-4 w-4 accent-brand-red"
        />
        Open 24 hours
      </label>

      {!form.is24Hours && (
        <FormField
          label="Opening hours"
          name="openingHours"
          placeholder="Sat–Thu, 9am–8pm"
          value={form.openingHours}
          onChange={onText}
          error={errors.openingHours}
        />
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-brand-red py-3 font-semibold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
      >
        {submitting ? busyLabel : submitLabel}
      </button>
    </form>
  );
}
