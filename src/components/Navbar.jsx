import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, X, LogOut, LayoutDashboard } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo.jpeg";

const links = [
  { to: "/", label: "Home" },
  { to: "/donors", label: "Find Donors" },
  { to: "/requests", label: "Blood Requests" },
  { to: "/blood-banks", label: "Blood Banks" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const firstName = user?.name?.split(" ")[0] || "Account";

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate("/");
  };

  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition ${
      isActive
        ? "text-brand-red bg-red-50"
        : "text-gray-600 hover:text-brand-red hover:bg-red-50"
    }`;

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-red-100">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img
            src={logo}
            alt="RoktoLagbe logo"
            className="h-10 w-10 rounded-full object-cover"
          />
          <span className="text-xl font-bold text-brand-red">
            Rokto<span className="text-brand-blue">Lagbe</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === "/"} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-brand-blue hover:bg-blue-50 rounded-lg transition"
              >
                <LayoutDashboard size={18} />
                {firstName}
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-4 py-2 text-sm font-semibold text-white bg-brand-red hover:bg-brand-red-dark rounded-lg transition"
              >
                <LogOut size={16} />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-medium text-brand-blue hover:bg-blue-50 rounded-lg transition"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 text-sm font-semibold text-white bg-brand-red hover:bg-brand-red-dark rounded-lg transition"
              >
                Become a Donor
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden p-2 text-gray-700"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-red-100 bg-white px-4 py-3 flex flex-col gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={linkClass}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </NavLink>
          ))}

          {user ? (
            <>
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-sm font-medium text-brand-blue"
              >
                My Dashboard ({firstName})
              </Link>
              <button
                onClick={handleLogout}
                className="mt-1 px-4 py-2 text-center text-sm font-semibold text-white bg-brand-red rounded-lg"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-sm font-medium text-brand-blue"
              >
                Login
              </Link>
              <Link
                to="/register"
                onClick={() => setOpen(false)}
                className="mt-1 px-4 py-2 text-center text-sm font-semibold text-white bg-brand-red rounded-lg"
              >
                Become a Donor
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}