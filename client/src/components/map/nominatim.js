// OpenStreetMap Nominatim (free). Their usage policy allows ~1 request per second and
// forbids per-keystroke autocomplete, so every call goes through one queue that keeps
// calls at least 1.2 s apart, and searches only run when the person presses the button.
// Failures are quiet: search returns null, reverse returns "".

const BASE = "https://nominatim.openstreetmap.org";
const GAP_MS = 1200;

let lastCall = 0;
let queue = Promise.resolve();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function schedule(task) {
  const run = queue.then(async () => {
    const wait = lastCall + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    return task();
  });
  queue = run.catch(() => {});
  return run;
}

async function getJson(path, params) {
  const url = `${BASE}${path}?${new URLSearchParams({ format: "jsonv2", ...params })}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return res.json();
}

const reverseCache = new Map();

// -> [{ lat, lng, label }] or null if the service failed
export async function searchPlaces(query, lang = "en") {
  const q = String(query || "").trim();
  if (q.length < 3) return [];
  try {
    const rows = await schedule(() =>
      getJson("/search", { q, countrycodes: "bd", limit: "5", "accept-language": lang })
    );
    return (Array.isArray(rows) ? rows : [])
      .map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), label: r.display_name || r.name || "" }))
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
  } catch {
    return null;
  }
}

// -> address text, or "" when unknown / failed
export async function reverseGeocode(point, lang = "en") {
  const key = `${lang}|${point.lat.toFixed(5)}|${point.lng.toFixed(5)}`;
  if (reverseCache.has(key)) return reverseCache.get(key);
  try {
    const data = await schedule(() =>
      getJson("/reverse", { lat: String(point.lat), lon: String(point.lng), zoom: "18", "accept-language": lang })
    );
    const text = data?.display_name || "";
    if (reverseCache.size > 200) reverseCache.clear();
    reverseCache.set(key, text);
    return text;
  } catch {
    return "";
  }
}
