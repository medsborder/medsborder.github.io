import test from "node:test";
import assert from "node:assert";
import { FLAGS } from "../assets/js/core/flags.js";
import { buildSummary } from "../assets/js/core/summary.js";
import { coveredCountries } from "../assets/js/core/coverage.js";
import { readJson } from "./helpers.js";

test("every country that has a source also has a flag", () => {
  const sources = readJson("data/sources/index.json").map((f) => readJson(`data/sources/${f}`));
  for (const code of coveredCountries(sources)) assert.ok(FLAGS[code], `${code} has data but no flag in core/flags.js`);
});

test("flags are valid band definitions for known countries", () => {
  const codes = new Set(readJson("data/countries.json").map((c) => c.alpha3));
  for (const [code, f] of Object.entries(FLAGS)) {
    assert.ok(codes.has(code), code);
    assert.ok(["h", "v"].includes(f.dir) && f.colors.length >= 2 && f.colors.every((c) => /^#[0-9a-f]{6}$/i.test(c)), code);
  }
});

test("the summary skips empty groups and ends with the date, note and link", () => {
  const s = buildSummary({
    title: "MedsBorder", routeLabel: "Route", route: ["Ukraine", "Poland"], verdict: "Prescription needed in 1 of 1 countries",
    groups: [{ title: "Prepare", lines: ["Codeine: Poland (destination, prescription)"] }, { title: "Do not bring", lines: [] }],
    checkedOn: "Checked on 2026-11-14", note: "Not legal or medical advice.", url: "https://medsborder.github.io/en/#r=codeine",
  });
  assert.ok(s.startsWith("MedsBorder\nRoute: Ukraine → Poland\n"));
  assert.ok(s.includes("PREPARE\n- Codeine: Poland (destination, prescription)") && !s.includes("DO NOT BRING"));
  assert.ok(s.endsWith("https://medsborder.github.io/en/#r=codeine"));
});

import { reportUrl, REPO } from "../assets/js/core/report.js";

test("the report link opens a prefilled issue and asks for no personal details", () => {
  const u = new URL(reportUrl({ country: "Poland", rows: [{ ingredient: "Codeine", status: "restricted", sources: ["https://api.sejm.gov.pl/x"] }] }));
  assert.strictEqual(u.origin + u.pathname, `https://github.com/${REPO}/issues/new`);
  assert.strictEqual(u.searchParams.get("title"), "Incorrect data: Poland");
  assert.strictEqual(u.searchParams.get("labels"), "incorrect-data");
  const body = u.searchParams.get("body");
  assert.ok(body.includes("- Codeine: restricted (source: https://api.sejm.gov.pl/x)") && /personal or medical/.test(body));
});
