// server/src/scripts/matchingUnitTests.js
//
// Free, instant tests of blood compatibility and donor scoring.
// No server, database, or API key needed.
//
// Run:  npm run test:match

import assert from "node:assert/strict";
import { compatibleDonorGroups } from "../utils/compatibility.js";
import { distanceKm, scoreDonor, rankDonors } from "../services/matchScoring.js";

let passed = 0;
let failed = 0;
const t = (name, fn) => {
  try {
    fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`❌ ${name}\n     → ${err.message.split("\n")[0]}`);
  }
};

const GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

console.log("— Blood compatibility —");
t("known red-cell compatibility for every recipient", () => {
  const sorted = (g) => [...compatibleDonorGroups(g)].sort();
  assert.deepEqual(sorted("O-"), ["O-"]);
  assert.deepEqual(sorted("O+"), ["O+", "O-"].sort());
  assert.deepEqual(sorted("A+"), ["A+", "A-", "O+", "O-"].sort());
  assert.deepEqual(sorted("A-"), ["A-", "O-"].sort());
  assert.deepEqual(sorted("B+"), ["B+", "B-", "O+", "O-"].sort());
  assert.deepEqual(sorted("B-"), ["B-", "O-"].sort());
  assert.deepEqual(sorted("AB-"), ["AB-", "A-", "B-", "O-"].sort());
  assert.deepEqual(sorted("AB+"), [...GROUPS].sort());
});

t("O- can give to every recipient (universal red-cell donor)", () => {
  for (const r of GROUPS) assert.ok(compatibleDonorGroups(r).includes("O-"), `O- missing for ${r}`);
});

t("AB+ can only give to AB+", () => {
  const recipients = GROUPS.filter((r) => compatibleDonorGroups(r).includes("AB+"));
  assert.deepEqual(recipients, ["AB+"]);
});

t("Rh-negative patients never get an Rh-positive donor", () => {
  for (const r of GROUPS.filter((g) => g.endsWith("-"))) {
    assert.ok(compatibleDonorGroups(r).every((d) => d.endsWith("-")), `Rh+ donor offered to ${r}`);
  }
});

t("platelets and plasma match only the identical group", () => {
  for (const r of GROUPS) {
    assert.deepEqual(compatibleDonorGroups(r, "platelets"), [r]);
    assert.deepEqual(compatibleDonorGroups(r, "plasma"), [r]);
  }
});

t("whole blood and red cells use the red-cell table", () => {
  assert.deepEqual(compatibleDonorGroups("A+", "red_cells"), compatibleDonorGroups("A+", "whole_blood"));
});

t("invalid or missing groups return an empty list", () => {
  for (const bad of ["X+", "", null, undefined, "A", "a positive"]) {
    assert.deepEqual(compatibleDonorGroups(bad), [], `accepted ${bad}`);
  }
});

t("lower-case input is accepted", () => {
  assert.deepEqual([...compatibleDonorGroups("o-")], ["O-"]);
});

t("the returned list is a copy (callers cannot corrupt the table)", () => {
  compatibleDonorGroups("A+").push("ZZ");
  assert.equal(compatibleDonorGroups("A+").includes("ZZ"), false);
});

console.log("\n— Distance —");
const DHAKA = [90.4125, 23.8103];
const SAVAR = [90.2667, 23.8583];
t("Dhaka to Savar is about 16 km", () => {
  const km = distanceKm(DHAKA, SAVAR);
  assert.ok(km > 15 && km < 17, `got ${km}`);
});
t("distance is symmetrical and zero for the same point", () => {
  assert.equal(distanceKm(DHAKA, DHAKA), 0);
  assert.ok(Math.abs(distanceKm(DHAKA, SAVAR) - distanceKm(SAVAR, DHAKA)) < 1e-9);
});
t("missing or invalid coordinates give null", () => {
  for (const bad of [undefined, null, [], [1], [NaN, 1], "x"]) {
    assert.equal(distanceKm(bad, DHAKA), null);
    assert.equal(distanceKm(DHAKA, bad), null);
  }
});

console.log("\n— Scoring —");
const request = { bloodGroup: "A+", district: "Dhaka" };
const base = { _id: "1", bloodGroup: "A+", district: "Dhaka" };

t("exact group scores higher than compatible group", () => {
  const exact = scoreDonor(request, base);
  const compat = scoreDonor(request, { ...base, bloodGroup: "O-" });
  assert.ok(exact.score > compat.score);
  assert.ok(exact.reasons.includes("Exact blood group match"));
  assert.ok(compat.reasons.includes("Compatible blood group"));
});

t("same district beats a different district (case and spaces ignored)", () => {
  const same = scoreDonor(request, { ...base, district: "  dhaka " });
  const other = scoreDonor(request, { ...base, district: "Sylhet" });
  assert.equal(same.score - other.score, 25);
  assert.ok(same.reasons.includes("Same district"));
});

t("distance bonus steps down with distance", () => {
  const at = (km) => {
    const donorPoint = [90.4125, 23.8103 + km / 111.2]; // km north of the request
    return scoreDonor({ ...request, location: { coordinates: DHAKA } }, { ...base, location: { coordinates: donorPoint } }).score;
  };
  const noCoords = scoreDonor(request, base).score;
  assert.equal(at(2) - noCoords, 25);
  assert.equal(at(10) - noCoords, 18);
  assert.equal(at(30) - noCoords, 10);
  assert.equal(at(80) - noCoords, 4);
  assert.equal(at(300) - noCoords, 0);
});

t("no distance reason when either side has no coordinates", () => {
  const r = scoreDonor({ ...request, location: { coordinates: DHAKA } }, base);
  assert.equal(r.distanceKm, undefined);
  assert.ok(!r.reasons.some((x) => x.includes("km")));
});

t("verified donors get +10", () => {
  assert.equal(scoreDonor(request, { ...base, isVerified: true }).score - scoreDonor(request, base).score, 10);
});

t("experience adds 1 per donation, capped at 5", () => {
  const s = (n) => scoreDonor(request, { ...base, totalDonations: n }).score - scoreDonor(request, base).score;
  assert.equal(s(1), 1);
  assert.equal(s(3), 3);
  assert.equal(s(5), 5);
  assert.equal(s(50), 5);
  assert.equal(s(-4), 0);
  assert.equal(s("abc"), 0);
});

t("every point has a reason (score and reasons agree)", () => {
  const r = scoreDonor(request, { ...base, isVerified: true, totalDonations: 2 });
  assert.equal(r.score, 30 + 25 + 10 + 2);
  assert.equal(r.reasons.length, 4);
});

console.log("\n— Ranking —");
t("ranks by score, highest first", () => {
  const ranked = rankDonors(request, [
    { _id: "a", bloodGroup: "O-", district: "Dhaka" },
    { _id: "b", bloodGroup: "A+", district: "Dhaka", isVerified: true },
    { _id: "c", bloodGroup: "A+", district: "Sylhet" },
  ]);
  assert.deepEqual(ranked.map((r) => r.donor._id), ["b", "a", "c"]);
});

t("ties: verified first, then longest since last donation, then id", () => {
  const donors = [
    { _id: "z", bloodGroup: "A+", district: "Dhaka", lastDonationDate: "2026-06-01" },
    { _id: "y", bloodGroup: "A+", district: "Dhaka", lastDonationDate: "2025-01-01" },
    { _id: "x", bloodGroup: "A+", district: "Dhaka" },
  ];
  assert.deepEqual(rankDonors(request, donors).map((r) => r.donor._id), ["x", "y", "z"]);
  const same = [
    { _id: "m", bloodGroup: "A+", district: "Dhaka" },
    { _id: "k", bloodGroup: "A+", district: "Dhaka" },
  ];
  assert.deepEqual(rankDonors(request, same).map((r) => r.donor._id), ["k", "m"]);
});

t("ranking is deterministic and does not change the input array", () => {
  const donors = [
    { _id: "b", bloodGroup: "A+", district: "Dhaka" },
    { _id: "a", bloodGroup: "A+", district: "Dhaka" },
  ];
  const copy = JSON.stringify(donors);
  const one = rankDonors(request, donors).map((r) => r.donor._id);
  const two = rankDonors(request, [...donors].reverse()).map((r) => r.donor._id);
  assert.deepEqual(one, two);
  assert.equal(JSON.stringify(donors), copy);
});

t("an empty list ranks to an empty list", () => {
  assert.deepEqual(rankDonors(request, []), []);
});

console.log(`\nResult: ${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;