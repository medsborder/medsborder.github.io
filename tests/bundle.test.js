import test from "node:test";
import assert from "node:assert";
import { bundleData, rewriteHtml, contentHash } from "../scripts/lib/bundle.mjs";

const names = { app: "app.abc.js", consent: "consent.def.js", data: "data.123.json" };

test("bundleData merges countries, substances and every listed source", () => {
  const d = bundleData(new URL("../data", import.meta.url).pathname);
  assert.ok(d.countries.length > 100 && d.substances.length > 0);
  assert.strictEqual(d.sources.length, 4);
});

test("checker pages get the app bundle and a data preload, without the separate consent script", () => {
  const html = `<link rel="stylesheet" href="../assets/css/main.css">
  <script type="module" src="../assets/js/ui/app.js"></script>
  <script type="module" src="../assets/js/consent.js"></script>
</head>`;
  const out = rewriteHtml(html, names);
  assert.ok(out.includes('<link rel="preload" href="../assets/data.123.json" as="fetch" crossorigin>'));
  assert.ok(out.includes('<script type="module" src="../assets/app.abc.js"></script>'));
  assert.ok(!out.includes("consent") && !out.includes("assets/js/"));
});

test("other pages only get the consent bundle, keeping the original path prefix", () => {
  for (const prefix of ["", "../../", "/"]) {
    const out = rewriteHtml(`  <script type="module" src="${prefix}assets/js/consent.js"></script>\n</head>`, names);
    assert.ok(out.includes(`<script type="module" src="${prefix}assets/consent.def.js"></script>`), prefix);
    assert.ok(!out.includes("preload"));
  }
});

test("content hashes are short, stable and content-dependent", () => {
  assert.strictEqual(contentHash("a"), contentHash("a"));
  assert.notStrictEqual(contentHash("a"), contentHash("b"));
  assert.match(contentHash("a"), /^[0-9a-f]{10}$/);
});

test("the landing page gets the landing bundle instead of the separate consent script", () => {
  const html = `  <script type="module" src="assets/js/landing.js"></script>
  <script type="module" src="assets/js/consent.js"></script>
</head>`;
  const out = rewriteHtml(html, { ...names, landing: "landing.xyz.js" });
  assert.ok(out.includes('<script type="module" src="assets/landing.xyz.js"></script>'));
  assert.ok(!out.includes("consent") && !out.includes("assets/js/"));
});
