export default function PagePlaceholder({ title }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-brand-blue">{title}</h1>
      <p className="mt-2 text-gray-500">This page is coming soon.</p>
    </div>
  );
}