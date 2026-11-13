import test from "node:test";
import assert from "node:assert";
import { recommendCountries } from "../assets/js/core/recommend.js";
import { coveredCountries } from "../assets/js/core/coverage.js";

const src = (c, entries) => ({
  id: `s-${c}`, url: "https://example.org", scope: "country", countries: [c],
  verifiedAt: "2026-01-01", license: "t", entries: entries.map(([substance, status]) => ({ substance, status })),
});
const countries = ["AAA", "BBB", "CCC", "DDD", "EEE", "HHH"].map((a) => ({
  alpha3: a, name: { en: a, uk: a }, ...(a === "HHH" ? { hidden: true } : {}),
}));
const sources = [
  src("AAA", [["r", "allowed"], ["o", "allowed"]]),
  src("BBB", [["r", "allowed"], ["o", "prescription"]]),
  src("CCC", [["r", "banned"], ["o", "allowed"]]),
  src("DDD", [["r", "allowed"]]), // no data for "o"
  src("HHH", [["r", "allowed"], ["o", "allowed"]]),
];
const ing = [{ id: "r" }, { id: "o" }];

test("recommends only countries with data, excluding the route and hidden countries", () => {
  const rec = recommendCountries({ sources, countries, ingredients: ing, routeCodes: ["EEE"] });
  assert.deepStrictEqual(rec.allAllowed, ["AAA"]);
  assert.deepStrictEqual(rec.prescriptionOnly, ["BBB"]);
});

test("route countries are not recommended again", () => {
  const rec = recommendCountries({ sources, countries, ingredients: ing, routeCodes: ["AAA"] });
  assert.deepStrictEqual(rec.allAllowed, []);
});

test("a custom ingredient (no data) yields no recommendation", () => {
  const rec = recommendCountries({
    sources, countries, routeCodes: [], ingredients: [{ id: "custom:x" }, { id: "r" }],
  });
  assert.deepStrictEqual(rec, { allAllowed: [], prescriptionOnly: [] });
});

test("coveredCountries lists every country that has a source", () => {
  assert.deepStrictEqual([...coveredCountries(sources)].sort(), ["AAA", "BBB", "CCC", "DDD", "HHH"]);
});

import { POPULAR_COUNTRIES } from "../assets/js/core/coverage.js";
import { readJson } from "./helpers.js";

test("popular quick-pick countries exist, are not hidden and are listed once", () => {
  const all = new Map(readJson("data/countries.json").map((c) => [c.alpha3, c]));
  assert.strictEqual(new Set(POPULAR_COUNTRIES).size, POPULAR_COUNTRIES.length);
  for (const code of POPULAR_COUNTRIES) assert.ok(all.has(code) && !all.get(code).hidden, code);
});
