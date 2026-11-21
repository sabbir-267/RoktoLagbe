// server/src/services/matchScoring.js
//
// Pure functions (no database, no network) that score and rank donors for a
// blood request. Every point has a human-readable reason, so a ranking can
// always be explained.
//
// Score parts (max 95 with coordinates, 70 without):
//   blood group   exact 30 / compatible 15
//   same district 25
//   distance      <=5 km 25, <=15 km 18, <=40 km 10, <=100 km 4 (only if both have coordinates)
//   verified      10
//   experience    1 per previous donation, up to 5

const EARTH_KM = 6371;
const rad = (d) => (d * Math.PI) / 180;

const validPoint = (p) => Array.isArray(p) && p.length === 2 && p.every((n) => Number.isFinite(n));

// coordinates are GeoJSON order: [longitude, latitude]
export const distanceKm = (a, b) => {
  if (!validPoint(a) || !validPoint(b)) return null;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
};

const sameText = (a, b) =>
  typeof a === "string" && typeof b === "string" && a.trim().toLowerCase() === b.trim().toLowerCase();

export const scoreDonor = (request, donor) => {
  let score = 0;
  const reasons = [];

  if (donor.bloodGroup === request.bloodGroup) {
    score += 30;
    reasons.push("Exact blood group match");
  } else {
    score += 15;
    reasons.push("Compatible blood group");
  }

  if (sameText(donor.district, request.district)) {
    score += 25;
    reasons.push("Same district");
  }

  const km = distanceKm(request.location?.coordinates, donor.location?.coordinates);
  if (km !== null) {
    score += km <= 5 ? 25 : km <= 15 ? 18 : km <= 40 ? 10 : km <= 100 ? 4 : 0;
    reasons.push(`About ${km < 10 ? km.toFixed(1) : Math.round(km)} km away`);
  }

  if (donor.isVerified) {
    score += 10;
    reasons.push("Verified donor");
  }

  const donations = Math.max(Number(donor.totalDonations) || 0, 0);
  if (donations > 0) {
    score += Math.min(donations, 5);
    reasons.push(`${donations} previous donation${donations === 1 ? "" : "s"}`);
  }

  return { score, reasons, distanceKm: km === null ? undefined : Math.round(km * 10) / 10 };
};

const lastDonationTime = (d) => (d.lastDonationDate ? new Date(d.lastDonationDate).getTime() : 0);

// Highest score first. Ties: verified first, then the donor who has gone longest
// without donating, then id (so the order is always the same for the same data).
export const rankDonors = (request, donors) =>
  donors
    .map((donor) => ({ donor, ...scoreDonor(request, donor) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(!!b.donor.isVerified) - Number(!!a.donor.isVerified) ||
        lastDonationTime(a.donor) - lastDonationTime(b.donor) ||
        String(a.donor._id).localeCompare(String(b.donor._id))
    );