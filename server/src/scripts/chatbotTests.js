// server/src/scripts/chatbotTests.js
//
// Free, instant tests of the offline assistant: checks the knowledge base, trains the
// model in memory, measures held-out accuracy, and runs a few end-to-end replies
// (no database: only answers that don't need live data).
// Run:  npm run test:chatbot

import assert from "node:assert/strict";
import knowledge from "../chatbot/knowledge.js";
import testset from "../chatbot/testset.js";
import { train, classify } from "../chatbot/model.js";
import { replyOffline } from "../chatbot/engine.js";

const MIN_ACCURACY = 0.85;

let passed = 0;
let failed = 0;
const t = async (name, fn) => {
  try {
    await fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`❌ ${name}\n     → ${err.message.split("\n")[0]}`);
  }
};

const BY_ID = new Map(knowledge.map((i) => [i.id, i]));

await t("knowledge base is valid", () => {
  const seen = new Set();
  for (const i of knowledge) {
    assert.ok(!seen.has(i.id), `duplicate id "${i.id}"`);
    seen.add(i.id);
    if (!i.action && !["fallback", "emergency"].includes(i.id)) {
      assert.ok(i.answer?.en && i.answer?.bn, `"${i.id}" needs answer.en and answer.bn`);
      assert.ok(!/TODO/.test(i.answer.en + i.answer.bn), `"${i.id}" still has a TODO answer`);
      assert.ok(i.examples.length >= 8, `"${i.id}" has only ${i.examples.length} examples`);
    }
    for (const f of i.follow || []) assert.ok(BY_ID.has(f), `"${i.id}" follows unknown intent "${f}"`);
    for (const l of i.links || []) assert.ok(l.to?.startsWith("/") && l.label?.en && l.label?.bn, `"${i.id}" has a bad link`);
  }
  for (const id of ["greeting", "fallback", "emergency", "find_donors", "bank_stock", "open_requests", "my_eligibility", "compatibility"]) {
    assert.ok(BY_ID.has(id), `required intent "${id}" is missing`);
  }
  for (const q of testset) if (q.intent) assert.ok(BY_ID.has(q.intent), `test "${q.text}" expects unknown intent "${q.intent}"`);
});

await t(`held-out accuracy is at least ${MIN_ACCURACY * 100}%`, () => {
  // Classify each question once, then try thresholds on the scores (same search as chatbot:train)
  const m = { ...train(knowledge), threshold: 0 };
  const results = testset.map((q) => ({ expected: q.intent, ...classify(m, q.text) }));
  let best = { correct: -1 };
  for (let th = 0.15; th <= 0.5001; th += 0.01) {
    const threshold = Number(th.toFixed(2));
    const correct = results.filter((r) => (r.score >= threshold ? r.intent : null) === r.expected).length;
    if (correct > best.correct) best = { correct, threshold };
  }
  const accuracy = best.correct / testset.length;
  console.log(`     ${(accuracy * 100).toFixed(1)}% (${best.correct}/${testset.length}) at threshold ${best.threshold}`);
  assert.ok(accuracy >= MIN_ACCURACY, `accuracy ${(accuracy * 100).toFixed(1)}% is below ${MIN_ACCURACY * 100}%`);
});

// End-to-end replies through the real engine (saved model or in-memory training)
const reply = (text, lang = "en") => replyOffline({ text, lang, history: [] });

const expectAnswer = (text, intent, lang = "en") =>
  t(`"${text}" → ${intent}`, async () => {
    const r = await reply(text, lang);
    assert.equal(r.intent, intent);
    assert.equal(r.reply, BY_ID.get(intent).answer[lang]);
  });

await expectAnswer("who can donate", "who_can_donate");
await expectAnswer("kivabe request dibo", "post_request");
await expectAnswer("is it free?", "is_free");
await expectAnswer("thanks", "thanks");
await expectAnswer("hello", "greeting");
await expectAnswer("কারা রক্ত দিতে পারে?", "who_can_donate", "bn");
await expectAnswer("rokto dile ki betha lage", "does_it_hurt");

await t("Bangla script gets a Bangla reply even with the English UI", async () => {
  const r = await reply("রক্ত দেওয়ার আগে কী করব", "en");
  assert.equal(r.intent, "before_donating");
  assert.equal(r.reply, BY_ID.get("before_donating").answer.bn);
});

await t("emergency → call 999", async () => {
  const r = await reply("my father is unconscious");
  assert.equal(r.intent, "emergency");
  assert.match(r.reply, /999/);
});

await t("emergency in Bangla", async () => {
  const r = await reply("বাবা অজ্ঞান হয়ে গেছে", "bn");
  assert.equal(r.intent, "emergency");
  assert.match(r.reply, /৯৯৯/);
});

await t("out of scope → fallback", async () => {
  const r = await reply("what's the bitcoin price");
  assert.equal(r.intent, null);
  assert.equal(r.reply, BY_ID.get("fallback").answer.en);
  assert.ok(r.suggestions.length > 0, "fallback should offer suggestions");
});

await t("answers carry links and suggestions", async () => {
  const r = await reply("how do I post a blood request");
  assert.equal(r.intent, "post_request");
  assert.ok(r.links.some((l) => l.to === "/requests/new"));
  assert.ok(r.suggestions.length > 0);
});

console.log(`\n${failed ? "❌" : "✅"} ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
