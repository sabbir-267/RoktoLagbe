import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { UserRound, HeartPulse } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getMyProfile, setAvailability } from "../services/donors";
import { unwrapDonor, normalizeDonor, formatDate } from "../utils/donors";
import { parseError } from "../utils/errors";
import Spinner from "../components/Spinner";

const roleLabel = {
  user: "Member",
  bank_staff: "Blood bank staff",
  admin: "Administrator",
};

export default function Dashboard() {
  const { user } = useAuth();
  const [donor, setDonor] = useState(null); // null = no donor profile yet
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyProfile()
      .then((data) => {
        if (cancelled) return;
        setDonor(normalizeDonor(unwrapDonor(data)));
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 404) {
          setDonor(null);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleAvailability() {
    const next = !donor.available;
    setToggling(true);
    try {
      await setAvailability(next);
      setDonor({ ...donor, available: next });
      toast.success(next ? "You are now visible as available" : "You are marked unavailable");
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold text-brand-blue">Welcome, {user.name}</h1>
      <p className="mt-1 text-gray-500">{roleLabel[user.role] || user.role}</p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-brand-blue">
            <UserRound size={20} />
            <h2 className="font-semibold">Your account</h2>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd>{user.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Phone</dt>
              <dd>{user.phone || "Not added"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Email</dt>
              <dd>{user.email || "Not added"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-brand-red">
            <HeartPulse size={20} />
            <h2 className="font-semibold">Donor profile</h2>
          </div>

          {status === "loading" && <Spinner className="py-6" />}

          {status === "error" && (
            <p className="mt-4 text-sm text-red-600">Could not load your donor profile.</p>
          )}

          {status === "ready" && !donor && (
            <>
              <p className="mt-4 text-sm text-gray-600">
                You are not listed as a donor yet. Create a donor profile so people in need
                can find you.
              </p>
              <Link
                to="/donor-profile"
                className="mt-4 inline-block rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
              >
                Create donor profile
              </Link>
            </>
          )}

          {status === "ready" && donor && (
            <>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-2xl font-extrabold text-brand-red">
                  {donor.bloodGroup}
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-gray-800">
                    {[donor.area, donor.upazila, donor.district].filter(Boolean).join(", ")}
                  </p>
                  <p className={donor.eligible ? "text-green-700" : "text-amber-600"}>
                    {donor.eligible
                     ? "Eligible to donate"
                     : donor.nextEligibleDate
                       ? `Eligible again on ${formatDate(donor.nextEligibleDate)}`
                       : "Donated recently"}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">Available to donate</p>
                  <p className="text-xs text-gray-500">
                    {donor.available ? "Shown in search results" : "Hidden from availability filters"}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={donor.available}
                  aria-label="Toggle availability"
                  onClick={toggleAvailability}
                  disabled={toggling}
                  className={`relative h-7 w-12 rounded-full transition disabled:opacity-60 ${
                    donor.available ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                      donor.available ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>

              <Link
                to="/donor-profile"
                className="mt-4 inline-block text-sm font-semibold text-brand-blue hover:underline"
              >
                Edit donor profile
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}