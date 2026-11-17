import { useNavigate } from "react-router-dom";

const groups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function BloodGroupPicker() {
  const navigate = useNavigate();

  return (
    <div className="rounded-2xl bg-white p-6 shadow-xl">
      <h2 className="text-lg font-bold text-brand-blue">Need blood? Pick a group</h2>
      <p className="mt-1 text-sm text-gray-500">
        Tap a blood group to see matching donors.
      </p>

      <div className="mt-4 grid grid-cols-4 gap-3">
        {groups.map((g) => (
          <button
            key={g}
            onClick={() => navigate(`/donors?bloodGroup=${encodeURIComponent(g)}`)}
            className="rounded-xl border-2 border-red-100 py-3 text-lg font-bold text-brand-red transition hover:border-brand-red hover:bg-brand-red hover:text-white"
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  );
}