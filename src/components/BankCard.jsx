import { Link } from "react-router-dom";
import { MapPin, Clock, Phone, Navigation } from "lucide-react";
import { directionsUrl } from "../utils/banks";

export default function BankCard({ bank }) {
  const place = [bank.address, bank.district].filter(Boolean).join(", ");

  return (
    <article className="flex flex-col rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-gray-900">
          <Link to={`/blood-banks/${bank.id}`} className="hover:text-brand-red">
            {bank.name}
          </Link>
        </h3>
        {bank.is24Hours && (
          <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-brand-blue">
            Open 24 hours
          </span>
        )}
      </div>

      <ul className="mt-3 space-y-2 text-sm text-gray-600">
        <li className="flex items-start gap-2">
          <MapPin size={15} className="mt-0.5 shrink-0 text-gray-400" />
          <span>{place || "Address not listed"}</span>
        </li>
        {!bank.is24Hours && bank.openingHours && (
          <li className="flex items-start gap-2">
            <Clock size={15} className="mt-0.5 shrink-0 text-gray-400" />
            <span>{bank.openingHours}</span>
          </li>
        )}
        {bank.phone && (
          <li className="flex items-start gap-2">
            <Phone size={15} className="mt-0.5 shrink-0 text-gray-400" />
            <span>{bank.phone}</span>
          </li>
        )}
      </ul>

      <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
        <Link
          to={`/blood-banks/${bank.id}`}
          className="col-span-2 rounded-lg bg-brand-red px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-brand-red-dark"
        >
          View blood stock
        </Link>
        {bank.phone ? (
          <a
            href={`tel:${bank.phone}`}
            className="flex items-center justify-center gap-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            <Phone size={15} />
            Call
          </a>
        ) : (
          <span />
        )}
        <a
          href={directionsUrl(bank)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          <Navigation size={15} />
          Directions
        </a>
      </div>
    </article>
  );
}