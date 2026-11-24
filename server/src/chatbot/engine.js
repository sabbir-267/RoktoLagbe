// server/src/chatbot/engine.js
//
// The free, offline assistant: classify the message with the trained model, pull
// blood group / district out of the conversation, run a live-data action when the
// intent needs one, and reply in the user's language.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import knowledge from "./knowledge.js";
import { train, classify, knowledgeHash } from "./model.js";
import { isBangla, normalize } from "./nlp.js";
import { ACTIONS } from "./actions.js";
import { findBloodGroup, findDistricts } from "../services/ruleParser.js";
import { DISTRICTS_BN } from "./places.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const MODEL_PATH = path.join(here, "model.json");

const BY_ID = new Map(knowledge.map((i) => [i.id, i]));

// Use the saved model from `npm run chatbot:train` when it matches the knowledge base;
// otherwise train in memory (takes a fraction of a second) so the bot always works.
let model;
const getModel = () => {
  if (model) return model;
  try {
    const saved = JSON.parse(fs.readFileSync(MODEL_PATH, "utf8"));
    if (saved.hash === knowledgeHash(knowledge)) model = saved;
  } catch {
    /* no saved model yet */
  }
  model ??= train(knowledge);
  return model;
};
export const reloadModel = () => {
  model = undefined;
  return getModel();
};

// Situations where someone needs an ambulance, not a chatbot
const EMERGENCY = /(unconscious|not breathing|can'?t breathe|heavy bleeding|bleeding (?:a lot|heavily|badly)|chest pain|heart attack|seizure|অজ্ঞান|শ্বাস নিতে পারছে না|শ্বাসকষ্ট|প্রচুর রক্তক্ষরণ|রক্তক্ষরণ বন্ধ হচ্ছে না|বুকে ব্যথা|ojnan|ogyan|shash nite parche na)/iu;

const lastUser = (history, n = 4) =>
  history.filter((m) => m.role === "user").slice(-n).reverse().map((m) => m.content);

// Blood group / district from this message, else from the person's recent messages
const slotsFrom = (text, history) => {
  const texts = [text, ...lastUser(history)];
  let bloodGroup = null;
  let district = null;
  for (const t of texts) {
    const n = String(t).normalize("NFC");
    bloodGroup ??= findBloodGroup(n) || null;
    district ??= findDistricts(n)[0]?.name || null;
    if (bloodGroup && district) break;
  }
  return { bloodGroup, district };
};

// True when nothing is left after removing the blood group, district and filler words
const FILLER = /\b(?:in|at|for|and|blood|group|donor|donors|please|pls|district|zila|jela|e|te|o)\b|(?:জেলায়|জেলা|রক্ত|গ্রুপ|এ|তে|এর|প্লিজ)/giu;
const isOnlySlots = (text) => {
  const n = String(text).normalize("NFC");
  const group = findBloodGroup(n);
  const districts = findDistricts(n);
  if (!group && !districts.length) return false;
  let rest = n;
  if (group) rest = rest.replace(/(ab|a|b|o|এবি|এ|বি|ও)\s*(?:\(\s*)?(?:\+\s*ve|\+|positive|pos|-\s*ve|-|–|negative|neg|পজিটিভ|পজেটিভ|নেগেটিভ)(?:\s*\))?/iu, " ");
  for (const d of districts) rest = rest.replace(new RegExp(d.name.replace(/[^a-z]/gi, ".?"), "i"), " ");
  rest = rest.replace(/[\u0980-\u09FF]+/g, (w) => (findDistricts(w).length ? " " : w)).replace(FILLER, " ");
  return rest.replace(/[^\p{L}\p{N}]+/gu, "").length <= 2;
};

const L = (lang, en, bn) => (lang === "bn" ? bn : en);
const num = (lang, n) => (lang === "bn" ? new Intl.NumberFormat("bn-BD").format(n) : String(n));
const place = (lang, d) => (lang === "bn" ? DISTRICTS_BN[d] || d : d);
const dateText = (lang, d) =>
  new Date(d).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
const chipsFor = (ids, lang) =>
  ids.map((id) => BY_ID.get(id)?.chip?.[lang]).filter(Boolean).slice(0, 4);
const GROUP_CHIPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

// ---------- Replies for live-data actions ----------

const askGroup = (lang, what) => ({
  reply: L(
    lang,
    `Which blood group ${what === "stock" ? "are you looking for" : "do you need"}? For example: **O+** or **B-**.`,
    `কোন রক্তের গ্রুপ ${what === "stock" ? "খুঁজছেন" : "প্রয়োজন"}? যেমন: **O+** বা **B-**।`
  ),
  suggestions: GROUP_CHIPS,
});

const RENDER = {
  find_donors: (r, lang) => {
    if (r.error) return askGroup(lang, "donors");
    const where = r.district ? L(lang, ` in ${r.district}`, ` ${place(lang, r.district)} জেলায়`) : L(lang, " across Bangladesh", " সারা বাংলাদেশে");
    let reply = L(
      lang,
      `There ${r.availableExact === 1 ? "is" : "are"} **${r.availableExact} ${r.bloodGroup} donor${r.availableExact === 1 ? "" : "s"}** available and eligible right now${where}.`,
      `এই মুহূর্তে${where} **${num(lang, r.availableExact)} জন ${r.bloodGroup} রক্তদাতা** রক্ত দিতে প্রস্তুত ও যোগ্য।`
    );
    if (r.compatibleGroups.length) {
      reply += L(
        lang,
        `\n\n${r.availableCompatible} more donor${r.availableCompatible === 1 ? "" : "s"} from compatible groups (${r.compatibleGroups.join(", ")}) can also give red cells or whole blood.`,
        `\n\nএছাড়া উপযোগী গ্রুপের (${r.compatibleGroups.join(", ")}) আরও ${num(lang, r.availableCompatible)} জন রক্তদাতা লোহিত কণিকা বা পূর্ণ রক্ত দিতে পারেন।`
      );
    }
    if (!r.district) reply += L(lang, "\n\nTell me your district to narrow it down.", "\n\nআপনার জেলার নাম বললে আরও নির্দিষ্ট করে দেখাতে পারি।");
    reply += L(
      lang,
      "\n\nTip: post a blood request too, so matching donors near the hospital get notified.",
      "\n\nপরামর্শ: একটি রক্তের অনুরোধও পোস্ট করুন, তাহলে হাসপাতালের কাছের উপযুক্ত রক্তদাতারা বিজ্ঞপ্তি পাবেন।"
    );
    return {
      reply,
      links: [
        { to: r.link, label: L(lang, "See matching donors", "উপযুক্ত রক্তদাতা দেখুন") },
        { to: "/requests/new", label: L(lang, "Post a blood request", "রক্তের অনুরোধ পোস্ট করুন") },
      ],
    };
  },

  bank_stock: (r, lang) => {
    if (r.error) return askGroup(lang, "stock");
    const where = r.district ? L(lang, ` in ${r.district}`, ` ${place(lang, r.district)} জেলায়`) : "";
    if (!r.banks.length) {
      return {
        reply: L(
          lang,
          `No partner blood bank${where} is showing **${r.bloodGroup}** stock right now. Try nearby districts, or find donors instead.`,
          `এই মুহূর্তে${where} কোনো সহযোগী ব্লাড ব্যাংকে **${r.bloodGroup}** মজুদ দেখা যাচ্ছে না। আশেপাশের জেলায় দেখুন, অথবা রক্তদাতা খুঁজুন।`
        ),
        links: [
          { to: r.link, label: L(lang, "Browse blood banks", "ব্লাড ব্যাংক দেখুন") },
          { to: `/donors?bloodGroup=${encodeURIComponent(r.bloodGroup)}`, label: L(lang, "Find donors", "রক্তদাতা খুঁজুন") },
        ],
      };
    }
    const lines = r.banks.map(
      (b) =>
        `- **${b.name}** (${place(lang, b.district)}): ${num(lang, b.units)} ${L(lang, b.units === 1 ? "unit" : "units", "ইউনিট")}${b.phone ? ` · ${b.phone}` : ""}${b.is24Hours ? L(lang, " · open 24h", " · ২৪ ঘণ্টা খোলা") : ""}`
    );
    return {
      reply: `${L(lang, `Blood banks with **${r.bloodGroup}** in stock${where}:`, `${where ? `${where.trim()} ` : ""}যেসব ব্লাড ব্যাংকে **${r.bloodGroup}** মজুদ আছে:`)}\n${lines.join("\n")}\n\n${L(lang, "Call before you go: stock changes quickly.", "যাওয়ার আগে ফোন করে নিশ্চিত হোন, মজুদ দ্রুত বদলায়।")}`,
      links: r.banks.slice(0, 3).map((b) => ({ to: b.link, label: b.name })),
    };
  },

  open_requests: (r, lang) => {
    const what = [r.bloodGroup, r.district && place(lang, r.district)].filter(Boolean).join(", ");
    if (!r.total) {
      return {
        reply: L(
          lang,
          `There are no open blood requests${what ? ` for ${what}` : ""} right now. Thank you for checking!`,
          `এই মুহূর্তে${what ? ` (${what})` : ""} কোনো খোলা রক্তের অনুরোধ নেই। খোঁজ নেওয়ার জন্য ধন্যবাদ!`
        ),
        links: [{ to: "/requests", label: L(lang, "All requests", "সব অনুরোধ") }],
      };
    }
    const lines = r.requests.map(
      (q) =>
        `- **${q.bloodGroup}** · ${q.hospital} (${place(lang, q.district)}) · ${num(lang, q.unitsNeeded)} ${L(lang, q.unitsNeeded === 1 ? "bag" : "bags", "ব্যাগ")} · ${L(lang, "needed by", "প্রয়োজন")} ${dateText(lang, q.neededBy)}`
    );
    return {
      reply: `${L(lang, `**${r.total}** open request${r.total === 1 ? "" : "s"}${what ? ` for ${what}` : ""}. Most urgent:`, `${what ? `${what}: ` : ""}**${num(lang, r.total)}টি** খোলা অনুরোধ আছে। সবচেয়ে জরুরি:`)}\n${lines.join("\n")}`,
      links: [{ to: r.link, label: L(lang, "See all matching requests", "সব মিলে যাওয়া অনুরোধ দেখুন") }],
    };
  },

  my_eligibility: (r, lang) => {
    if (!r.loggedIn) {
      return {
        reply: L(
          lang,
          "Log in and I can check your own donation status. In general you can donate again **4 months (120 days)** after your last donation, if you are 18–65, weigh at least 45 kg and feel well.",
          "লগ ইন করলে আমি আপনার নিজের রক্তদানের অবস্থা দেখে বলতে পারব। সাধারণভাবে শেষ রক্তদানের **৪ মাস (১২০ দিন)** পর আবার রক্ত দেওয়া যায়, যদি আপনার বয়স ১৮–৬৫, ওজন অন্তত ৪৫ কেজি হয় এবং আপনি সুস্থ থাকেন।"
        ),
        links: [{ to: "/login", label: L(lang, "Log in", "লগ ইন") }, { to: "/eligibility", label: L(lang, "Who can donate", "কারা রক্ত দিতে পারেন") }],
      };
    }
    if (!r.hasProfile) {
      return {
        reply: L(lang, "You don't have a donor profile yet. Create one and I can track when you can donate next.", "আপনার এখনো রক্তদাতা প্রোফাইল নেই। প্রোফাইল তৈরি করলে পরের বার কবে রক্ত দিতে পারবেন তা জানাতে পারব।"),
        links: [{ to: "/donor-profile", label: L(lang, "Create donor profile", "রক্তদাতা প্রোফাইল তৈরি করুন") }],
      };
    }
    const reply = r.eligibleNow
      ? L(
          lang,
          `Good news: you (**${r.bloodGroup}**) can donate now.${r.availabilitySwitchOn ? "" : " Your availability switch is off, so people can't see you as available. Turn it on from your dashboard."}`,
          `সুখবর: আপনি (**${r.bloodGroup}**) এখন রক্ত দিতে পারেন।${r.availabilitySwitchOn ? "" : " আপনার প্রাপ্যতার সুইচ বন্ধ আছে, তাই অন্যরা আপনাকে প্রস্তুত হিসেবে দেখছেন না। ড্যাশবোর্ড থেকে চালু করুন।"}`
        )
      : L(
          lang,
          `You last donated on ${dateText(lang, r.lastDonationDate)}. You can donate again from **${dateText(lang, r.nextEligibleDate)}**. Until then you're hidden from "available" searches.`,
          `আপনি শেষ রক্ত দিয়েছেন ${dateText(lang, r.lastDonationDate)} তারিখে। আবার রক্ত দিতে পারবেন **${dateText(lang, r.nextEligibleDate)}** থেকে। ততদিন আপনাকে "প্রস্তুত" তালিকায় দেখানো হবে না।`
        );
    return {
      reply: `${reply}${r.totalDonations ? L(lang, `\n\nRecorded donations: ${r.totalDonations}. Thank you!`, `\n\nরেকর্ড করা রক্তদান: ${num(lang, r.totalDonations)}টি। ধন্যবাদ!`) : ""}`,
      links: [{ to: "/dashboard", label: L(lang, "Open dashboard", "ড্যাশবোর্ড খুলুন") }],
    };
  },

  compatibility: (r, lang) => {
    if (r.error) return { ...askGroup(lang, "donors"), reply: L(lang, "Which blood group should I check? For example: **A+**.", "কোন রক্তের গ্রুপ দেখব? যেমন: **A+**।") };
    return {
      reply: L(
        lang,
        `For red cells / whole blood:\n- **${r.bloodGroup}** patients can receive from: ${r.canReceiveFrom.join(", ")}\n- **${r.bloodGroup}** donors can give to: ${r.canGiveTo.join(", ")}\n\nPlatelets and plasma follow different rules, and the hospital always cross-matches before a transfusion.`,
        `লোহিত কণিকা / পূর্ণ রক্তের ক্ষেত্রে:\n- **${r.bloodGroup}** রোগী রক্ত নিতে পারেন: ${r.canReceiveFrom.join(", ")}\n- **${r.bloodGroup}** রক্তদাতা রক্ত দিতে পারেন: ${r.canGiveTo.join(", ")}\n\nপ্লাটিলেট ও প্লাজমার নিয়ম আলাদা, এবং রক্ত দেওয়ার আগে হাসপাতাল সবসময় ক্রস-ম্যাচ করে।`
      ),
      links: [{ to: "/eligibility", label: L(lang, "Compatibility chart", "গ্রুপ মিলের চার্ট") }],
    };
  },
};

const ACTION_SUGGESTIONS = {
  find_donors: ["bank_stock", "post_request", "how_matching_works"],
  bank_stock: ["find_donors_example", "post_request"],
  open_requests: ["how_to_respond", "my_eligibility"],
  my_eligibility: ["donation_gap", "before_donating"],
  compatibility: ["find_donors_example", "universal_donor"],
};

// history: earlier turns [{ role: "user"|"assistant", content }]
export const replyOffline = async ({ text, history = [], lang: uiLang, user }) => {
  // Bangla script always gets a Bangla reply; otherwise follow the site's language setting
  const lang = isBangla(text) || uiLang === "bn" ? "bn" : "en";

  if (EMERGENCY.test(normalize(text)) || EMERGENCY.test(text)) {
    const e = BY_ID.get("emergency");
    return {
      engine: "offline",
      intent: "emergency",
      reply: e.answer[lang],
      links: (e.links || []).map((l) => ({ to: l.to, label: l.label[lang] })),
      suggestions: chipsFor(e.follow || [], lang),
    };
  }

  // A reply that is only a blood group and/or district ("B+", "Sylhet", "O- in Khulna")
  // answers the assistant's last live-data question, so continue that one
  const prevIntent = BY_ID.get(history.filter((h) => h.role === "assistant").slice(-1)[0]?.intent);
  if (prevIntent?.action && isOnlySlots(text)) {
    return runAction(prevIntent, text, history, lang, user, 1);
  }

  const m = getModel();
  const result = classify(m, text);
  const intent = result.intent ? BY_ID.get(result.intent) : null;

  if (!intent) {
    const fb = BY_ID.get("fallback");
    return {
      engine: "offline",
      intent: null,
      confidence: result.score,
      reply: fb.answer[lang],
      suggestions: chipsFor(fb.follow || [], lang),
      links: (fb.links || []).map((l) => ({ to: l.to, label: l.label[lang] })),
    };
  }

  if (intent.action) return runAction(intent, text, history, lang, user, result.score);

  return {
    engine: "offline",
    intent: intent.id,
    confidence: result.score,
    reply: intent.answer[lang] || intent.answer.en,
    links: (intent.links || []).map((l) => ({ to: l.to, label: l.label[lang] || l.label.en })),
    suggestions: chipsFor(intent.follow || [], lang),
  };
};

const runAction = async (intent, text, history, lang, user, score) => {
  const slots = slotsFrom(text, history);
  const data = await ACTIONS[intent.action]({ ...slots, user });
  const out = RENDER[intent.action](data, lang);
  return {
    engine: "offline",
    intent: intent.id,
    confidence: score,
    reply: out.reply,
    links: out.links || [],
    suggestions: out.suggestions || chipsFor(intent.follow || ACTION_SUGGESTIONS[intent.action] || [], lang),
  };
};

export const welcome = (lang = "en") => {
  const w = BY_ID.get("greeting");
  return { reply: w.answer[lang], suggestions: chipsFor(w.follow || [], lang) };
};
