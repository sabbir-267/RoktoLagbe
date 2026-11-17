import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Phone,
  Mail,
  Navigation,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getBank } from "../services/banks";
import { normalizeBank, normalizeStock, directionsUrl } from "../utils/banks";
import { canManageBank } from "../utils/inventory";
import { parseError } from "../utils/errors";
import StockGrid from "../components/StockGrid";
import Spinner from "../components/Spinner";

function InfoRow({ icon: Icon, children }) {
  return (
    <li className="flex items-start gap-3 text-sm text-gray-700">
      <Icon size={17} className="mt-0.5 shrink-0 text-gray-400" />
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

export default function BloodBankDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ key: null, bank: null, stock: null, error: null });

  // A result counts only if it belongs to the current bank, so "loading" is worked out here
  const requestKey = `${id}|${attempt}`;
  const status = result.key !== requestKey ? "loading" : result.error ? "error" : "ready";

  useEffect(() => {
    let cancelled = false;

    getBank(id)
      .then((data) => {
        if (cancelled) return;
        setResult({
          key: requestKey,
          bank: normalizeBank(data.bank),
          stock: normalizeStock(data.stock),
          error: null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setResult({ key: requestKey, bank: null, stock: null, error: err });
      });

    return () => {
      cancelled = true;
    };
  }, [id, requestKey]);

  const { bank, stock, error } = result;

  const back = (
    <Link
      to="/blood-banks"
      className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline"
    >
      <ArrowLeft size={16} />
      All blood banks
    </Link>
  );

  if (status === "loading") return <Spinner />;

  if (status === "error") {
    const notFound = error?.response?.status === 404;
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-brand-blue">
          {notFound ? "Blood bank not found" : "Something went wrong"}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {notFound
            ? "This blood bank doesn't exist or is not available."
            : parseError(error).message}
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          {!notFound && (
            <button
              type="button"
              onClick={() => setAttempt((a) => a + 1)}
              className="rounded-lg bg-brand-red px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
            >
              Try again
            </button>
          )}
          {back}
        </div>
      </div>
    );
  }

  const area = [...new Set([bank.district, bank.division].filter(Boolean))].join(", ");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {back}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-brand-blue">{bank.name}</h1>
        {bank.is24Hours && (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-blue">
            Open 24 hours
          </span>
        )}
        {canManageBank(user, id) && (
          <Link
            to={`/blood-banks/${id}/manage`}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-blue-dark"
          >
            <ClipboardList size={16} />
            Manage stock
          </Link>
        )}
      </div>
      {area && <p className="mt-1 text-gray-500">{area}</p>}

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {/* Stock */}
        <section className="rounded-2xl bg-white p-6 shadow-sm md:col-span-2">
          <h2 className="font-semibold text-brand-blue">Blood stock</h2>
          <p className="mt-1 text-sm text-gray-500">
            Units of each blood group currently available at this blood bank.
          </p>
          <div className="mt-5">
            <StockGrid stock={stock} />
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Stock is entered by blood bank staff and can change quickly. Please call to confirm
            before you travel.
          </p>
        </section>

        {/* Contact */}
        <aside className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-brand-blue">Contact</h2>
          <ul className="mt-4 space-y-3">
            {bank.address && <InfoRow icon={MapPin}>{bank.address}</InfoRow>}
            {bank.is24Hours ? (
              <InfoRow icon={Clock}>Open 24 hours</InfoRow>
            ) : (
              bank.openingHours && <InfoRow icon={Clock}>{bank.openingHours}</InfoRow>
            )}
            {bank.phone && <InfoRow icon={Phone}>{bank.phone}</InfoRow>}
            {bank.email && <InfoRow icon={Mail}>{bank.email}</InfoRow>}
          </ul>

          <div className="mt-5 space-y-2">
            {bank.phone && (
              <a
                href={`tel:${bank.phone}`}
                className="flex items-center justify-center gap-2 rounded-lg bg-brand-red px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
              >
                <Phone size={16} />
                Call now
              </a>
            )}
            <a
              href={directionsUrl(bank)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <Navigation size={16} />
              Get directions
            </a>
          </div>

          {bank.licenseNo && (
            <p className="mt-5 text-xs text-gray-400">License no. {bank.licenseNo}</p>
          )}
        </aside>
      </div>
    </div>
  );
}