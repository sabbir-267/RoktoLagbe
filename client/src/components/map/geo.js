// Small geometry + formatting helpers shared by the map components.
// Points are always { lat, lng } in the UI; the API sends GeoJSON [lng, lat].

export const DHAKA = { lat: 23.8103, lng: 90.4125 };

// Same numbers the server uses for its ETA estimate (straight line × 1.35 at ~18 km/h)
const ROAD_FACTOR = 1.35;
const AVG_KMH = 18;

export const isPoint = (p) => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

// [lng, lat] -> { lat, lng } (null when missing or malformed)
export function fromLngLat(coords) {
  if (!Array.isArray(coords) || coords.length !== 2) return null;
  const p = { lat: Number(coords[1]), lng: Number(coords[0]) };
  return isPoint(p) ? p : null;
}

// { lat, lng } numbers from anything that has them (TripView, Nominatim, Leaflet LatLng)
export function toPoint(obj) {
  if (!obj) return null;
  const p = { lat: Number(obj.lat), lng: Number(obj.lng ?? obj.lon) };
  return isPoint(p) ? p : null;
}

// 6 decimals is ~10 cm: plenty, and keeps payloads tidy
export const roundPoint = (p) => ({ lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 });

export function haversineKm(a, b) {
  if (!isPoint(a) || !isPoint(b)) return null;
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const etaMinutesFor = (km) => (km == null ? null : Math.round(((km * ROAD_FACTOR) / AVG_KMH) * 60));

// Formatting needs t() and n() from useT(map)
export function formatDistance(km, t, n) {
  if (km == null || !Number.isFinite(Number(km))) return "";
  const v = Number(km);
  if (v < 1) return t("distM", { m: n(Math.max(10, Math.round((v * 1000) / 10) * 10)) });
  return t("distKm", { km: n(v < 10 ? Math.round(v * 10) / 10 : Math.round(v)) });
}

export function formatEta(minutes, t, n) {
  if (minutes == null || !Number.isFinite(Number(minutes))) return "";
  const m = Math.max(0, Math.round(Number(minutes)));
  if (m < 1) return t("etaNow");
  if (m < 60) return t("etaMin", { m: n(m) });
  return t("etaHour", { h: n(Math.floor(m / 60)), m: n(m % 60) });
}

export function formatAgo(value, now, t, date) {
  if (!value) return "";
  const diff = Math.max(0, now - new Date(value).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return t("justNow");
  if (min < 60) return t("minAgo", { count: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t("hourAgo", { count: h });
  return date(value, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

// Why geolocation can't run here, or null when it can
export function geoProblem() {
  if (typeof navigator === "undefined" || !navigator.geolocation) return "unsupported";
  if (typeof window !== "undefined" && window.isSecureContext === false) return "insecure";
  return null;
}

// GeolocationPositionError code -> message key
export const geoErrorKey = (err) =>
  err?.code === 1 ? "geoDenied" : err?.code === 3 ? "geoTimeout" : "geoUnavailable";
