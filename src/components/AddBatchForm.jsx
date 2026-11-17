import { useState } from "react";
import toast from "react-hot-toast";
import { addBatch } from "../services/inventory";
import { parseError } from "../utils/errors";
import { todayInput } from "../utils/donors";
import { tomorrowInput } from "../utils/inventory";
import { BLOOD_GROUPS } from "../data/bangladesh";
import { COMPONENTS } from "../data/inventory";
import FormField from "./FormField";
import SelectField from "./SelectField";

const EMPTY = {
  bloodGroup: "",
  component: "whole_blood",
  units: "",
  collectedAt: "",
  expiresAt: "",
};

function validate(f) {
  const e = {};
  const units = Number(f.units);

  if (!f.bloodGroup) e.bloodGroup = "Select a blood group";

  if (!f.units) e.units = "Enter the number of units";
  else if (!Number.isInteger(units) || units < 1 || units > 1000)
    e.units = "Units must be a whole number from 1 to 1000";

  if (f.collectedAt && f.collectedAt > todayInput())
    e.collectedAt = "Collection date cannot be in the future";

  if (f.expiresAt) {
    if (f.expiresAt < tomorrowInput()) e.expiresAt = "Expiry must be in the future";
    else if (f.collectedAt && f.expiresAt <= f.collectedAt)
      e.expiresAt = "Expiry must be after the collection date";
  }
  return e;
}

export default function AddBatchForm({ bankId, onAdded }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  async function handleSubmit(e) {
    e.preventDefault();

    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    const payload = {
      bloodGroup: form.bloodGroup,
      component: form.component,
      units: Number(form.units),
    };
    // Dates are optional: the server uses today and the standard shelf life
    if (form.collectedAt) payload.collectedAt = form.collectedAt;
    if (form.expiresAt) payload.expiresAt = form.expiresAt;

    setSubmitting(true);
    try {
      await addBatch(bankId, payload);
      toast.success("Batch added to stock");
      setForm(EMPTY);
      onAdded();
    } catch (err) {
      const { message, fields } = parseError(err);
      setErrors(fields);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="font-semibold text-brand-blue">Add a batch</h2>
      <p className="mt-1 text-sm text-gray-500">
        Record blood units received. Leave the dates empty to use today and the standard shelf
        life for the component.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          label="Blood group"
          name="bloodGroup"
          value={form.bloodGroup}
          onChange={handleChange}
          error={errors.bloodGroup}
        >
          <option value="">Select</option>
          {BLOOD_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Component"
          name="component"
          value={form.component}
          onChange={handleChange}
          error={errors.component}
        >
          {COMPONENTS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </SelectField>

        <FormField
          label="Units"
          name="units"
          type="number"
          inputMode="numeric"
          min="1"
          max="1000"
          step="1"
          value={form.units}
          onChange={handleChange}
          error={errors.units}
          hint="1 to 1000"
        />

        <FormField
          label="Collected on (optional)"
          name="collectedAt"
          type="date"
          max={todayInput()}
          value={form.collectedAt}
          onChange={handleChange}
          error={errors.collectedAt}
        />

        <FormField
          label="Expires on (optional)"
          name="expiresAt"
          type="date"
          min={tomorrowInput()}
          value={form.expiresAt}
          onChange={handleChange}
          error={errors.expiresAt}
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 rounded-lg bg-brand-red px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
      >
        {submitting ? "Adding..." : "Add batch"}
      </button>
    </form>
  );
}