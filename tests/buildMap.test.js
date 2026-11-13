import test from "node:test";
import assert from "node:assert";
import { buildMap, routeWarnings, MAX_ROUTE_COUNTRIES } from "../assets/js/core/buildMap.js";

const NOW = new Date("2026-06-01T00:00:00Z");
// Fictional fixtures: these are NOT real legal facts.
const src = (id, scope, countries, entries, verifiedAt = "2026-01-01") => ({
  id, url: `https://example.org/${id}`, scope, countries, verifiedAt, license: "test",
  entries: entries.map(([substance, status]) => ({ substance, status })),
});
const cell = (m, c, s) => m.cells[c][s];

test("no data -> unknown, never allowed", () => {
  const m = buildMap({ departure: "AAA", destinations: ["BBB"] }, ["x"], [], NOW);
  assert.strictEqual(cell(m, "BBB", "x").status, "unknown");
  assert.deepStrictEqual(cell(m, "BBB", "x").sources, []);
});

test("country source overrides group source and keeps both listed", () => {
  const sources = [
    src("grp", "group", ["AAA", "BBB"], [["x", "banned"]]),
    src("aaa", "country", ["AAA"], [["x", "allowed"]]),
  ];
  const m = buildMap({ destinations: ["AAA", "BBB"] }, ["x"], sources, NOW);
  assert.strictEqual(cell(m, "AAA", "x").status, "allowed");
  assert.strictEqual(cell(m, "BBB", "x").status, "banned");
  const listed = cell(m, "AAA", "x").sources;
  assert.deepStrictEqual(listed.map((s) => [s.id, s.overridden]), [["grp", true], ["aaa", false]]);
});

test("same-level conflict -> strictest wins", () => {
  const sources = [
    src("s1", "country", ["AAA"], [["x", "allowed"]]),
    src("s2", "country", ["AAA"], [["x", "prescription"]]),
  ];
  const m = buildMap({ destinations: ["AAA"] }, ["x"], sources, NOW);
  assert.strictEqual(cell(m, "AAA", "x").status, "prescription");
});

test("transit-only country uses transit sources; fallback is flagged", () => {
  const sources = [
    src("c", "country", ["AAA", "BBB"], [["x", "allowed"]]),
    src("t", "transit", ["AAA"], [["x", "banned"]]),
  ];
  const m = buildMap({ transit: ["AAA", "BBB"], destinations: ["CCC"] }, ["x"], sources, NOW);
  assert.strictEqual(cell(m, "AAA", "x").status, "banned");
  assert.strictEqual(cell(m, "AAA", "x").transitFallback, false);
  assert.strictEqual(cell(m, "BBB", "x").status, "allowed");
  assert.strictEqual(cell(m, "BBB", "x").transitFallback, true);
});

test("transit sources are ignored when the country is also a destination", () => {
  const sources = [
    src("c", "country", ["AAA"], [["x", "allowed"]]),
    src("t", "transit", ["AAA"], [["x", "banned"]]),
  ];
  const m = buildMap({ transit: ["AAA"], destinations: ["AAA"] }, ["x"], sources, NOW);
  assert.strictEqual(cell(m, "AAA", "x").status, "allowed");
  assert.deepStrictEqual(m.countries, [{ alpha3: "AAA", roles: ["transit", "destination"] }]);
});

test("stale flag after 365 days", () => {
  const sources = [src("old", "country", ["AAA"], [["x", "allowed"]], "2025-01-01"),
                   src("new", "country", ["BBB"], [["x", "allowed"]], "2026-05-01")];
  const m = buildMap({ destinations: ["AAA", "BBB"] }, ["x"], sources, NOW);
  assert.strictEqual(cell(m, "AAA", "x").stale, true);
  assert.strictEqual(cell(m, "BBB", "x").stale, false);
});

test("route limit and duplicate handling", () => {
  const codes = Array.from({ length: MAX_ROUTE_COUNTRIES + 1 }, (_, i) => `C${String(i).padStart(2, "0")}`);
  assert.throws(() => buildMap({ destinations: codes }, ["x"], [], NOW), RangeError);
  const ok = buildMap({ departure: "AAA", destinations: ["BBB", "BBB"] }, ["x", "x"], [], NOW);
  assert.strictEqual(ok.countries.length, 2);
  assert.deepStrictEqual(ok.substances, ["x"]);
});

test("routeWarnings: allowed in one, banned in another", () => {
  const sources = [
    src("a", "country", ["AAA"], [["poppy", "allowed"], ["pill", "allowed"]]),
    src("b", "country", ["BBB"], [["poppy", "banned"], ["pill", "prescription"]]),
  ];
  const m = buildMap({ departure: "AAA", transit: ["BBB"], destinations: ["CCC"] }, ["pill", "poppy"], sources, NOW);
  const w = routeWarnings(m, [{ id: "poppy", common: true }, { id: "pill", common: false }]);
  assert.deepStrictEqual(w.map((x) => x.substance), ["poppy", "pill"]);
  assert.deepStrictEqual(w[0].lenient, [{ country: "AAA", status: "allowed" }]);
  assert.deepStrictEqual(w[0].strict, [{ country: "BBB", status: "banned" }]);
  assert.deepStrictEqual(w[0].unknown, ["CCC"]);
});

test("routeWarnings: no warning when equal or only one known", () => {
  const sources = [src("a", "country", ["AAA"], [["x", "banned"]]),
                   src("b", "country", ["BBB"], [["x", "banned"]])];
  const m = buildMap({ departure: "AAA", destinations: ["BBB", "CCC"] }, ["x"], sources, NOW);
  assert.deepStrictEqual(routeWarnings(m), []);
});

test("routeWarnings: neighbouring steps are not notable, wider gaps are", () => {
  const mk = (a, b) => buildMap(
    { departure: "AAA", destinations: ["BBB"] }, ["x"],
    [src("a", "country", ["AAA"], [["x", a]]), src("b", "country", ["BBB"], [["x", b]])], NOW);
  assert.deepStrictEqual(routeWarnings(mk("prescription", "restricted")), []);
  assert.deepStrictEqual(routeWarnings(mk("restricted", "banned")), []);
  assert.strictEqual(routeWarnings(mk("prescription", "banned")).length, 1);
  assert.strictEqual(routeWarnings(mk("allowed", "prescription")).length, 1);
});
