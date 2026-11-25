// server/src/scripts/runAll.js
//
// Runs every test suite in order and prints a summary.
//
//   npm test            all suites (live ones need the API running: npm run dev)
//   npm run test:unit   only the free suites (no server, database or API key)
//
// A live suite is SKIPPED (not failed) when the API is not reachable. The AI
// parsing suite is also skipped when there is no real ANTHROPIC_API_KEY.

import "dotenv/config";
import { spawn } from "node:child_process";

const BASE = process.env.BASE_URL || "http://localhost:5000";
const unitOnly = process.argv.includes("--unit");

const SUITES = [
  { name: "Parser unit tests", script: "test:parser", live: false },
  { name: "Free parser tests", script: "test:rules", live: false },
  { name: "Assistant (offline chatbot)", script: "test:chatbot", live: false },
  { name: "Matching unit tests", script: "test:match", live: false },
  { name: "Security unit tests", script: "test:security:unit", live: false },
  { name: "Inventory and permissions (live)", script: "test:must", live: true },
  { name: "Requests (live)", script: "test:requests", live: true },
  { name: "Matching and notifications (live)", script: "test:match:live", live: true },
  { name: "Security (live)", script: "test:security", live: true },
  { name: "Ask a doctor (live)", script: "test:consult", live: true },
  { name: "Live trip tracking (live)", script: "test:trip", live: true },
  { name: "AI parsing (live)", script: "test:parser:live", live: true, needsAi: true },
];

const PLACEHOLDER = /paste|your_?key|change_?me|replace_?me|example|<[^>]+>/i;
const hasAiKey = !!process.env.ANTHROPIC_API_KEY && !PLACEHOLDER.test(process.env.ANTHROPIC_API_KEY);

const serverUp = async () => {
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
    return res.status === 200;
  } catch {
    return false;
  }
};

const runScript = (script) =>
  new Promise((resolve) => {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const child = spawn(npm, ["run", "--silent", script], { stdio: "inherit" });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });

const up = unitOnly ? false : await serverUp();
if (!unitOnly && !up) {
  console.log(`⚠️  API not reachable at ${BASE}. Live suites will be skipped. Start it with "npm run dev" in another terminal.\n`);
}

const results = [];
for (const suite of SUITES) {
  let skip = null;
  if (unitOnly && suite.live) skip = "unit-only run";
  else if (suite.live && !up) skip = "API not running";
  else if (suite.needsAi && !hasAiKey) skip = "no ANTHROPIC_API_KEY";

  if (skip) {
    results.push({ ...suite, status: "skipped", note: skip, seconds: 0 });
    continue;
  }

  console.log(`\n${"=".repeat(64)}\n▶ ${suite.name}\n${"=".repeat(64)}`);
  const started = Date.now();
  const code = await runScript(suite.script);
  results.push({ ...suite, status: code === 0 ? "passed" : "failed", seconds: (Date.now() - started) / 1000 });
}

console.log(`\n${"=".repeat(64)}\nSummary\n${"=".repeat(64)}`);
for (const r of results) {
  const icon = r.status === "passed" ? "✅" : r.status === "failed" ? "❌" : "⏭️ ";
  const detail = r.status === "skipped" ? `skipped (${r.note})` : `${r.status} in ${r.seconds.toFixed(1)}s`;
  console.log(`${icon} ${r.name.padEnd(36)} ${detail}`);
}

const failed = results.filter((r) => r.status === "failed").length;
const skipped = results.filter((r) => r.status === "skipped").length;
console.log(
  `\n${failed ? "❌" : "✅"} ${results.length - failed - skipped} passed, ${failed} failed, ${skipped} skipped`
);
process.exitCode = failed ? 1 : 0;