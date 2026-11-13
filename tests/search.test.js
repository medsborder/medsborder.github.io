import test from "node:test";
import assert from "node:assert";
import { readJson } from "./helpers.js";
import { normalize, search, countryIndex, substanceIndex, displayName } from "../assets/js/core/search.js";
import { buildLinks } from "../assets/js/core/links.js";

const countries = readJson("data/countries.json");
const substances = readJson("data/substances.json");

test("normalize strips case, diacritics and apostrophe variants", () => {
  assert.strictEqual(normalize("  Türkiye "), "turkiye");
  assert.strictEqual(normalize("Кот-д’Івуар"), "кот-д'івуар");
});

test("country search: aliases, both languages, hidden excluded", () => {
  const idx = countryIndex(countries, "uk");
  assert.strictEqual(search(idx, "росія")[0].key, "RUS");
  assert.strictEqual(search(idx, "россия")[0].key, "RUS");
  assert.strictEqual(search(idx, "turkey")[0].key, "TUR");
  assert.strictEqual(search(idx, "germ")[0].key, "DEU");
  assert.strictEqual(search(idx, "uae")[0].key, "ARE");
  assert.ok(!search(idx, "antarc").some((e) => e.key === "ATA"));
  assert.deepStrictEqual(search(idx, ""), []);
});

test("country search shows the label in the page language", () => {
  assert.strictEqual(search(countryIndex(countries, "en"), "ukr")[0].label, "Ukraine");
  assert.strictEqual(search(countryIndex(countries, "uk"), "ukr")[0].label, "Україна");
});

test("substance search by name, brand and Ukrainian name; exclude works", () => {
  const idx = substanceIndex(substances, "uk");
  assert.strictEqual(search(idx, "кодеїн")[0].key, "codeine");
  assert.strictEqual(search(idx, "adderall")[0].key, "amphetamine");
  assert.strictEqual(search(idx, "булочка")[0].key, "poppy-seeds");
  assert.ok(!search(idx, "cod", { exclude: new Set(["codeine"]) }).some((e) => e.key === "codeine"));
});

test("display name format: English (Ukrainian) on the Ukrainian page", () => {
  const c = substances.find((s) => s.id === "codeine");
  assert.strictEqual(displayName(c, "en"), "Codeine");
  assert.strictEqual(displayName(c, "uk"), "Codeine (Кодеїн)");
});

test("links are encoded and use the page language", () => {
  const l = buildLinks({ lang: "en", ingredient: "Codeine", country: "Côte d'Ivoire" });
  assert.match(l.google.banned, /^https:\/\/www\.google\.com\/search\?q=Is%20Codeine%20banned/);
  assert.ok(l.google.allowed.includes("C%C3%B4te%20d'Ivoire"));
  const uk = buildLinks({ lang: "uk", ingredient: "Codeine", country: "Німеччина" });
  assert.ok(decodeURIComponent(uk.google.prescription).includes("чи потрібен рецепт"));
});
