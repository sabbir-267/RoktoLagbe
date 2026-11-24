import { Link, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import {
  BadgeCheck,
  MapPin,
  Phone,
  MessageCircle,
  Copy,
  GraduationCap,
  Users,
  Lock,
} from "lucide-react";
import { toWhatsAppNumber } from "../utils/phone";
import MessageButton from "./MessageButton";
import useT from "../i18n/useT";
import donors from "../i18n/donors";

export default function DonorCard({ donor, loggedIn }) {
  const location = useLocation();
  const { t, date, dist } = useT(donors);
  const place = [donor.area, donor.upazila, dist(donor.district)].filter(Boolean).join(", ");

  async function copyPhone() {
    try {
      await navigator.clipboard.writeText(donor.phone);
      toast.success(t("phoneCopied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  return (
    <article className="flex flex-col rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-xl font-extrabold text-brand-red">
          {donor.bloodGroup}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1 font-semibold text-gray-900">
            <span className="truncate">{donor.name}</span>
            {donor.verified && (
              <BadgeCheck
                size={18}
                className="shrink-0 text-brand-blue"
                aria-label={t("verifiedDonor")}
              />
            )}
          </h3>
          <p className="mt-1 flex items-start gap-1 text-sm text-gray-500">
            <MapPin size={14} className="mt-0.5 shrink-0" />
            <span>{place || t("locationNotSet")}</span>
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            donor.available ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
          }`}
        >
          {donor.available ? t("available") : t("unavailable")}
        </span>
      </div>

      {(donor.campus || donor.group) && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {donor.campus && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-brand-blue">
              <GraduationCap size={13} />
              {donor.campus}
            </span>
          )}
          {donor.group && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-brand-blue">
              <Users size={13} />
              {donor.group}
            </span>
          )}
        </div>
      )}

      <ul className="mt-3 space-y-1 text-sm">
        <li className={donor.eligible ? "text-green-700" : "text-amber-600"}>
          {donor.eligible
            ? t("eligibleNow")
            : donor.nextEligibleDate
              ? t("eligibleAgainOn", { date: date(donor.nextEligibleDate) })
              : t("donatedRecently")}
        </li>
        <li className="text-gray-500">
          {donor.totalDonations > 0
            ? t("donations", { count: donor.totalDonations })
            : t("noDonations")}
          {donor.lastDonationDate && t("lastDonation", { date: date(donor.lastDonationDate) })}
        </li>
      </ul>

      <div className="mt-auto pt-4">
        {!loggedIn ? (
          <Link
            to="/login"
            state={{ from: location }}
            className="flex items-center justify-center gap-2 rounded-lg border border-brand-blue/30 px-4 py-2.5 text-sm font-semibold text-brand-blue transition hover:bg-blue-50"
          >
            <Lock size={16} />
            {t("loginForContact")}
          </Link>
        ) : donor.phone ? (
          <>
            <p className="mb-2 text-sm font-medium text-gray-700">{donor.phone}</p>
            <div className="grid grid-cols-3 gap-2">
              <a
                href={`tel:${donor.phone}`}
                className="flex items-center justify-center gap-1 rounded-lg bg-brand-red px-2 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
              >
                <Phone size={15} />
                {t("call")}
              </a>
              <a
                href={`https://wa.me/${toWhatsAppNumber(donor.phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 rounded-lg bg-green-600 px-2 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                <MessageCircle size={15} />
                WhatsApp
              </a>
              <button
                type="button"
                onClick={copyPhone}
                className="flex items-center justify-center gap-1 rounded-lg border border-gray-300 px-2 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                <Copy size={15} />
                {t("copy")}
              </button>
            </div>
          </>
        ) : (
          <p className="rounded-lg bg-gray-50 px-3 py-2.5 text-center text-sm text-gray-500">
            {t("numberPrivate")}
          </p>
        )}
        {loggedIn && (
          <MessageButton
            target={{ donorId: donor.id }}
            label={t("sendMessage")}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-blue/30 px-4 py-2.5 text-sm font-semibold text-brand-blue transition hover:bg-blue-50 disabled:opacity-60"
          />
        )}
      </div>
    </article>
  );
}