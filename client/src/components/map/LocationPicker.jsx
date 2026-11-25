import { useEffect, useMemo, useState } from "react";
import { Circle, Marker, useMapEvents } from "react-leaflet";
import { Crosshair, Search, X, MapPin, Loader2, AlertTriangle } from "lucide-react";
import BaseMap, { FlyTo } from "./BaseMap";
import { pinIcon } from "./icons";
import { isPoint, roundPoint, geoProblem, geoErrorKey } from "./geo";
import { searchPlaces, reverseGeocode } from "./nominatim";
import useT from "../../i18n/useT";
import mapDict from "../../i18n/map";

const REVERSE_DELAY_MS = 1200;

function ClickToPlace({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng) });
  return null;
}

/**
 * Pick a point on a map.
 * value: { lat, lng } | null, onChange(point | null)
 * Everything here is type="button", so it is safe inside another <form>.
 */
export default function LocationPicker({ value, onChange, height = 280, label, hint }) {
  const { t, lang, locale } = useT(mapDict);
  const point = isPoint(value) ? value : null;
  const pointKey = point ? `${point.lat.toFixed(5)},${point.lng.toFixed(5)}` : "";

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState({ busy: false, results: null, message: "" });
  const [locating, setLocating] = useState(false);
  const [geoMsg, setGeoMsg] = useState("");
  const [accuracy, setAccuracy] = useState(null); // { key, metres } from the last GPS fix
  const [fly, setFly] = useState({ key: 0, point: null });
  const [address, setAddress] = useState({ key: "", text: "" });

  const coordFmt = useMemo(
    () => new Intl.NumberFormat(locale, { minimumFractionDigits: 5, maximumFractionDigits: 5 }),
    [locale]
  );

  // Reverse lookup only after the pin has rested for a moment (and the queue keeps ≥1.2 s gaps)
  useEffect(() => {
    if (!point) return undefined;
    let cancelled = false;
    const key = `${lang}|${pointKey}`;
    const timer = setTimeout(() => {
      reverseGeocode(point, lang).then((text) => {
        if (!cancelled) setAddress({ key, text });
      });
    }, REVERSE_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // point is described completely by pointKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointKey, lang]);

  const pick = (p, { flyTo = false, acc = null } = {}) => {
    const next = roundPoint({ lat: p.lat, lng: p.lng });
    onChange(next);
    setAccuracy(acc ? { key: `${next.lat.toFixed(5)},${next.lng.toFixed(5)}`, metres: acc } : null);
    if (flyTo) setFly((f) => ({ key: f.key + 1, point: next }));
  };

  function locateMe() {
    const problem = geoProblem();
    if (problem) {
      setGeoMsg(t(problem === "insecure" ? "geoInsecure" : "geoUnsupported"));
      return;
    }
    setGeoMsg("");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        pick({ lat: pos.coords.latitude, lng: pos.coords.longitude }, { flyTo: true, acc: pos.coords.accuracy });
      },
      (err) => {
        setLocating(false);
        setGeoMsg(t(geoErrorKey(err)));
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
  }

  async function runSearch() {
    const q = query.trim();
    if (q.length < 3) {
      setSearch({ busy: false, results: null, message: t("searchTooShort") });
      return;
    }
    setSearch({ busy: true, results: null, message: "" });
    const results = await searchPlaces(q, lang);
    if (results === null) setSearch({ busy: false, results: null, message: t("searchFailed") });
    else if (!results.length) setSearch({ busy: false, results: null, message: t("searchNone") });
    else setSearch({ busy: false, results, message: "" });
  }

  const showAccuracy = point && accuracy && accuracy.key === pointKey && accuracy.metres > 0;
  const addressText = point && address.key === `${lang}|${pointKey}` ? address.text : "";

  return (
    <div className="space-y-3">
      {label && <p className="text-sm font-medium text-gray-700">{label}</p>}
      {hint && <p className="-mt-2 text-xs text-gray-500">{hint}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          className="inline-flex items-center gap-2 rounded-lg border border-brand-blue/30 bg-white px-3 py-2 text-sm font-semibold text-brand-blue transition hover:bg-blue-50 disabled:opacity-60"
        >
          {locating ? <Loader2 size={16} className="animate-spin" /> : <Crosshair size={16} />}
          {locating ? t("locating") : t("useMyLocation")}
        </button>
        {point && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setAccuracy(null);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            <X size={16} />
            {t("clear")}
          </button>
        )}
      </div>

      {geoMsg && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {geoMsg}
        </p>
      )}

      <div>
        <div className="flex gap-2">
          <input
            type="search"
            value={query}
            aria-label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // never submit the surrounding form
                runSearch();
              }
            }}
            maxLength={150}
            className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-200"
          />
          <button
            type="button"
            onClick={runSearch}
            disabled={search.busy}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-blue-dark disabled:opacity-60"
          >
            {search.busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            <span className="hidden sm:inline">{t("search")}</span>
            <span className="sr-only sm:hidden">{t("search")}</span>
          </button>
        </div>
        <div aria-live="polite">
          {search.message && <p className="mt-2 text-xs text-gray-500">{search.message}</p>}
          {search.results && (
            <ul className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
              {search.results.map((r) => (
                <li key={`${r.lat},${r.lng}`}>
                  <button
                    type="button"
                    onClick={() => {
                      pick(r, { flyTo: true });
                      setSearch({ busy: false, results: null, message: "" });
                    }}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50"
                  >
                    <MapPin size={15} className="mt-0.5 shrink-0 text-brand-red" />
                    <span className="min-w-0 break-words">{r.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <BaseMap center={point} zoom={point ? 15 : 11} height={height} label={t("pickerMapLabel")}>
        <ClickToPlace onPick={(p) => pick(p)} />
        <FlyTo point={fly.point} flyKey={fly.key} />
        {showAccuracy && (
          <Circle
            center={[point.lat, point.lng]}
            radius={accuracy.metres}
            pathOptions={{ color: "#1d6fd8", weight: 1, fillOpacity: 0.12 }}
          />
        )}
        {point && (
          <Marker
            position={[point.lat, point.lng]}
            icon={pinIcon}
            draggable
            keyboard={false}
            eventHandlers={{ dragend: (e) => pick(e.target.getLatLng()) }}
          />
        )}
      </BaseMap>

      <div className="text-xs text-gray-500" aria-live="polite">
        {point ? (
          <>
            <p className="break-words text-gray-700">{addressText || t("pinnedAt")}</p>
            <p className="mt-0.5">
              {coordFmt.format(point.lat)}, {coordFmt.format(point.lng)}
              {showAccuracy && ` · ${t("accuracy", { m: Math.round(accuracy.metres) })}`}
            </p>
          </>
        ) : (
          <p>{t("pickerEmpty")}</p>
        )}
      </div>
    </div>
  );
}
