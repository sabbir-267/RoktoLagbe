import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import useT from "../i18n/useT";
import dict from "../i18n/auth";

export default function FormField({ label, error, hint, type = "text", ...inputProps }) {
  const [show, setShow] = useState(false);
  const { t } = useT(dict);
  const isPassword = type === "password";

  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>

      <div className="relative mt-1">
        <input
          {...inputProps}
          type={isPassword && show ? "text" : type}
          className={`w-full rounded-lg border bg-white px-3 py-2.5 outline-none transition focus:ring-2 ${
            isPassword ? "pr-11" : ""
          } ${
            error
              ? "border-red-400 focus:ring-red-200"
              : "border-gray-300 focus:border-brand-blue focus:ring-blue-200"
          }`}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? t("hidePassword") : t("showPassword")}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 transition hover:text-brand-blue"
          >
            {show ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>

      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-gray-400">{hint}</span>
      ) : null}
    </label>
  );
}