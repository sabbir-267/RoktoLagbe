export default function SelectField({ label, error, hint, children, ...props }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <select
        {...props}
        className={`mt-1 w-full rounded-lg border bg-white px-3 py-2.5 outline-none transition focus:ring-2 disabled:bg-gray-100 disabled:text-gray-500 ${
          error
            ? "border-red-400 focus:ring-red-200"
            : "border-gray-300 focus:border-brand-blue focus:ring-blue-200"
        }`}
      >
        {children}
      </select>
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-gray-400">{hint}</span>
      ) : null}
    </label>
  );
}