import { useState } from "react";
import toast from "react-hot-toast";
import { Search, CheckCircle2, XCircle } from "lucide-react";
import { lookupDonor, recordDonation } from "../services/banks";
import { parseError } from "../utils/errors";
import { PHONE_RE, cleanPhone } from "../utils/phone";
import { formatDate, todayInput } from "../utils/donors";
import { COMPONENTS } from "../data/inventory";
import FormField from "./FormField";
import SelectField from "./SelectField";

const MAX_BACKDATE_DAYS = 30; // must match the server's limit

function daysAgoInput(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const emptyDetails = () => ({
  donatedAt: todayInput(),
  units: "1",
  component: "whole_blood",
  addToStock: true,
});

function DonorPreview({ donor }) {
  return (
    <div
      className={`mt-4 rounded-xl border p-4 text-sm ${
        donor.isEligible ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-extrabold text-brand-red">{donor.bloodGroup}</span>
          <div>
            <p className="font-semibold text-gray-800">{donor.name}</p>
            <p className="text-gray-500">
              {donor.totalDonations} donation{donor.totalDonations === 1 ? "" : "s"} recorded
              {donor.lastDonationDate ? ` · last on ${formatDate(donor.lastDonationDate)}` : ""}
            </p>
          </div>
        </div>
        {donor.isEligible ? (
          <span className="inline-flex items-center gap-1 font-semibold text-green-700">
            <CheckCircle2 size={16} /> Eligible today
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
            <XCircle size={16} /> Not eligible until {formatDate(donor.nextEligibleDate)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function RecordDonationForm({ bankId, onRecorded }) {
  const [phone, setPhone] = useState("");
  const [donor, setDonor] = useState(null);
  const [details, setDetails] = useState(emptyDetails);
  const [errors, setErrors] = useState({});
  const [looking, setLooking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handlePhone = (e) => {
    setPhone(e.target.value);
    setDonor(null); // a changed number must be looked up again
    setErrors((prev) => ({ ...prev, phone: undefined }));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setDetails((d) => ({ ...d, [name]: type === "checkbox" ? checked : value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  async function handleLookup() {
    const cleaned = cleanPhone(phone);
    if (!PHONE_RE.test(cleaned)) {
      setErrors({ phone: "Enter a valid Bangladeshi mobile number" });
      return;
    }
    setLooking(true);
    try {
      const data = await lookupDonor(bankId, cleaned);
      setDonor(data.donor);
    } catch (err) {
      const { message, fields } = parseError(err);
      setErrors({ phone: fields.phone || message });
    } finally {
      setLooking(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!donor) return;

    const found = {};
    if (!details.donatedAt) found.donatedAt = "Select the donation date";
    else if (details.donatedAt > todayInput()) found.donatedAt = "Donation date cannot be in the future";
    else if (details.donatedAt < daysAgoInput(MAX_BACKDATE_DAYS))
      found.donatedAt = `Donation date cannot be more than ${MAX_BACKDATE_DAYS} days ago`;
    setErrors(found);
    if (Object.keys(found).length) return;

    const payload = {
      phone: cleanPhone(phone),
      units: Number(details.units),
      component: details.component,
      addToStock: details.addToStock,
    };
    // Today: let the server use the current time
    if (details.donatedAt !== todayInput()) payload.donatedAt = details.donatedAt;

    setSubmitting(true);
    try {
      const data = await recordDonation(bankId, payload);
      toast.success(
        `Donation by ${data.donation.donorName} recorded${data.batch ? " and added to stock" : ""}`
      );
      setPhone("");
      setDonor(null);
      setDetails(emptyDetails());
      onRecorded?.(data);
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
      <h2 className="font-semibold text-brand-blue">Record a donation</h2>
      <p className="mt-1 text-sm text-gray-500">
        Look up the donor by phone number, check it is the right person, then record the donation.
        Recording a donation also marks the donor as verified.
      </p>

      <div className="mt-5 flex flex-wrap items-start gap-3">
        <div className="min-w-56 flex-1">
          <FormField
            label="Donor's phone number"
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="01XXXXXXXXX"
            value={phone}
            onChange={handlePhone}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleLookup();
              }
            }}
            error={errors.phone}
          />
        </div>
        <button
          type="button"
          onClick={handleLookup}
          disabled={looking || !phone.trim()}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
        >
          <Search size={16} /> {looking ? "Looking up..." : "Look up"}
        </button>
      </div>

      {donor && (
        <>
          <DonorPreview donor={donor} />

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              label="Donated on"
              name="donatedAt"
              type="date"
              min={daysAgoInput(MAX_BACKDATE_DAYS)}
              max={todayInput()}
              value={details.donatedAt}
              onChange={handleChange}
              error={errors.donatedAt}
            />

            <SelectField
              label="Units"
              name="units"
              value={details.units}
              onChange={handleChange}
              error={errors.units}
            >
              <option value="1">1</option>
              <option value="2">2</option>
            </SelectField>

            <SelectField
              label="Component"
              name="component"
              value={details.component}
              onChange={handleChange}
              error={errors.component}
              disabled={!details.addToStock}
            >
              {COMPONENTS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </SelectField>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="addToStock"
              checked={details.addToStock}
              onChange={handleChange}
              className="h-4 w-4 accent-brand-red"
            />
            Add to stock as a new batch ({donor.bloodGroup}, standard shelf life)
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 rounded-lg bg-brand-red px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
          >
            {submitting ? "Recording..." : "Record donation"}
          </button>
        </>
      )}
    </form>
  );
}
