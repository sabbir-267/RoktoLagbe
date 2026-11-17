import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getMyProfile, saveMyProfile } from "../services/donors";
import { parseError } from "../utils/errors";
import {
  unwrapDonor,
  normalizeDonor,
  dobLimits,
  todayInput,
  toDateInput,
} from "../utils/donors";
import { BLOOD_GROUPS, DIVISIONS, DIVISION_NAMES } from "../data/bangladesh";
import FormField from "../components/FormField";
import SelectField from "../components/SelectField";
import Spinner from "../components/Spinner";

const EMPTY = {
  bloodGroup: "",
  dateOfBirth: "",
  gender: "",
  weightKg: "",
  division: "",
  district: "",
  upazila: "",
  area: "",
  campus: "",
  group: "",
  lastDonationDate: "",
  allowPhoneVisible: false,
};

function validate(f, exists, dobLocked) {
  const e = {};
  const { min, max } = dobLimits();

  if (!exists && !f.bloodGroup) e.bloodGroup = "Select your blood group";

  // A locked date of birth came from the server, so there is nothing to check
  if (!dobLocked) {
    if (!f.dateOfBirth) e.dateOfBirth = "Enter your date of birth";
    else if (f.dateOfBirth > max || f.dateOfBirth < min)
      e.dateOfBirth = "Donors must be between 18 and 65 years old";
  }

  if (!f.gender) e.gender = "Select your gender";

  if (!f.weightKg) e.weightKg = "Enter your weight";
  else if (Number(f.weightKg) < 45) e.weightKg = "Donors must weigh at least 45 kg";

  if (!f.district) e.district = "Select your district";

  if (f.lastDonationDate && f.lastDonationDate > todayInput())
    e.lastDonationDate = "The date cannot be in the future";
  return e;
}

function Section({ title, children }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 font-semibold text-brand-blue">{title}</h2>
      {children}
    </section>
  );
}

export default function DonorProfile() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [exists, setExists] = useState(false);
  const [dobLocked, setDobLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Load the existing profile (a 404 just means "no profile yet")
  useEffect(() => {
    let cancelled = false;
    getMyProfile()
      .then((data) => {
        if (cancelled) return;
        const d = normalizeDonor(unwrapDonor(data));
        if (!d) return;
        setExists(true);
        setDobLocked(Boolean(d.dateOfBirth));
        setForm({
          ...EMPTY,
          bloodGroup: d.bloodGroup,
          dateOfBirth: toDateInput(d.dateOfBirth),
          gender: d.gender,
          weightKg: d.weightKg === "" ? "" : String(d.weightKg),
          division: d.division,
          district: d.district,
          upazila: d.upazila,
          area: d.area,
          campus: d.campus,
          group: d.group,
          lastDonationDate: toDateInput(d.lastDonationDate),
          allowPhoneVisible: d.allowPhoneVisible,
        });
      })
      .catch((err) => {
        if (!cancelled && err.response?.status !== 404) toast.error(parseError(err).message);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: type === "checkbox" ? checked : value };
      if (name === "division") next.district = ""; // districts depend on the division
      return next;
    });
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  async function handleSubmit(e) {
    e.preventDefault();

    const found = validate(form, exists, dobLocked);
    setErrors(found);
    if (Object.keys(found).length) return;

    // The backend wants these on every save: blood group, date of birth, district
    const payload = {
      bloodGroup: form.bloodGroup,
      dateOfBirth: form.dateOfBirth,
      gender: form.gender,
      weightKg: Number(form.weightKg),
      district: form.district,
      allowPhoneVisible: form.allowPhoneVisible,
    };
    // Optional fields go only when filled in
    const optional = {
      division: form.division,
      upazila: form.upazila.trim(),
      area: form.area.trim(),
      campus: form.campus.trim(),
      group: form.group.trim(),
      lastDonationDate: form.lastDonationDate,
    };
    Object.entries(optional).forEach(([key, value]) => {
      if (value !== "") payload[key] = value;
    });

    setSubmitting(true);
    try {
      await saveMyProfile(payload);
      toast.success(exists ? "Donor profile updated" : "You are now listed as a donor!");
      navigate("/dashboard");
    } catch (err) {
      const { message, fields } = parseError(err);
      setErrors(fields);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner />;

  const { min, max } = dobLimits();
  const districts = DIVISIONS[form.division] || [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-brand-blue">
        {exists ? "Edit your donor profile" : "Become a donor"}
      </h1>
      <p className="mt-1 text-gray-500">
        People in need will be able to find you by blood group and location.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-6">
        <Section title="About you">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Blood group"
              name="bloodGroup"
              value={form.bloodGroup}
              onChange={handleChange}
              disabled={exists}
              error={errors.bloodGroup}
              hint={
                exists
                  ? "Blood group cannot be changed after your profile is created."
                  : "Choose carefully. You cannot change this later."
              }
            >
              <option value="">Select</option>
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </SelectField>

            <FormField
              label="Date of birth"
              name="dateOfBirth"
              type="date"
              min={min}
              max={max}
              value={form.dateOfBirth}
              onChange={handleChange}
              disabled={dobLocked}
              error={errors.dateOfBirth}
              hint={
                dobLocked
                  ? "Date of birth cannot be changed after your profile is created."
                  : exists
                    ? "Please enter your date of birth once more. Donors must be 18 to 65."
                    : "Choose carefully. You cannot change this later. Donors must be 18 to 65."
              }
            />

            <SelectField
              label="Gender"
              name="gender"
              value={form.gender}
              onChange={handleChange}
              error={errors.gender}
            >
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </SelectField>

            <FormField
              label="Weight in kg"
              name="weightKg"
              type="number"
              inputMode="decimal"
              min="45"
              step="any"
              value={form.weightKg}
              onChange={handleChange}
              error={errors.weightKg}
              hint="At least 45 kg to donate."
            />
          </div>
        </Section>

        <Section title="Location">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Division"
              name="division"
              value={form.division}
              onChange={handleChange}
              error={errors.division}
            >
              <option value="">Select division</option>
              {DIVISION_NAMES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="District"
              name="district"
              value={form.district}
              onChange={handleChange}
              disabled={!form.division}
              error={errors.district}
            >
              <option value="">
                {form.division ? "Select district" : "Choose a division first"}
              </option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </SelectField>

            <FormField
              label="Upazila (optional)"
              name="upazila"
              value={form.upazila}
              onChange={handleChange}
              error={errors.upazila}
            />
            <FormField
              label="Area (optional)"
              name="area"
              value={form.area}
              onChange={handleChange}
              error={errors.area}
              hint="Neighbourhood or locality."
            />
            <FormField
              label="Campus (optional)"
              name="campus"
              value={form.campus}
              onChange={handleChange}
              error={errors.campus}
              hint="University or college, if you are a student."
            />
            <FormField
              label="Group (optional)"
              name="group"
              value={form.group}
              onChange={handleChange}
              error={errors.group}
              hint="A club or volunteer group you belong to."
            />
          </div>
        </Section>

        <Section title="Donation history">
          <FormField
            label="Last donation date (optional)"
            name="lastDonationDate"
            type="date"
            max={todayInput()}
            value={form.lastDonationDate}
            onChange={handleChange}
            error={errors.lastDonationDate}
            hint="Leave empty if you have never donated."
          />
        </Section>

        <Section title="Privacy">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="allowPhoneVisible"
              checked={form.allowPhoneVisible}
              onChange={handleChange}
              className="mt-1 h-4 w-4 accent-brand-red"
            />
            <span className="text-sm text-gray-700">
              <strong>Show my phone number to logged-in users.</strong>
              <span className="block text-gray-500">
                People searching for donors can call you directly. You can change this at
                any time.
              </span>
            </span>
          </label>
        </Section>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-red px-8 py-3 font-semibold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
          >
            {submitting ? "Saving..." : exists ? "Save changes" : "Create donor profile"}
          </button>
          <Link
            to="/dashboard"
            className="rounded-lg border border-gray-300 px-8 py-3 font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}