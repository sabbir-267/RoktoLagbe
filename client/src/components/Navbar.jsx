import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Menu, X, LogOut, LayoutDashboard, ShieldCheck, Building2, HeartPulse, Settings, ChevronDown, MessageCircle, MessageSquareWarning, Stethoscope,
} from "lucide-react";
import useT from "../i18n/useT";
import layout from "../i18n/layout";
import LanguageSwitcher from "./LanguageSwitcher";
import { useMessages } from "../context/MessagesContext";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";
import logo from "../assets/logo.jpeg";

const LINKS = [
  { to: "/donors", key: "navDonors" },
  { to: "/requests", key: "navRequests" },
  { to: "/blood-banks", key: "navBanks" },
  { to: "/leaderboard", key: "navLeaderboard" },
  { to: "/doctors", key: "navDoctors" },
];

const ROLE_KEY = { user: "roleUser", bank_staff: "roleStaff", admin: "roleAdmin", doctor: "roleDoctor" };

function Avatar({ user, size = "h-8 w-8 text-sm" }) {
  if (user.avatar) {
    return <img src={user.avatar} alt="" referrerPolicy="no-referrer" className={`${size} rounded-full object-cover`} />;
  }
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <span className={`${size} flex items-center justify-center rounded-full bg-brand-red font-semibold text-white`}>
      {initials || "?"}
    </span>
  );
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const { user, loading: authLoading, logout } = useAuth();
  const { t } = useT(layout);
  const links = LINKS.map((l) => ({ to: l.to, label: t(l.key) }));
  const roleLabel = (role) => (ROLE_KEY[role] ? t(ROLE_KEY[role]) : role);
  const { unreadCount: unreadMessages } = useMessages();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Close menus whenever the page changes
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMobileOpen(false);
    setMenuOpen(false);
  }

  // Close the account menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const portal =
    user?.role === "admin"
      ? { to: "/admin", label: t("adminPortal"), icon: ShieldCheck }
      : user?.role === "bank_staff"
        ? { to: "/bank-portal", label: t("bankPortal"), icon: Building2 }
        : user?.role === "doctor"
          ? { to: "/doctor-portal", label: t("doctorPortal"), icon: Stethoscope }
          : null;

  const accountLinks = user
    ? [
        ...(portal ? [portal] : []),
        { to: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
        { to: "/donor-profile", label: t("donorProfile"), icon: HeartPulse },
        { to: "/consultations", label: t("myQuestions"), icon: Stethoscope },
        { to: "/settings", label: t("settings"), icon: Settings },
        { to: "/complaints", label: t("complaints"), icon: MessageSquareWarning },
      ]
    : [];

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    setMobileOpen(false);
    navigate("/");
  };

  const linkClass = ({ isActive }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive ? "text-brand-red" : "text-gray-600 hover:text-gray-900"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label={t("home")}>
          <img src={logo} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-gray-200" />
          <span className="text-lg font-extrabold tracking-tight text-brand-red">
            Rokto<span className="text-brand-blue">Lagbe</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 xl:flex" aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          {user && (
            <Link to="/requests/new" className="btn-primary mr-1 hidden px-4 py-2 sm:inline-flex">
              {t("requestBlood")}
            </Link>
          )}
          <LanguageSwitcher className="hidden sm:inline-flex" />
          {user && (
            <Link
              to="/messages"
              aria-label={unreadMessages ? t("messagesUnread", { count: unreadMessages }) : t("messages")}
              className="relative rounded-lg p-2 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            >
              <MessageCircle size={22} />
              {unreadMessages > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white">
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </Link>
          )}
          {user && <NotificationBell />}

          {user ? (
            <div className="relative hidden xl:block" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-gray-100"
              >
                <Avatar user={user} />
                <ChevronDown size={16} className={`text-gray-500 transition ${menuOpen ? "rotate-180" : ""}`} />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg ring-1 ring-black/5"
                >
                  <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
                    <Avatar user={user} size="h-10 w-10 text-base" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{user.name}</p>
                      <p className="truncate text-xs text-gray-500">{roleLabel(user.role)}</p>
                    </div>
                  </div>
                  <div className="py-1">
                    {accountLinks.map(({ to, label, icon: Icon }) => (
                      <Link
                        key={to}
                        to={to}
                        role="menuitem"
                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50 hover:text-gray-900"
                      >
                        <Icon size={16} className="text-gray-400" />
                        {label}
                      </Link>
                    ))}
                  </div>
                  <div className="border-t border-gray-100 py-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50"
                    >
                      <LogOut size={16} />
                      {t("common:logout")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Guests always see Log in in the header, on every screen size (not only inside the menu).
            // Hidden while the saved session is still being checked, so logged-in users don't see it flash.
            !authLoading && (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 sm:border-transparent sm:px-4 sm:py-2"
                >
                  {t("common:login")}
                </Link>
                <Link to="/register" className="btn-primary hidden px-4 py-2 sm:inline-flex">
                  {t("common:register")}
                </Link>
              </div>
            )
          )}

          <button
            type="button"
            className="rounded-lg p-2 text-gray-700 transition hover:bg-gray-100 xl:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-gray-100 bg-white px-4 pb-4 pt-2 xl:hidden">
          {user && (
            <div className="flex items-center gap-3 border-b border-gray-100 py-3">
              <Avatar user={user} size="h-10 w-10 text-base" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">{user.name}</p>
                <p className="truncate text-xs text-gray-500">{roleLabel(user.role)}</p>
              </div>
            </div>
          )}
          <LanguageSwitcher className="mt-3 sm:hidden" />
          <nav className="flex flex-col py-2" aria-label="Mobile">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={linkClass}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          {user ? (
            <>
              <div className="flex flex-col border-t border-gray-100 py-2">
                {accountLinks.map(({ to, label, icon: Icon }) => (
                  <Link key={to} to={to} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <Icon size={16} className="text-gray-400" />
                    {label}
                  </Link>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Link to="/requests/new" className="btn-primary">
                  {t("requestBlood")}
                </Link>
                <button type="button" onClick={handleLogout} className="btn-secondary text-red-600">
                  <LogOut size={16} /> {t("common:logout")}
                </button>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
              <Link to="/login" className="btn-secondary">
                {t("common:login")}
              </Link>
              <Link to="/register" className="btn-primary">
                {t("common:register")}
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
