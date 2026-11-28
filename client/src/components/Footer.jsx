import { Link } from "react-router-dom";
import { Phone, Heart } from "lucide-react";
import logo from "../assets/logo.jpeg";
import useT from "../i18n/useT";
import { useAuth } from "../context/AuthContext";
import { becomeDonorLink } from "../utils/donorCta";
import layout from "../i18n/layout";

const COLUMNS = [
  {
    title: "colHelp",
    links: [
      ["/donors", "fFindDonors"],
      ["/requests", "fRequests"],
      ["/requests/new", "fPostRequest"],
      ["/doctors", "fAskDoctor"],
      ["/blood-banks", "fBanks"],
    ],
  },
  {
    title: "colGive",
    links: [
      ["/register", "fBecomeDonor"],
      ["/eligibility", "fWhoCanDonate"],
      ["/leaderboard", "fLeaderboard"],
      ["/donor-profile", "fDonorProfile"],
    ],
  },
  {
    title: "colPartners",
    links: [
      ["/bank-portal/register", "fRegisterBank"],
      ["/bank-portal", "fBankPortal"],
      ["/doctors/join", "fJoinDoctor"],
    ],
  },
  {
    title: "colSupport",
    links: [
      ["/complaints", "fComplaints"],
    ],
  },
];

export default function Footer() {
  const { t, n } = useT(layout);
  const { user } = useAuth();
  const donorLink = becomeDonorLink(user);
  // "Become a donor" goes to sign-up for guests, the donor form for members, and is hidden for donors
  const linksOf = (col) =>
    col.links
      .map(([to, key]) => (key === "fBecomeDonor" ? [donorLink, key] : [to, key]))
      .filter(([to]) => to);
  return (
    <footer className="mt-16 border-t border-gray-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="sm:col-span-2 md:col-span-1">
          <Link to="/" className="flex items-center gap-2.5" aria-label={t("home")}>
            <img src={logo} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-gray-200" />
            <span className="text-lg font-extrabold tracking-tight text-brand-red">
              Rokto<span className="text-brand-blue">Lagbe</span>
            </span>
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-gray-500">{t("footerAbout")}</p>
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-brand-red-dark">
            <Phone size={16} className="mt-0.5 shrink-0" />
            <span>
              {t("footerEmergencyBefore")} <strong>{n(999)}</strong> {t("footerEmergencyAfter")}
            </span>
          </div>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold text-gray-900">{t(col.title)}</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {linksOf(col).map(([to, key]) => (
                <li key={to}>
                  <Link to={to} className="text-gray-500 transition hover:text-brand-red">
                    {t(key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-center text-xs text-gray-500 sm:flex-row sm:text-left">
          <p>
            © {n(new Date().getFullYear()).replace(/[,،]/g, "")} {t("copyright")}
          </p>
          <p className="flex items-center gap-1">
            {t("madeWithBefore")} <Heart size={12} className="fill-brand-red text-brand-red" aria-label="love" />{" "}
            {t("madeWithAfter")}
          </p>
        </div>
      </div>
    </footer>
  );
}
