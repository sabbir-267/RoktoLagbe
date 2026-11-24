import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import SessionTimeout from "./SessionTimeout";
import AssistantWidget from "./AssistantWidget";
import useT from "../i18n/useT";
import layout from "../i18n/layout";

// Tab titles by path (keys in i18n/layout.js). The home page title is used as is.
const TITLES = [
  [/^\/$/, "titleHome", true],
  [/^\/donors/, "titleDonors"],
  [/^\/requests\/new/, "titleNewRequest"],
  [/^\/requests\/[^/]+/, "titleRequest"],
  [/^\/requests/, "titleRequests"],
  [/^\/blood-banks\/[^/]+\/manage/, "titleManageStock"],
  [/^\/blood-banks\/[^/]+/, "titleBank"],
  [/^\/blood-banks/, "titleBanks"],
  [/^\/eligibility/, "titleEligibility"],
  [/^\/leaderboard/, "titleLeaderboard"],
  [/^\/complaints/, "titleComplaints"],
  [/^\/login/, "titleLogin"],
  [/^\/register/, "titleRegister"],
  [/^\/forgot-password|^\/reset-password/, "titleReset"],
  [/^\/verify-email/, "titleVerify"],
  [/^\/add-phone/, "titleAddPhone"],
  [/^\/dashboard/, "titleDashboard"],
  [/^\/donor-profile/, "titleDonorProfile"],
  [/^\/notifications/, "titleNotifications"],
  [/^\/settings/, "titleSettings"],
  [/^\/messages/, "titleMessages"],
  [/^\/admin/, "titleAdmin"],
  [/^\/bank-portal\/register/, "titleRegisterBank"],
  [/^\/bank-portal/, "titleBankPortal"],
];

export default function Layout() {
  const { pathname } = useLocation();
  const { t } = useT(layout);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  // Re-runs when the language changes, so the tab title switches too
  useEffect(() => {
    const match = TITLES.find(([re]) => re.test(pathname));
    if (!match) document.title = `${t("titleNotFound")} | RoktoLagbe`;
    else document.title = match[2] ? t(match[1]) : `${t(match[1])} | RoktoLagbe`;
  }, [pathname, t]);

  return (
    <div className="flex min-h-screen flex-col bg-surface text-gray-800">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand-blue focus:shadow-lg"
      >
        {t("skip")}
      </a>
      <Navbar />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      {!pathname.startsWith("/messages") && <Footer />}
      {!pathname.startsWith("/messages") && <AssistantWidget />}
      <SessionTimeout />
    </div>
  );
}
