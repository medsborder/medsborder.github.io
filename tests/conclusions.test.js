import test from "node:test";
import assert from "node:assert";
import { buildMap } from "../assets/js/core/buildMap.js";
import { buildActions, buildTimeline, buildVerdict, ACTION_GROUPS } from "../assets/js/core/conclusions.js";
import { worstOf, SEVERITY } from "../assets/js/core/status.js";

const src = (c, entries) => ({
  id: `s-${c}`, url: "https://example.org", scope: "country", countries: [c],
  verifiedAt: "2026-01-01", license: "t", entries: entries.map(([substance, status]) => ({ substance, status })),
});
const sources = [
  src("AAA", [["x", "allowed"], ["y", "allowed"]]),
  src("BBB", [["x", "prescription"], ["y", "allowed"]]),
  src("CCC", [["x", "banned"], ["y", "restricted"]]),
];
const route = { departure: "DDD", transit: ["BBB"], destinations: ["AAA", "CCC", "EEE"] };
const ids = ["x", "y"];
const map = buildMap(route, ids, sources, new Date("2026-06-01"));
const eval_ = ["BBB", "AAA", "CCC", "EEE"];

test("actions are grouped by what the traveller must do, in route order", () => {
  const a = buildActions(map, ids, eval_);
  assert.deepStrictEqual(ACTION_GROUPS, ["stop", "prepare", "verify", "ok"]);
  assert.deepStrictEqual(a.stop.map((g) => [g.substance, g.countries.map((c) => c.country)]), [["x", ["CCC"]]]);
  assert.deepStrictEqual(a.prepare.map((g) => [g.substance, g.countries.map((c) => `${c.country}:${c.status}`)]),
    [["x", ["BBB:prescription"]], ["y", ["CCC:restricted"]]]);
  assert.deepStrictEqual(a.verify.map((g) => [g.substance, g.countries.map((c) => c.country)]), [["x", ["EEE"]], ["y", ["EEE"]]]);
  assert.deepStrictEqual(a.ok.map((g) => [g.substance, g.countries.map((c) => c.country)]), [["x", ["AAA"]], ["y", ["BBB", "AAA"]]]);
  assert.deepStrictEqual(a.prepare[0].countries[0].roles, ["transit"]);
});

test("unknown is never put in the ok group", () => {
  const m = buildMap({ destinations: ["AAA"] }, ["x"], [], new Date());
  const a = buildActions(m, ["x"], ["AAA"]);
  assert.deepStrictEqual(a.ok, []);
  assert.strictEqual(a.verify[0].countries[0].status, "unknown");
});

test("the timeline follows the whole route, departure included", () => {
  const t = buildTimeline(map, ids);
  assert.deepStrictEqual(t[0].stops.map((s) => s.country), ["DDD", "BBB", "AAA", "CCC", "EEE"]);
  assert.deepStrictEqual(t[0].stops.map((s) => s.status), ["unknown", "prescription", "allowed", "banned", "unknown"]);
});

test("the verdict is the worst case and counts the countries it concerns", () => {
  assert.deepStrictEqual(buildVerdict(map, ids, eval_), { kind: "banned", n: 1, total: 4 });
  assert.deepStrictEqual(buildVerdict(map, ids, ["BBB", "AAA"]), { kind: "prescription", n: 1, total: 2 });
  assert.deepStrictEqual(buildVerdict(map, ids, ["AAA", "EEE"]), { kind: "unknown", n: 1, total: 2 });
  assert.deepStrictEqual(buildVerdict(map, ids, ["AAA"]), { kind: "allowed", n: 1, total: 1 });
  const restrictedOnly = buildMap({ destinations: ["CCC"] }, ["y"], sources, new Date("2026-06-01"));
  assert.strictEqual(buildVerdict(restrictedOnly, ["y"], ["CCC"]).kind, "restricted");
});

test("worstOf ranks unknown above allowed and below prescription", () => {
  assert.ok(SEVERITY.allowed < SEVERITY.unknown && SEVERITY.unknown < SEVERITY.prescription);
  assert.strictEqual(worstOf(["allowed", "unknown"]), "unknown");
  assert.strictEqual(worstOf(["prescription", "unknown", "banned"]), "banned");
  assert.strictEqual(worstOf([]), "allowed");
});
