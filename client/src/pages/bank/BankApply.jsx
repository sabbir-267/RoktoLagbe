import { Link, Navigate, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Building2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { applyForBank } from "../../services/banks";
import { parseError } from "../../utils/errors";
import BankForm from "../../components/BankForm";

export default function BankApply() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  if (user.role === "bank_staff") return <Navigate to="/bank-portal" replace />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;

  async function submit(payload) {
    try {
      await applyForBank(payload);
    } catch (err) {
      toast.error(parseError(err).message);
      throw err;
    }
    await refreshUser(); // role is now bank_staff
    toast.success("Blood bank registered. An administrator will review it soon.");
    navigate("/bank-portal", { replace: true });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center gap-3 text-brand-blue">
        <Building2 size={28} />
        <h1 className="text-3xl font-bold">Register your blood bank</h1>
      </div>
      <p className="mt-2 text-gray-600">
        Your bank stays hidden from the public until an administrator approves it. Meanwhile you can
        set up your profile and stock from the blood bank portal. Your account will become the
        bank's staff account.
      </p>

      {user.needsPhone ? (
        <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          Add your phone number before registering a blood bank.{" "}
          <Link to="/add-phone" className="font-semibold underline">
            Add phone
          </Link>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <BankForm onSubmit={submit} submitLabel="Submit for approval" busyLabel="Submitting..." />
        </div>
      )}
    </div>
  );
}
