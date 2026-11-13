import test from "node:test";
import assert from "node:assert";
import { recommendCountries } from "../assets/js/core/recommend.js";

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
const ing = [{ id: "r", required: true }, { id: "o", required: false }];

test("recommends only countries with data, excluding the route and hidden countries", () => {
  const rec = recommendCountries({ sources, countries, ingredients: ing, routeCodes: ["EEE"] });
  assert.deepStrictEqual(rec.allAllowed, ["AAA"]);
  assert.deepStrictEqual(rec.requiredAllowed, ["AAA", "BBB", "DDD"]);
});

test("route countries are not recommended again", () => {
  const rec = recommendCountries({ sources, countries, ingredients: ing, routeCodes: ["AAA"] });
  assert.deepStrictEqual(rec.allAllowed, []);
  assert.ok(!rec.requiredAllowed.includes("AAA"));
});

test("custom ingredient (no data) yields no recommendation that needs it", () => {
  const rec = recommendCountries({
    sources, countries, routeCodes: [],
    ingredients: [{ id: "custom:x", required: true }, { id: "r", required: false }],
  });
  assert.deepStrictEqual(rec, { allAllowed: [], requiredAllowed: [] });
});
