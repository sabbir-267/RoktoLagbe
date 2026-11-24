// server/src/chatbot/nlp.js
//
// Text features for the offline assistant. Messages arrive in Bangla, English and
// Banglish with inconsistent spelling, so besides whole words we use character
// 3-grams inside each word: "rokto" / "rakto" / "roktho" still share most 3-grams.

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

export const normalize = (text) =>
  String(text ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
    .replace(/[^\p{L}\p{M}\p{N}+\-\s]/gu, " ") // keep "+"/"-" for blood groups
    .replace(/\s+/g, " ")
    .trim();

// Very common words that carry no meaning for intent matching. Negations ("na", "না", "not")
// and question words ("who", "when", "koto") are kept on purpose: they separate intents.
const STOP = new Set([
  "the", "a", "an", "is", "are", "am", "i", "you", "to", "of", "in", "on", "for", "and", "or", "it", "do",
  "does", "can", "be", "my", "me", "what", "how", "please", "pls", "plz",
  "will", "would", "should", "could", "this", "that", "with", "at", "by", "from", "i'm", "im", "it's", "any",
  "about", "so", "just", "if", "we", "our", "your", "they", "them", "has", "have", "had", "was", "were", "been",
  "than", "then", "too", "very", "also", "some", "there", "here",
  "ami", "amar", "ki", "kii", "kivabe", "kibhabe", "kemne", "keno", "ache", "kore", "korte", "jabe", "hobe", "ta", "ti",
  "er", "e", "r", "ke", "naki", "to", "o", "ar", "je", "ei", "oi", "eta", "ota", "ekta",
  "আমি", "আমার", "কি", "কী", "কিভাবে", "কীভাবে", "কেন", "আছে", "করে", "করতে", "যাবে", "হবে", "টা", "টি", "একটু", "দয়া",
  "আমরা", "তুমি", "আপনি", "আপনার", "এই", "ওই", "এটা", "সেটা", "কোনো", "হয়", "এর", "ও", "আর", "নাকি", "তো", "জন্য",
]);

export const tokens = (text) => normalize(text).split(" ").filter((w) => w && !STOP.has(w));

// Sparse feature counts: words (weight 1), word pairs, and character 3-grams. The 3-grams are
// kept light: a word yields several of them and they are shared widely, so at a heavier weight
// they drown out the words that actually decide the intent.
const PAIR_WEIGHT = 0.5;
const GRAM_WEIGHT = 0.12;
export const features = (text) => {
  const f = new Map();
  const add = (k, w) => f.set(k, (f.get(k) || 0) + w);
  const words = tokens(text);
  words.forEach((w, i) => {
    add(`w:${w}`, 1);
    if (i > 0) add(`b:${words[i - 1]}_${w}`, PAIR_WEIGHT);
    const padded = `^${w}$`;
    const chars = [...padded]; // code points, so Bangla is handled correctly
    for (let j = 0; j + 3 <= chars.length; j++) add(`c:${chars.slice(j, j + 3).join("")}`, GRAM_WEIGHT);
  });
  return f;
};

// TF-IDF vector (L2-normalised) as a plain object, so it can be saved as JSON
export const vectorize = (text, idf) => {
  const v = {};
  let norm = 0;
  for (const [k, tf] of features(text)) {
    const w = idf[k];
    if (!w) continue; // unseen during training
    const x = (1 + Math.log(tf)) * w;
    v[k] = x;
    norm += x * x;
  }
  norm = Math.sqrt(norm) || 1;
  for (const k in v) v[k] /= norm;
  return v;
};

export const cosine = (a, b) => {
  let s = 0;
  const [small, big] = Object.keys(a).length < Object.keys(b).length ? [a, b] : [b, a];
  for (const k in small) if (big[k]) s += small[k] * big[k];
  return s;
};

export const isBangla = (text) => /[ঀ-৿]/.test(String(text));
