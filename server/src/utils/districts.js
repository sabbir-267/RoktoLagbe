// server/src/utils/districts.js
// Canonical English district names, so Bangla / Banglish / alternate spellings
// all end up matching what donors and requests are stored with.

export const DISTRICTS = [
  // Dhaka
  "Dhaka", "Faridpur", "Gazipur", "Gopalganj", "Kishoreganj", "Madaripur", "Manikganj",
  "Munshiganj", "Narayanganj", "Narsingdi", "Rajbari", "Shariatpur", "Tangail",
  // Chattogram
  "Bandarban", "Brahmanbaria", "Chandpur", "Chattogram", "Cumilla", "Cox's Bazar", "Feni",
  "Khagrachhari", "Lakshmipur", "Noakhali", "Rangamati",
  // Rajshahi
  "Bogura", "Joypurhat", "Naogaon", "Natore", "Chapainawabganj", "Pabna", "Rajshahi", "Sirajganj",
  // Khulna
  "Bagerhat", "Chuadanga", "Jashore", "Jhenaidah", "Khulna", "Kushtia", "Magura", "Meherpur",
  "Narail", "Satkhira",
  // Barishal
  "Barguna", "Barishal", "Bhola", "Jhalokati", "Patuakhali", "Pirojpur",
  // Sylhet
  "Habiganj", "Moulvibazar", "Sunamganj", "Sylhet",
  // Rangpur
  "Dinajpur", "Gaibandha", "Kurigram", "Lalmonirhat", "Nilphamari", "Panchagarh", "Rangpur", "Thakurgaon",
  // Mymensingh
  "Jamalpur", "Mymensingh", "Netrokona", "Sherpur",
];

// letters only, lower case: "Cox's Bazar" → "coxsbazar"
const key = (s) => String(s ?? "").toLowerCase().replace(/[^a-z]/g, "");

// alias keys are already in normalised form
const ALIASES = {
  chittagong: "Chattogram",
  comilla: "Cumilla",
  jessore: "Jashore",
  bogra: "Bogura",
  barisal: "Barishal",
  coxbazar: "Cox's Bazar",
  jhalakathi: "Jhalokati",
  jhalokathi: "Jhalokati",
  maulvibazar: "Moulvibazar",
  netrakona: "Netrokona",
  khagrachari: "Khagrachhari",
  nawabganj: "Chapainawabganj",
  narayangonj: "Narayanganj",
  gopalgonj: "Gopalganj",
  munshigonj: "Munshiganj",
  kishorganj: "Kishoreganj",
  lakshmipur: "Lakshmipur",
  laxmipur: "Lakshmipur",
  moulvibazar: "Moulvibazar",
};

const LOOKUP = new Map(DISTRICTS.map((d) => [key(d), d]));
for (const [alias, canonical] of Object.entries(ALIASES)) LOOKUP.set(alias, canonical);

// Returns the canonical name, or undefined if not recognised
export const canonicalDistrict = (value) => LOOKUP.get(key(value));