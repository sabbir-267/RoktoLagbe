import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24 text-center">
      <p className="text-6xl font-extrabold text-brand-red">404</p>
      <h1 className="mt-3 text-2xl font-bold text-brand-blue">Page not found</h1>
      <p className="mt-2 text-gray-500">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-lg bg-brand-red px-6 py-3 font-semibold text-white transition hover:bg-brand-red-dark"
      >
        Back to Home
      </Link>
    </div>
  );
}