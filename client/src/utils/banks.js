import { BLOOD_GROUPS } from "../data/bangladesh";

// At or below this many units, a blood group is shown as "Low". Adjust to taste.
export const LOW_STOCK = 5;

export function stockLevel(units) {
  if (units <= 0) return "out";
  if (units <= LOW_STOCK) return "low";
  return "ok";
}

export function normalizeBank(raw) {
  if (!raw) return null;
  // The backend sends GeoJSON order: [longitude, latitude]
  const [lng, lat] = Array.isArray(raw.coordinates) ? raw.coordinates : [];
  return {
    id: raw.id || raw._id,
    name: raw.name || "Blood bank",
    licenseNo: raw.licenseNo || "",
    phone: raw.phone || "",
    email: raw.email || "",
    division: raw.division || "",
    district: raw.district || "",
    address: raw.address || "",
    openingHours: raw.openingHours || "",
    is24Hours: Boolean(raw.is24Hours),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

// Opens Google Maps at the saved coordinates, or searches by name and address
export function directionsUrl(bank) {
  const query =
    bank.lat !== null && bank.lng !== null
      ? `${bank.lat},${bank.lng}`
      : [bank.name, bank.address, bank.district, "Bangladesh"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Adds up units however they are nested: a number, { units }, a list of batches...
function sumUnits(v) {
  if (v == null) return 0;
  if (typeof v === "number" || typeof v === "string") return toNumber(v);
  if (Array.isArray(v)) return v.reduce((sum, x) => sum + sumUnits(x), 0);
  if (typeof v === "object") {
    for (const k of ["units", "totalUnits", "total"]) {
      if (k in v) return sumUnits(v[k]);
    }
    return Object.values(v).reduce((sum, x) => sum + sumUnits(x), 0);
  }
  return 0;
}

// Turns the backend's stock summary into { "A+": 12, "A-": 0, ... } for all 8 groups.
// The exact shape is a guess, so several are accepted. If none matches, a warning
// with the real data is printed to the browser console.
export function normalizeStock(stock) {
  const totals = Object.fromEntries(BLOOD_GROUPS.map((g) => [g, 0]));
  let recognized = false;

  const add = (group, value) => {
    if (group in totals) {
      totals[group] += sumUnits(value);
      recognized = true;
    }
  };

  if (Array.isArray(stock)) {
    stock.forEach((item) => {
      const group =
        item?.bloodGroup ||
        item?._id?.bloodGroup ||
        (typeof item?._id === "string" ? item._id : "");
      add(group, item);
    });
  } else if (stock && typeof stock === "object") {
    const source = stock.byBloodGroup || stock.bloodGroups || stock.groups || stock;
    Object.entries(source).forEach(([group, value]) => add(group, value));
  }

  if (!recognized && stock != null && sumUnits(stock) !== 0) {
    console.warn("Unexpected stock shape:", stock);
  }
  return totals;
}