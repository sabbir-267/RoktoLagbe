export default function Spinner({ className = "py-24" }) {
  return (
    <div className={`flex justify-center ${className}`}>
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-100 border-t-brand-red" />
    </div>
  );
}