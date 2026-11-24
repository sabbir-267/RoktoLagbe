import { useState } from "react";
import { Search } from "lucide-react";

// Searches on Enter or on the button, so every keystroke doesn't hit the API
export default function SearchBox({ placeholder, onSearch, label = "Search" }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="block"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(value.trim());
      }}
    >
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="mt-1 flex">
        <input
          type="search"
          value={value}
          placeholder={placeholder}
          maxLength={80}
          onChange={(e) => {
            setValue(e.target.value);
            if (!e.target.value) onSearch(""); // clearing the box resets the list
          }}
          className="w-full rounded-l-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-brand-blue focus:ring-2 focus:ring-blue-200"
        />
        <button
          type="submit"
          aria-label="Search"
          className="rounded-r-lg bg-brand-blue px-4 text-white transition hover:bg-brand-blue-dark"
        >
          <Search size={18} />
        </button>
      </div>
    </form>
  );
}
