const test = require("node:test");
const assert = require("node:assert");
const countries = require("../data/countries.json");

test("alpha3 codes are unique, 3 uppercase letters", () => {
  const codes = countries.map((c) => c.alpha3);
  assert.strictEqual(new Set(codes).size, codes.length);
  for (const c of codes) assert.match(c, /^[A-Z]{3}$/);
});

test("every country has non-empty EN and UK names", () => {
  for (const c of countries) {
    assert.ok(c.name.en && c.name.uk, c.alpha3);
  }
});

test("territoryOf points to an existing country", () => {
  const codes = new Set(countries.map((c) => c.alpha3));
  for (const c of countries) {
    if (c.territoryOf) assert.ok(codes.has(c.territoryOf), c.alpha3);
  }
});

test("Taiwan uses the short name", () => {
  const t = countries.find((c) => c.alpha3 === "TWN");
  assert.strictEqual(t.name.en, "Taiwan");
  assert.strictEqual(t.name.uk, "Тайвань");
});
