import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-brand-blue-dark text-blue-100">
      <div className="mx-auto max-w-6xl px-4 py-10 grid gap-8 md:grid-cols-3">
        <div>
          <h3 className="text-xl font-bold text-white">
            Rokto<span className="text-red-300">Lagbe</span>
          </h3>
          <p className="mt-2 text-sm">Donate Blood. Save Lives.</p>
        </div>

        <div>
          <h4 className="font-semibold text-white">Quick Links</h4>
          <ul className="mt-2 space-y-1 text-sm">
            <li><Link to="/donors" className="hover:text-white">Find Donors</Link></li>
            <li><Link to="/requests" className="hover:text-white">Blood Requests</Link></li>
            <li><Link to="/blood-banks" className="hover:text-white">Blood Banks</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-white">Account</h4>
          <ul className="mt-2 space-y-1 text-sm">
            <li><Link to="/login" className="hover:text-white">Login</Link></li>
            <li><Link to="/register" className="hover:text-white">Become a Donor</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-blue-800 py-4 px-4 text-center text-xs">
        <p>A Sister Concern of Bondhu Britto Foundation (BBF)</p>
        <p className="mt-1">© {new Date().getFullYear()} RoktoLagbe. All rights reserved.</p>
      </div>
    </footer>
  );
}