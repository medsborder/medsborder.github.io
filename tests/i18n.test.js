import test from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { STRINGS } from "../assets/js/ui/i18n.js";

const shape = (v) => (v && typeof v === "object" && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)]))
  : Array.isArray(v) ? v.map(() => "item") : typeof v);
const placeholders = (v) => (typeof v === "string" ? [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",") : v);
const flat = (v, path = "") => (v && typeof v === "object"
  ? Object.entries(v).flatMap(([k, x]) => flat(x, `${path}.${k}`))
  : [[path, v]]);

test("EN and UK have exactly the same keys, shapes and placeholders", () => {
  assert.deepStrictEqual(shape(STRINGS.uk), shape(STRINGS.en));
  const uk = new Map(flat(STRINGS.uk));
  for (const [path, v] of flat(STRINGS.en)) {
    assert.strictEqual(placeholders(uk.get(path)), placeholders(v), `placeholders differ at ${path}`);
    assert.ok(String(uk.get(path)).length > 0 && String(v).length > 0, `empty string at ${path}`);
  }
});

test("every string key is used by the UI, and the UI uses no missing key", () => {
  const ui = ["app.js", "picker.js"].map((f) => readFileSync(new URL(`../assets/js/ui/${f}`, import.meta.url), "utf8")).join("\n");
  const dotted = new Set([...ui.matchAll(/\bt\.(\w+)/g), ...ui.matchAll(/opts\.t\.(\w+)/g)].map((m) => m[1]));
  const quoted = new Set([...ui.matchAll(/"(\w+)"/g)].map((m) => m[1])); // keys picked through a lookup table
  const keys = Object.keys(STRINGS.en);
  assert.deepStrictEqual(keys.filter((k) => !dotted.has(k) && !quoted.has(k)), [], "unused string keys");
  assert.deepStrictEqual([...dotted].filter((k) => !keys.includes(k)), [], "keys used but missing");
});
