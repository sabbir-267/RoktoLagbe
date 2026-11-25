import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getMyProfile, saveMyProfile } from "../services/donors";
import { useAuth } from "../context/AuthContext";
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
import EmailVerifyCard from "../components/EmailVerifyCard";
import useT from "../i18n/useT";
import dict from "../i18n/donorProfile";

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
  showOnLeaderboard: true,
  emailAlerts: true,
};

function validate(f, exists, dobLocked, t) {
  const e = {};
  const { min, max } = dobLimits();

  if (!exists && !f.bloodGroup) e.bloodGroup = t("errBloodGroup");

  // A locked date of birth came from the server, so there is nothing to check
  if (!dobLocked) {
    if (!f.dateOfBirth) e.dateOfBirth = t("errDob");
    else if (f.dateOfBirth > max || f.dateOfBirth < min)
      e.dateOfBirth = t("errAge");
  }

  if (!f.gender) e.gender = t("errGender");

  if (!f.weightKg) e.weightKg = t("errWeight");
  else if (Number(f.weightKg) < 45) e.weightKg = t("errWeightMin");

  if (!f.district) e.district = t("errDistrict");

  if (f.lastDonationDate && f.lastDonationDate > todayInput())
    e.lastDonationDate = t("errFutureDate");
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
  const { t, dist } = useT(dict);
  const navigate = useNavigate();
  const { user } = useAuth();
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
          showOnLeaderboard: d.showOnLeaderboard !== false,
          emailAlerts: d.emailAlerts !== false,
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

    const found = validate(form, exists, dobLocked, t);
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
      showOnLeaderboard: form.showOnLeaderboard,
      emailAlerts: form.emailAlerts,
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
      toast.success(exists ? t("updated") : t("created"));
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

  // The backend only accepts donor profiles from users with a phone and a verified email
  if (user.needsPhone || !user.isEmailVerified) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold text-brand-blue">
          {exists ? t("titleEdit") : t("titleNew")}
        </h1>
        <p className="mt-1 text-gray-500">{t("stepsIntro")}</p>
        <div className="mt-8 space-y-4">
          {user.needsPhone && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
              <span>{t("addPhoneHint")}</span>
              <Link
                to="/add-phone"
                state={{ from: "/donor-profile" }}
                className="rounded-lg bg-brand-blue px-4 py-2 font-semibold text-white transition hover:opacity-90"
              >
                {t("addPhone")}
              </Link>
            </div>
          )}
          <EmailVerifyCard />
        </div>
      </div>
    );
  }

  const { min, max } = dobLimits();
  const districts = DIVISIONS[form.division] || [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-brand-blue">
        {exists ? t("titleEdit") : t("titleNew")}
      </h1>
      <p className="mt-1 text-gray-500">
        {t("subtitle")}
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-6">
        <Section title={t("aboutYou")}>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label={t("common:bloodGroup")}
              name="bloodGroup"
              value={form.bloodGroup}
              onChange={handleChange}
              disabled={exists}
              error={errors.bloodGroup}
              hint={
                exists
                  ? t("groupLocked")
                  : t("groupChooseCarefully")
              }
            >
              <option value="">{t("select")}</option>
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </SelectField>

            <FormField
              label={t("dob")}
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
                  ? t("dobLocked")
                  : exists
                    ? t("dobAgain")
                    : t("dobChooseCarefully")
              }
            />

            <SelectField
              label={t("gender")}
              name="gender"
              value={form.gender}
              onChange={handleChange}
              error={errors.gender}
            >
              <option value="">{t("select")}</option>
              <option value="male">{t("gender_male")}</option>
              <option value="female">{t("gender_female")}</option>
              <option value="other">{t("gender_other")}</option>
            </SelectField>

            <FormField
              label={t("weight")}
              name="weightKg"
              type="number"
              inputMode="decimal"
              min="45"
              step="any"
              value={form.weightKg}
              onChange={handleChange}
              error={errors.weightKg}
              hint={t("weightHint")}
            />
          </div>
        </Section>

        <Section title={t("location")}>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label={t("common:division")}
              name="division"
              value={form.division}
              onChange={handleChange}
              error={errors.division}
            >
              <option value="">{t("selectDivision")}</option>
              {DIVISION_NAMES.map((d) => (
                <option key={d} value={d}>
                  {dist(d)}
                </option>
              ))}
            </SelectField>

            <SelectField
              label={t("common:district")}
              name="district"
              value={form.district}
              onChange={handleChange}
              disabled={!form.division}
              error={errors.district}
            >
              <option value="">
                {form.division ? t("selectDistrict") : t("divisionFirst")}
              </option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {dist(d)}
                </option>
              ))}
            </SelectField>

            <FormField
              label={t("upazila")}
              name="upazila"
              value={form.upazila}
              onChange={handleChange}
              error={errors.upazila}
            />
            <FormField
              label={t("area")}
              name="area"
              value={form.area}
              onChange={handleChange}
              error={errors.area}
              hint={t("areaHint")}
            />
            <FormField
              label={t("campus")}
              name="campus"
              value={form.campus}
              onChange={handleChange}
              error={errors.campus}
              hint={t("campusHint")}
            />
            <FormField
              label={t("group")}
              name="group"
              value={form.group}
              onChange={handleChange}
              error={errors.group}
              hint={t("groupHint")}
            />
          </div>
        </Section>

        <Section title={t("donationHistory")}>
          <FormField
            label={t("lastDonation")}
            name="lastDonationDate"
            type="date"
            max={todayInput()}
            value={form.lastDonationDate}
            onChange={handleChange}
            error={errors.lastDonationDate}
            hint={t("lastDonationHint")}
          />
        </Section>

        <Section title={t("privacy")}>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="allowPhoneVisible"
              checked={form.allowPhoneVisible}
              onChange={handleChange}
              className="mt-1 h-4 w-4 accent-brand-red"
            />
            <span className="text-sm text-gray-700">
              <strong>{t("showPhone")}</strong>
              <span className="block text-gray-500">
                {t("showPhoneHint")}
              </span>
            </span>
          </label>
          <label className="mt-4 flex items-start gap-3">
            <input
              type="checkbox"
              name="showOnLeaderboard"
              checked={form.showOnLeaderboard}
              onChange={handleChange}
              className="mt-1 h-4 w-4 accent-brand-red"
            />
            <span className="text-sm text-gray-700">
              <strong>{t("showLeaderboard")}</strong>
              <span className="block text-gray-500">
                {t("showLeaderboardHint")}
              </span>
            </span>
          </label>
          <label className="mt-4 flex items-start gap-3">
            <input
              type="checkbox"
              name="emailAlerts"
              checked={form.emailAlerts}
              onChange={handleChange}
              className="mt-1 h-4 w-4 accent-brand-red"
            />
            <span className="text-sm text-gray-700">
              <strong>{t("emailAlerts")}</strong>
              <span className="block text-gray-500">{t("emailAlertsHint")}</span>
            </span>
          </label>
        </Section>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-red px-8 py-3 font-semibold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
          >
            {submitting ? t("common:saving") : exists ? t("saveChanges") : t("createProfile")}
          </button>
          <Link
            to="/dashboard"
            className="rounded-lg border border-gray-300 px-8 py-3 font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            {t("common:cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}