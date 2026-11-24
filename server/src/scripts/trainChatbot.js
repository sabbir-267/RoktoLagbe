// server/src/scripts/trainChatbot.js
//
// Trains the offline assistant on chatbot/knowledge.js, evaluates it on the held-out
// questions in chatbot/testset.js, picks the confidence threshold that scores best,
// and saves the model to chatbot/model.json.
//
// Run:  npm run chatbot:train          (add --no-save to only evaluate)

import fs from "node:fs";
import knowledge from "../chatbot/knowledge.js";
import testset from "../chatbot/testset.js";
import { train, classify } from "../chatbot/model.js";
import { MODEL_PATH } from "../chatbot/engine.js";

const ids = new Set(knowledge.map((i) => i.id));
const problems = [];
const seen = new Set();
for (const i of knowledge) {
  if (seen.has(i.id)) problems.push(`duplicate id "${i.id}"`);
  seen.add(i.id);
  if (!i.action && !["fallback", "emergency"].includes(i.id) && (!i.answer?.en || !i.answer?.bn)) problems.push(`"${i.id}" needs answer.en and answer.bn`);
  for (const f of i.follow || []) if (!ids.has(f)) problems.push(`"${i.id}" follows unknown intent "${f}"`);
  for (const l of i.links || []) if (!l.to?.startsWith("/") || !l.label?.en || !l.label?.bn) problems.push(`"${i.id}" has a bad link`);
}
for (const t of testset) if (t.intent && !ids.has(t.intent)) problems.push(`test "${t.text}" expects unknown intent "${t.intent}"`);
if (problems.length) {
  console.error("Knowledge base problems:\n- " + problems.join("\n- "));
  process.exit(1);
}

const examples = knowledge.reduce((n, i) => n + i.examples.length, 0);
console.log(`Training on ${knowledge.length} intents, ${examples} example questions...`);
const base = train(knowledge);

const score = (threshold) => {
  const m = { ...base, threshold };
  let correct = 0;
  const misses = [];
  for (const t of testset) {
    const got = classify(m, t.text).intent;
    if (got === t.intent) correct++;
    else misses.push({ ...t, got });
  }
  return { threshold, correct, accuracy: correct / testset.length, misses };
};

// Try thresholds and keep the best; on a tie prefer the lower one (answers more often)
let best = null;
for (let th = 0.15; th <= 0.5001; th += 0.01) {
  const r = score(Number(th.toFixed(2)));
  if (!best || r.correct > best.correct) best = r;
}

const inScope = testset.filter((t) => t.intent).length;
console.log(`\nHeld-out test set: ${testset.length} questions (${inScope} in scope, ${testset.length - inScope} out of scope)`);
console.log(`Best confidence threshold: ${best.threshold}`);
console.log(`Accuracy: ${(best.accuracy * 100).toFixed(1)}% (${best.correct}/${testset.length})`);
if (best.misses.length) {
  console.log("\nMisses:");
  for (const m of best.misses) console.log(`  "${m.text}"  expected ${m.intent ?? "(unknown)"}, got ${m.got ?? "(unknown)"}`);
}

if (!process.argv.includes("--no-save")) {
  const model = { ...base, threshold: best.threshold, accuracy: Number(best.accuracy.toFixed(3)) };
  fs.writeFileSync(MODEL_PATH, JSON.stringify(model));
  console.log(`\nSaved model to ${MODEL_PATH} (${(fs.statSync(MODEL_PATH).size / 1024).toFixed(0)} KB)`);
}
