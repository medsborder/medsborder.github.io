import test from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("deploy waits for tests and the audit, and never runs for pull requests", () => {
  const wf = read(".github/workflows/pages.yml");
  assert.match(wf, /deploy:\s+needs: \[test, audit\]\s+if: github\.event_name != 'pull_request'/);
  assert.match(wf, /audit:\s+needs: test/);
  assert.ok(wf.includes("medsborder-audit") && wf.includes("upload-artifact"));
  assert.ok(wf.includes("./scripts/stage-site.sh"), "audit and deploy use the same staging script");
});

test("audit thresholds are strict and complete", () => {
  const t = JSON.parse(read("audit/thresholds.json"));
  assert.strictEqual(t.lighthouse.accessibility, 1);
  assert.ok(t.lighthouse.performance >= 0.9 && t.lighthouse["best-practices"] >= 0.9 && t.lighthouse.seo >= 0.9);
  assert.strictEqual(t.axe.maxViolations, 0);
});

test("layout-shift reservations stay in the stylesheet", () => {
  const css = read("assets/css/main.css");
  assert.match(css, /#app \{ min-height: \d+rem; \}/);
  assert.match(css, /#theme-slot \{[^}]*min-width/);
});

test("a weekly workflow checks the source links", () => {
  const wf = read(".github/workflows/links.yml");
  assert.match(wf, /cron:/);
  assert.ok(wf.includes("scripts/check-links.mjs") && wf.includes("upload-artifact"));
});
