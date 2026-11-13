import test from "node:test";
import assert from "node:assert";
import { validateSources } from "../assets/js/core/validate.js";

const C = new Set(["AAA", "BBB"]);
const S = new Set(["x"]);
const good = () => ({
  id: "s1", url: "https://example.org", scope: "country", countries: ["AAA"],
  verifiedAt: "2026-01-01", license: "test", entries: [{ substance: "x", status: "allowed" }],
});

test("valid source passes", () => {
  assert.deepStrictEqual(validateSources([good()], C, S), []);
});

test("invalid sources are reported", () => {
  const bad = (patch) => validateSources([{ ...good(), ...patch }], C, S).length > 0;
  assert.ok(bad({ url: "http://example.org" }));
  assert.ok(bad({ scope: "world" }));
  assert.ok(bad({ verifiedAt: "yesterday" }));
  assert.ok(bad({ license: "" }));
  assert.ok(bad({ countries: ["ZZZ"] }));
  assert.ok(bad({ countries: ["AAA", "BBB"] })); // country scope = 1 country
  assert.ok(bad({ entries: [{ substance: "nope", status: "allowed" }] }));
  assert.ok(bad({ entries: [{ substance: "x", status: "unknown" }] })); // unknown is not stored
  assert.ok(bad({ entries: [{ substance: "x", status: "allowed" }, { substance: "x", status: "banned" }] }));
});

test("duplicate source ids are reported", () => {
  assert.ok(validateSources([good(), good()], C, S).length > 0);
});
