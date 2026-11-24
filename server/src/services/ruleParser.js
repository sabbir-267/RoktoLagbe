// server/src/services/ruleParser.js
//
// Free, offline alternative to the AI parser. It uses patterns and word lists to pull
// the details out of a blood request written in Bangla, English or Banglish, and
// returns the same raw shape the AI does, so sanitizeParsed validates both the same way.
// It is deliberately cautious: when something is unclear it leaves the field empty.

import { DISTRICTS } from "../utils/districts.js";
import { sanitizeParsed } from "./sanitizeParsed.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const BD_OFFSET = 6 * HOUR; // Bangladesh is UTC+6 all year

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const toLatinDigits = (s) => s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Bangla letters are not \w in JS, so word edges are spelled out. Vowel signs (া ি ে …)
// are "marks" (\p{M}), so they count as part of a word too: "কাল" must not match inside "বিকাল".
const NOT_WORD_BEFORE = "(?<![\\p{L}\\p{M}\\p{N}])";
const NOT_WORD_AFTER = "(?![\\p{L}\\p{M}\\p{N}])";

// Text and patterns are both NFC-normalised, so letters like য় compare equal however they were typed
const rx = (source, flags = "iu") => new RegExp(source.normalize("NFC"), flags.includes("u") ? flags : `${flags}u`);
const word = (alternatives) => `${NOT_WORD_BEFORE}(?:${alternatives})${NOT_WORD_AFTER}`;

// ---------- Blood group ----------

const POS = "\\+\\s*ve|\\+|positive|pos|pozitive|pojitive|pojetive|পজিটিভ|পজেটিভ|পসিটিভ|পজেটিব";
const NEG = "-\\s*ve|-|–|−|negative|neg|negetive|nagetive|নেগেটিভ|নেগাটিভ|নেগেটিব";
const LETTER = {
  ab: "AB", a: "A", b: "B", o: "O",
  "এবি": "AB", "এ": "A", "বি": "B", "ও": "O",
};
const GROUP_RE = rx(
  `${NOT_WORD_BEFORE}(ab|a|b|o|এবি|এ|বি|ও)\\s*(?:\\(\\s*)?(${POS}|${NEG})(?:\\s*\\))?(?![\\p{L}\\p{M}\\p{N}+-])`,
  "giu"
);

export const findBloodGroup = (text) => {
  for (const m of text.matchAll(GROUP_RE)) {
    const letter = LETTER[m[1].toLowerCase()];
    const sign = rx(`^(?:${POS})$`, "iu").test(m[2].trim()) ? "+" : "-";
    // "a-" inside ordinary words is excluded by the edges above; a lone "a +" next to digits is noise
    if (letter) return `${letter}${sign}`;
  }
  return undefined;
};

// ---------- Units ----------

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  ek: 1, dui: 2, tin: 3, char: 4, pach: 5, panch: 5,
  "এক": 1, "দুই": 2, "দু": 2, "তিন": 3, "চার": 4, "পাঁচ": 5, "ছয়": 6,
};
const UNIT_WORDS = "bags?|units?|bottles?|ব্যাগ|ইউনিট|বোতল";
const UNITS_RE = rx(
  `${NOT_WORD_BEFORE}(\\d{1,2}|${Object.keys(NUMBER_WORDS).join("|")})\\s*(?:টি|টা|ti|ta)?\\s*(?:${UNIT_WORDS})`,
  "iu"
);

const findUnits = (text) => {
  const m = text.match(UNITS_RE);
  if (!m) return undefined;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS[m[1].toLowerCase()];
  return Number.isInteger(n) && n >= 1 && n <= 20 ? n : undefined;
};

// ---------- Component ----------

const COMPONENT_PATTERNS = [
  ["platelets", "platelets?|প্লাটিলেট|প্লেটলেট|প্লাটিলেইট|platilet"],
  ["plasma", "plasma|ffp|প্লাজমা"],
  ["red_cells", "packed\\s*(?:red\\s*)?cells?|red\\s*cells?|rbc|prbc|পিআরবিসি|প্যাকড সেল"],
];
const findComponent = (text) =>
  COMPONENT_PATTERNS.find(([, p]) => rx(word(p), "iu").test(text))?.[0];

// ---------- Phone ----------

const findPhone = (text) => {
  for (const m of text.matchAll(/(?:\+?88)?[\s-]?0?1[3-9](?:[\s-]?\d){8}/g)) {
    let digits = m[0].replace(/\D/g, "");
    if (digits.startsWith("880")) digits = "0" + digits.slice(3);
    else if (digits.startsWith("88")) digits = digits.slice(2);
    if (!digits.startsWith("0")) digits = "0" + digits;
    if (/^01[3-9]\d{8}$/.test(digits)) return digits;
  }
  return undefined;
};

// ---------- District ----------

const BN_DISTRICTS = {
  Dhaka: "ঢাকা", Faridpur: "ফরিদপুর", Gazipur: "গাজীপুর|গাজিপুর", Gopalganj: "গোপালগঞ্জ",
  Kishoreganj: "কিশোরগঞ্জ", Madaripur: "মাদারীপুর|মাদারিপুর", Manikganj: "মানিকগঞ্জ",
  Munshiganj: "মুন্সীগঞ্জ|মুন্সিগঞ্জ", Narayanganj: "নারায়ণগঞ্জ|নারায়নগঞ্জ", Narsingdi: "নরসিংদী|নরসিংদি",
  Rajbari: "রাজবাড়ী|রাজবাড়ি", Shariatpur: "শরীয়তপুর|শরিয়তপুর", Tangail: "টাঙ্গাইল|টাংগাইল",
  Bandarban: "বান্দরবান", Brahmanbaria: "ব্রাহ্মণবাড়িয়া|ব্রাহ্মণবাড়ীয়া", Chandpur: "চাঁদপুর",
  Chattogram: "চট্টগ্রাম|চিটাগাং", Cumilla: "কুমিল্লা", "Cox's Bazar": "কক্সবাজার|কক্স বাজার", Feni: "ফেনী|ফেনি",
  Khagrachhari: "খাগড়াছড়ি", Lakshmipur: "লক্ষ্মীপুর|লক্ষীপুর", Noakhali: "নোয়াখালী|নোয়াখালি",
  Rangamati: "রাঙ্গামাটি|রাঙামাটি", Bogura: "বগুড়া", Joypurhat: "জয়পুরহাট", Naogaon: "নওগাঁ",
  Natore: "নাটোর", Chapainawabganj: "চাঁপাইনবাবগঞ্জ|চাঁপাই নবাবগঞ্জ", Pabna: "পাবনা", Rajshahi: "রাজশাহী|রাজশাহি",
  Sirajganj: "সিরাজগঞ্জ", Bagerhat: "বাগেরহাট", Chuadanga: "চুয়াডাঙ্গা|চুয়াডাঙা", Jashore: "যশোর",
  Jhenaidah: "ঝিনাইদহ", Khulna: "খুলনা", Kushtia: "কুষ্টিয়া", Magura: "মাগুরা", Meherpur: "মেহেরপুর",
  Narail: "নড়াইল", Satkhira: "সাতক্ষীরা", Barguna: "বরগুনা", Barishal: "বরিশাল", Bhola: "ভোলা",
  Jhalokati: "ঝালকাঠি|ঝালকাঠী", Patuakhali: "পটুয়াখালী|পটুয়াখালি", Pirojpur: "পিরোজপুর",
  Habiganj: "হবিগঞ্জ", Moulvibazar: "মৌলভীবাজার", Sunamganj: "সুনামগঞ্জ", Sylhet: "সিলেট",
  Dinajpur: "দিনাজপুর", Gaibandha: "গাইবান্ধা", Kurigram: "কুড়িগ্রাম", Lalmonirhat: "লালমনিরহাট",
  Nilphamari: "নীলফামারী", Panchagarh: "পঞ্চগড়", Rangpur: "রংপুর", Thakurgaon: "ঠাকুরগাঁও",
  Jamalpur: "জামালপুর", Mymensingh: "ময়মনসিংহ", Netrokona: "নেত্রকোণা|নেত্রকোনা", Sherpur: "শেরপুর",
};

// Old English spellings and short forms people still write
const EN_ALIASES = {
  Chattogram: "chittagong|ctg|chattagram", Cumilla: "comilla", Jashore: "jessore", Bogura: "bogra",
  Barishal: "barisal", "Cox's Bazar": "cox'?s\\s*bazar|cox\\s*bazar", Jhalokati: "jhalakathi|jhalokathi",
  Netrokona: "netrakona", Chapainawabganj: "chapai\\s*nawabganj|chapai", Moulvibazar: "moulvi\\s*bazar|maulvibazar",
  Brahmanbaria: "b\\.?\\s*baria", Narsingdi: "narshingdi",
};

// Prefixed so a trailing Bangla case ending (ঢাকায়, ঢাকার, চট্টগ্রামে) still counts as the name
const DISTRICT_PATTERNS = DISTRICTS.map((name) => {
  const en = [esc(name), EN_ALIASES[name]].filter(Boolean).join("|");
  const bn = BN_DISTRICTS[name];
  return {
    name,
    re: rx(
      `${NOT_WORD_BEFORE}(?:(?:${en})${NOT_WORD_AFTER}${bn ? `|(?:${bn.normalize("NFC")})` : ""})`,
      "iu"
    ),
  };
});

export const findDistricts = (text) =>
  DISTRICT_PATTERNS.map(({ name, re }) => {
    const m = re.exec(text);
    return m ? { name, index: m.index } : null;
  })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index);

// ---------- Hospital ----------

// Short names of large public hospitals
const KNOWN_HOSPITALS = [
  ["dmch|dhaka medical", "Dhaka Medical College Hospital", "Dhaka"],
  ["ssmc|mitford", "Sir Salimullah Medical College Mitford Hospital", "Dhaka"],
  ["bsmmu|pg hospital", "BSMMU", "Dhaka"],
  ["cmch|chittagong medical|chattogram medical", "Chattogram Medical College Hospital", "Chattogram"],
  ["rmch|rajshahi medical", "Rajshahi Medical College Hospital", "Rajshahi"],
  ["somch|osmani medical", "Sylhet MAG Osmani Medical College Hospital", "Sylhet"],
  ["mmch|mymensingh medical", "Mymensingh Medical College Hospital", "Mymensingh"],
  ["kmch|khulna medical", "Khulna Medical College Hospital", "Khulna"],
  ["rpmch|rangpur medical", "Rangpur Medical College Hospital", "Rangpur"],
  ["sbmch|sher-?e-?bangla medical", "Sher-e-Bangla Medical College Hospital", "Barishal"],
  ["comilla medical|cumilla medical", "Cumilla Medical College Hospital", "Cumilla"],
].map(([p, name, district]) => ({ re: rx(word(p), "iu"), name, district }));

const EN_FACILITY =
  "medical college (?:and |& )?hospital|medical college|specialized hospital|specialised hospital|hospital|clinic|diagnostic cent(?:er|re)|health complex|medical cent(?:er|re)|nursing home|institute";
const BN_FACILITY =
  "মেডিকেল কলেজ হাসপাতাল|মেডিকেল কলেজ|মেডিকেল|হাসপাতাল|হসপিটাল|ক্লিনিক|ডায়াগনস্টিক সেন্টার|স্বাস্থ্য কমপ্লেক্স|নার্সিং হোম";

// Words that end a hospital name when reading backwards from "Hospital"
const STOP_WORDS = new Set([
  "at", "in", "to", "for", "of", "the", "a", "an", "and", "is", "admitted", "need", "needed", "needs", "urgent",
  "blood", "bag", "bags", "unit", "units", "patient", "my", "his", "her", "our", "from", "near", "by", "on",
  "please", "contact", "call", "rokto", "lagbe", "dorkar", "vorti", "bhorti", "te", "e",
  "রক্ত", "লাগবে", "দরকার", "প্রয়োজন", "ভর্তি", "জন্য", "রোগী", "রোগীর", "ব্যাগ", "জরুরি", "জরুরী", "এ", "তে", "আছে", "যোগাযোগ",
]);

const titleCase = (s) => s.replace(/\b([a-z])/g, (c) => c.toUpperCase());

const findHospital = (text) => {
  for (const h of KNOWN_HOSPITALS) {
    if (h.re.test(text)) return { name: h.name, district: h.district };
  }

  const re = rx(`${NOT_WORD_BEFORE}(${EN_FACILITY}|${BN_FACILITY})`, "iu");
  const m = re.exec(text);
  if (!m) return null;

  // Read the words just before the facility word, stopping at punctuation or a filler word
  const before = text.slice(0, m.index).split(/[,.;:!?\n।()]/).pop();
  const words = before.trim().split(/\s+/).filter(Boolean);
  const kept = [];
  for (let i = words.length - 1; i >= 0 && kept.length < 5; i--) {
    const w = words[i];
    if (STOP_WORDS.has(w.toLowerCase()) || /\d/.test(w)) break;
    kept.unshift(w);
  }
  if (!kept.length) return null; // "a hospital" with no name is not useful

  let name = `${kept.join(" ")} ${m[1]}`.replace(/\s+/g, " ").trim();
  if (name === name.toLowerCase() && /[a-z]/.test(name)) name = titleCase(name);
  return { name };
};

// ---------- Deadline ----------

const dhakaDate = (now) => {
  const d = new Date(now + BD_OFFSET);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
};
const atDhaka = ({ y, m, d }, hour, minute = 0) => Date.UTC(y, m, d, hour, minute) - BD_OFFSET;

const PART_OF_DAY = [
  { re: "morning|sokal|shokal|সকাল|সকালে", hour: 9, pm: false },
  { re: "noon|dupur|দুপুর|দুপুরে", hour: 12, pm: true },
  { re: "afternoon|bikal|bikel|বিকাল|বিকেল|বিকালে|বিকেলে", hour: 15, pm: true },
  { re: "evening|sondha|shondha|sondhya|সন্ধ্যা|সন্ধ্যায়", hour: 18, pm: true },
  { re: "tonight|night|rat|raat|রাত|রাতে|রাতের", hour: 20, pm: true },
];

const findDeadline = (text, now, assumptions) => {
  let dayOffset = null;
  if (rx(word("day after tomorrow|porshu|পরশু"), "iu").test(text)) dayOffset = 2;
  else if (rx(word("tomorrow|tmrw|agamikal|agamikal|kal|kalke|আগামীকাল|আগামী কাল|কাল|কালকে"), "iu").test(text)) dayOffset = 1;
  else if (rx(word("today|tonight|aj|aaj|ajke|aajke|আজ|আজকে|আজই|আজকের"), "iu").test(text)) dayOffset = 0;

  let date = null;
  const dm = text.match(/(?<!\d)(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?(?!\d)/);
  if (dm && dayOffset === null) {
    const today = dhakaDate(now);
    const day = Number(dm[1]);
    const month = Number(dm[2]) - 1;
    let year = dm[3] ? Number(dm[3].length === 2 ? `20${dm[3]}` : dm[3]) : today.y;
    if (!dm[3] && atDhaka({ y: year, m: month, d: day }, 23, 59) < now) year += 1; // "5/1" in December means next year
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) date = { y: year, m: month, d: day };
  }

  // Clock time: "10am", "10:30 pm", "সকাল ১০টা", "rat 8 tar moddhe"
  let hour = null;
  let minute = 0;
  const ampm = text.match(/(?<!\d)(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i);
  if (ampm) {
    hour = Number(ampm[1]) % 12;
    if (/^p/i.test(ampm[3])) hour += 12;
    minute = Number(ampm[2] || 0);
  }
  let partMatched = null;
  for (const part of PART_OF_DAY) {
    const pm = rx(`${NOT_WORD_BEFORE}(?:${part.re})${NOT_WORD_AFTER}(?:\\s*(\\d{1,2})(?:[:.](\\d{2}))?\\s*(?:টা|টায়|টার|ta|tay|tar)?)?`, "iu").exec(text);
    if (!pm) continue;
    partMatched = part;
    if (hour === null && pm[1]) {
      hour = Number(pm[1]);
      minute = Number(pm[2] || 0);
      if (part.pm && hour < 12) hour += 12;
      if (part.hour === 20 && hour < 16) hour = Number(pm[1]) <= 4 ? Number(pm[1]) + 24 : hour; // "রাত ২টা" = 2am next day
    }
    break;
  }
  if (hour === null && partMatched) {
    hour = partMatched.hour;
    assumptions.push(`Assumed ${partMatched.hour === 12 ? "12:00 PM" : `${partMatched.hour % 12}:00 ${partMatched.hour < 12 ? "AM" : "PM"}`} for "${text.match(rx(partMatched.re, "iu"))[0]}"`);
  }

  if (dayOffset !== null || date || hour !== null) {
    const base = date || (() => {
      const t = dhakaDate(now + (dayOffset ?? 0) * DAY);
      return t;
    })();
    if (hour === null) {
      if (dayOffset === 0 && !date) {
        assumptions.push("Needed today with no time given: set two hours from now");
        return new Date(now + 2 * HOUR).toISOString();
      }
      hour = 12;
      assumptions.push("No time given: assumed 12:00 PM");
    }
    if (dayOffset === null && !date) {
      // Only a time was given: today if it is still ahead, otherwise tomorrow
      const today = dhakaDate(now);
      const ms = atDhaka(today, hour, minute);
      return new Date(ms > now ? ms : ms + DAY).toISOString();
    }
    return new Date(atDhaka(base, hour, minute)).toISOString();
  }

  if (rx(word("now|asap|immediately|right now|ekhoni|ekhuni|এখনই|এখুনি|এই মুহূর্তে"), "iu").test(text)) {
    assumptions.push("Needed right away: set two hours from now");
    return new Date(now + 2 * HOUR).toISOString();
  }
  return undefined;
};

// ---------- Patient name and notes ----------

const findPatientName = (text) => {
  // Up to five words; a full stop ends the name unless it follows a short title like "Md."
  const NAME_WORD = "(?:[A-Za-z'-]{1,3}\\.|[A-Za-z][A-Za-z'-]*)";
  const en = text.match(rx(`(?:patient(?:'s)?\\s*(?:name)?|rogir nam|rogi|রোগীর নাম|রোগী)\\s*[:\\-–ঃ]\\s*(${NAME_WORD}(?:\\s+${NAME_WORD}){0,4})`));
  if (en) return en[1].replace(/\s+(?:age|bed|ward|blood|contact|phone|jogajog)\b.*$/i, "").trim();
  const bn = text.match(rx("(?:রোগীর নাম|রোগী)\\s*[:\\-–ঃ]\\s*([^\\n,।:;.+0-9]{2,60})"));
  if (bn) return bn[1].replace(rx("\\s+(?:বয়স|বেড|ওয়ার্ড|যোগাযোগ).*$"), "").trim();
  return undefined;
};

const CONDITIONS = [
  "thalassemia|thalassaemia|থ্যালাসেমিয়া|থ্যালাসেমিয়া",
  "dengue|ডেঙ্গু|ডেঙ্গি",
  "cancer|ক্যান্সার|ক্যানসার",
  "c-?section|caesarean|cesarean|সিজার|সিজারিয়ান",
  "delivery|ডেলিভারি|প্রসব",
  "operation|surgery|অপারেশন|সার্জারি",
  "accident|দুর্ঘটনা|এক্সিডেন্ট",
  "dialysis|ডায়ালাইসিস",
  "anemia|anaemia|রক্তশূন্যতা",
].map((p) => rx(word(p), "iu"));

const findNotes = (text) => {
  const found = CONDITIONS.map((re) => text.match(re)?.[0]).filter(Boolean);
  return found.length ? `Mentioned: ${[...new Set(found)].join(", ")}` : undefined;
};

// ---------- Putting it together ----------

const BLOOD_WORDS = word("blood|রক্ত|rokto|rokt|roktô|donor|ডোনার|plasma|প্লাজমা|platelets?|প্লাটিলেট|প্লেটলেট");
const NEED_WORDS = word("need|needed|needs|require|required|requirement|urgent|wanted|lagbe|lagbo|dorkar|proyojon|লাগবে|দরকার|প্রয়োজন|জরুরি|জরুরী|চাই");

const detectLanguage = (text) => {
  const bangla = (text.match(/[ঀ-৿]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  if (bangla > latin) return "bangla";
  if (rx(word("lagbe|rokto|dorkar|ajke|kalke|bag lagbe|vorti|bhorti|jogajog"), "i").test(text)) return "banglish";
  return latin ? "english" : "other";
};

// Returns the raw extraction, before validation (exported for tests)
export const extractRaw = (input, { now = Date.now() } = {}) => {
  const text = toLatinDigits(String(input).normalize("NFC")).replace(/\s+/g, " ").trim();
  const assumptions = [];

  const bloodGroup = findBloodGroup(text);
  const isBloodRequest =
    Boolean(bloodGroup) || (rx(BLOOD_WORDS, "iu").test(text) && rx(NEED_WORDS, "iu").test(text));
  if (!isBloodRequest) return { isBloodRequest: false, language: detectLanguage(text) };

  const raw = { isBloodRequest: true, language: detectLanguage(text), assumptions };
  if (bloodGroup) raw.bloodGroup = bloodGroup;
  else if (/(?<![\p{L}\p{M}])(ab|a|b|o|এবি|এ|বি|ও)(?![\p{L}\p{M}])/iu.test(text) && /group|গ্রুপ/iu.test(text)) {
    assumptions.push("Blood group sign (+ or −) was not clear, so it was left empty");
  }

  const units = findUnits(text);
  if (units) raw.unitsNeeded = units;

  const component = findComponent(text);
  if (component) raw.component = component;

  const phone = findPhone(text);
  if (phone) raw.contactPhone = phone;

  const hospital = findHospital(text);
  if (hospital) raw.hospital = hospital.name;

  // Prefer the district written inside the hospital name, then a known hospital's city, then the first one named
  const districts = findDistricts(text);
  const inHospital = hospital && findDistricts(hospital.name)[0]?.name;
  const district = inHospital || hospital?.district || districts[0]?.name;
  if (district) raw.district = district;

  const neededBy = findDeadline(text, now, assumptions);
  if (neededBy) raw.neededBy = neededBy;

  const patientName = findPatientName(text);
  if (patientName) raw.patientName = patientName;

  const notes = findNotes(text);
  if (notes) raw.notes = notes;

  return raw;
};

// Same result shape as the AI parser
export const parseWithRules = (text, { now = Date.now() } = {}) => sanitizeParsed(extractRaw(text, { now }), { now });
