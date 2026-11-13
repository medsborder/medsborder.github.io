import test from "node:test";
import assert from "node:assert";
import { buildMap } from "../assets/js/core/buildMap.js";
import { buildConclusions } from "../assets/js/core/conclusions.js";

const src = (c, entries) => ({
  id: `s-${c}`, url: "https://example.org", scope: "country", countries: [c],
  verifiedAt: "2026-01-01", license: "t", entries: entries.map(([substance, status]) => ({ substance, status })),
});

test("conclusions group countries by ingredient statuses", () => {
  const sources = [
    src("AAA", [["r", "allowed"], ["o", "allowed"]]),
    src("BBB", [["r", "allowed"], ["o", "prescription"]]),
    src("CCC", [["r", "prescription"], ["o", "allowed"]]),
    src("DDD", [["r", "banned"], ["o", "allowed"]]),
  ];
  const ing = [{ id: "r", required: true }, { id: "o", required: false }];
  const m = buildMap({ departure: "XXX", destinations: ["AAA", "BBB", "CCC", "DDD", "EEE"] }, ["r", "o"], sources, new Date("2026-06-01"));
  const c = buildConclusions(m, ing, ["AAA", "BBB", "CCC", "DDD", "EEE"]);
  assert.deepStrictEqual(c.allAllowed, ["AAA"]);
  assert.deepStrictEqual(c.requiredAllowed, ["AAA", "BBB"]);
  assert.deepStrictEqual(c.anyPrescription, ["BBB", "CCC"]);
  assert.deepStrictEqual(c.requiredPrescription, ["CCC"]);
  assert.deepStrictEqual(c.optionalPrescription, ["BBB"]);
  assert.deepStrictEqual(c.anyRestrictedOrBanned, ["DDD"]);
  assert.deepStrictEqual(c.insufficientData, ["EEE"]);
});

test("unknown is never counted as allowed", () => {
  const m = buildMap({ destinations: ["AAA"] }, ["r"], [], new Date());
  const c = buildConclusions(m, [{ id: "r", required: true }], ["AAA"]);
  assert.deepStrictEqual(c.allAllowed, []);
  assert.deepStrictEqual(c.requiredAllowed, []);
  assert.deepStrictEqual(c.insufficientData, ["AAA"]);
});
