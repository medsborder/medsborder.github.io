import test from "node:test";
import assert from "node:assert";
import { serializeState, parseState, customToken, MAX_TEXT, MAX_COUNTRIES } from "../assets/js/core/urlState.js";

const state = {
  ingredients: ["codeine", customToken("my tea, with & chars ї"), "melatonin"], from: "UKR", via: ["POL"], to: ["DEU", "FRA"],
};

test("round trip keeps everything, including awkward custom text", () => {
  const hash = serializeState(state);
  assert.ok(!hash.includes(" "));
  assert.deepStrictEqual(parseState(`#${hash}`), state);
});

test("empty and garbage input never throws", () => {
  const empty = { ingredients: [], from: null, via: [], to: [] };
  assert.deepStrictEqual(parseState(""), empty);
  assert.deepStrictEqual(parseState("#"), empty);
  assert.deepStrictEqual(parseState("#r=%E0%A4%A&x&from=lower&to=DE,DEU,<script>"), { ...empty, to: ["DEU"] });
  assert.doesNotThrow(() => parseState(undefined));
});

test("limits and sanitising", () => {
  const long = "a".repeat(MAX_TEXT + 40);
  assert.strictEqual(parseState(`#r=~${long}`).ingredients[0].length, MAX_TEXT + 1);
  const many = Array.from({ length: 30 }, (_, i) => `C${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`);
  assert.strictEqual(parseState(`#to=${many.join(",")}`).to.length, MAX_COUNTRIES);
  assert.deepStrictEqual(parseState("#r=Codeine,../etc,codeine,codeine").ingredients, ["codeine"]);
  assert.deepStrictEqual(parseState("#r=~%20%20").ingredients, []);
});

test("a state with no data serialises to an empty string", () => {
  assert.strictEqual(serializeState({ ingredients: [], from: null, via: [], to: [] }), "");
});

test("old links with optional ingredients (o=) are merged into one list, required first", () => {
  assert.deepStrictEqual(parseState("#o=melatonin,codeine&r=codeine,zolpidem&from=UKR&to=DEU").ingredients,
    ["codeine", "zolpidem", "melatonin"]);
  assert.doesNotMatch(serializeState(parseState("#r=codeine&o=melatonin&to=DEU")), /(^|&)o=/);
});
