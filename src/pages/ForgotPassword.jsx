import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../services/api";
import { parseError } from "../utils/errors";
import { PHONE_RE, cleanPhone } from "../utils/phone";
import FormField from "../components/FormField";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    const cleaned = cleanPhone(phone);
    if (!PHONE_RE.test(cleaned)) {
      setError("Enter a valid Bangladeshi mobile number");
      return;
    }
    setError("");

    setSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { phone: cleaned });
      toast.success("If this number has an account, a code has been sent.");
      navigate("/reset-password", { state: { phone: cleaned } });
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error("Password reset is not available yet.");
      } else {
        toast.error(parseError(err).message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md px-4 py-12">
      <div className="w-full rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-brand-blue">Forgot password?</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter the phone number on your account and we will text you a 6-digit code.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <FormField
            label="Phone number"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="01711111111"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={error}
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-red py-3 font-semibold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
          >
            {submitting ? "Sending code..." : "Send code"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Remembered it?{" "}
          <Link to="/login" className="font-semibold text-brand-red hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}