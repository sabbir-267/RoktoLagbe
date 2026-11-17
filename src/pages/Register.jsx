import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { parseError } from "../utils/errors";
import FormField from "../components/FormField";

// Accepts 01XXXXXXXXX, +8801XXXXXXXXX, 8801XXXXXXXXX (the backend double-checks)
const PHONE_RE = /^(?:\+?88)?01\d{9}$/;

function validate(f) {
  const e = {};
  const name = f.name.trim();
  const phone = f.phone.replace(/[\s-]/g, "");
  const email = f.email.trim();

  if (name.length < 2 || name.length > 80) e.name = "Name must be 2 to 80 characters";
  if (!PHONE_RE.test(phone)) e.phone = "Enter a valid Bangladeshi mobile number";
  if (email && !/^\S+@\S+\.\S+$/.test(email)) e.email = "Enter a valid email or leave it empty";
  if (f.password.length < 8) e.password = "Password must be at least 8 characters";
  if (f.confirm !== f.password) e.confirm = "Passwords do not match";
  return e;
}

export default function Register() {
  const { user, register } = useAuth();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();

    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    // Only send what the backend expects (no role, no confirm)
    const payload = {
      name: form.name.trim(),
      phone: form.phone.replace(/[\s-]/g, ""),
      password: form.password,
    };
    if (form.email.trim()) payload.email = form.email.trim();

    setSubmitting(true);
    try {
      await register(payload);
      toast.success("Account created! Welcome to RoktoLagbe.");
    } catch (err) {
      const { message, fields } = parseError(err);
      setErrors(fields);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md px-4 py-12">
      <div className="w-full rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-brand-blue">Create your account</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sign up first, then set up your donor profile.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <FormField
            label="Full name"
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={handleChange}
            error={errors.name}
          />
          <FormField
            label="Phone number"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="01711111111"
            value={form.phone}
            onChange={handleChange}
            error={errors.phone}
            hint="You will use this number to log in."
          />
          <FormField
            label="Email (optional)"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            error={errors.email}
          />
          <FormField
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            error={errors.password}
            hint="At least 8 characters."
          />
          <FormField
            label="Confirm password"
            name="confirm"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={handleChange}
            error={errors.confirm}
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-red py-3 font-semibold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
          >
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-brand-red hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}