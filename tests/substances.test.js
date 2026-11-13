import test from "node:test";
import assert from "node:assert";
import { readJson } from "./helpers.js";
const substances = readJson("data/substances.json");
const countries = readJson("data/countries.json");

const CATEGORIES = new Set([
  "opioid", "stimulant", "benzodiazepine", "sleep-aid", "anticonvulsant",
  "decongestant", "cannabinoid", "food", "analgesic",
]);

test("ids are unique kebab-case", () => {
  const ids = substances.map((s) => s.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test("names are non-empty in EN and UK, category is known", () => {
  for (const s of substances) {
    assert.ok(s.names.en.length && s.names.uk.length, s.id);
    assert.ok(CATEGORIES.has(s.category), `${s.id}: ${s.category}`);
    assert.strictEqual(typeof s.common, "boolean", s.id);
  }
});

test("ATC codes have valid format", () => {
  for (const s of substances) {
    for (const a of s.atc) assert.match(a, /^[A-Z]\d{2}[A-Z]{2}\d{2}$/, s.id);
  }
});

test("alternatives reference existing substances", () => {
  const ids = new Set(substances.map((s) => s.id));
  for (const s of substances) {
    for (const a of s.alternatives) assert.ok(ids.has(a) && a !== s.id, `${s.id} -> ${a}`);
  }
});

test("hidden countries and Russia alias", () => {
  const hidden = countries.filter((c) => c.hidden).map((c) => c.alpha3).sort();
  assert.deepStrictEqual(hidden, ["ATA", "ATF", "BVT", "HMD", "SGS", "UMI"]);
  const rus = countries.find((c) => c.alpha3 === "RUS");
  assert.strictEqual(rus.name.uk, "Московія");
  assert.ok(rus.aliases.includes("Росія"));
});
