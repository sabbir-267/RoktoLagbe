// server/src/chatbot/model.js
//
// "Training" = computing IDF weights over every example question, then storing one
// TF-IDF vector per example plus one averaged vector (centroid) per intent.
// Classifying a message = finding the most similar examples (k-nearest neighbours),
// voting by intent, and blending in similarity to each intent's centroid. The centroid
// lets words spread over several examples of an intent add up, which helps with
// phrasings that no single example covers.

import { createHash } from "node:crypto";
import { features, vectorize, cosine } from "./nlp.js";

export const DEFAULT_THRESHOLD = 0.3;
const CENTROID_WEIGHT = 0.4;

// Normalised sum of each intent's example vectors
const centroidsOf = (examples) => {
  const sums = {};
  for (const ex of examples) {
    const c = (sums[ex.intent] ??= {});
    for (const k in ex.v) c[k] = (c[k] || 0) + ex.v[k];
  }
  for (const c of Object.values(sums)) {
    let n = 0;
    for (const k in c) n += c[k] * c[k];
    n = Math.sqrt(n) || 1;
    for (const k in c) c[k] = Number((c[k] / n).toFixed(5));
  }
  return sums;
};

export const knowledgeHash = (intents) =>
  createHash("sha1").update(JSON.stringify(intents.map((i) => [i.id, i.examples]))).digest("hex").slice(0, 12);

export const train = (intents, { threshold = DEFAULT_THRESHOLD } = {}) => {
  const docs = intents.flatMap((intent) => intent.examples.map((text) => ({ intent: intent.id, text })));
  const df = new Map();
  for (const d of docs) for (const k of features(d.text).keys()) df.set(k, (df.get(k) || 0) + 1);
  const N = docs.length;
  const idf = {};
  for (const [k, n] of df) idf[k] = Math.log((N + 1) / (n + 1)) + 1;

  const examples = docs.map((d) => ({ intent: d.intent, v: vectorize(d.text, idf) }));
  return {
    version: 2,
    hash: knowledgeHash(intents),
    trainedAt: new Date().toISOString(),
    threshold,
    idf,
    examples,
    centroids: centroidsOf(examples),
  };
};

// Returns { intent, score, ranked } — intent is null when nothing is similar enough
export const classify = (model, text, { k = 3 } = {}) => {
  const q = vectorize(text, model.idf);
  if (!Object.keys(q).length) return { intent: null, score: 0, ranked: [] };

  const best = new Map(); // intent → top-k similarities
  for (const ex of model.examples) {
    const s = cosine(q, ex.v);
    if (s <= 0) continue;
    const list = best.get(ex.intent) || [];
    list.push(s);
    best.set(ex.intent, list);
  }
  model.centroids ??= centroidsOf(model.examples); // models saved before centroids existed
  const ranked = [...best.entries()]
    .map(([intent, sims]) => {
      const top = sims.sort((a, b) => b - a).slice(0, k);
      // Mostly the closest example, a little credit for several close ones
      const knn = top[0] * 0.8 + (top.reduce((a, b) => a + b, 0) / top.length) * 0.2;
      const centroid = model.centroids[intent] ? cosine(q, model.centroids[intent]) : 0;
      return { intent, score: knn * (1 - CENTROID_WEIGHT) + centroid * CENTROID_WEIGHT };
    })
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  if (!top || top.score < model.threshold) return { intent: null, score: top?.score || 0, ranked: ranked.slice(0, 3) };
  return { intent: top.intent, score: top.score, ranked: ranked.slice(0, 3) };
};
