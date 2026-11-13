import test from "node:test";
import assert from "node:assert";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const PAGES = ["index.html", "404.html", "en/index.html", "uk/index.html", "en/privacy/index.html", "uk/privacy/index.html", "en/terms/index.html", "uk/terms/index.html"];
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const csp = (html) => html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/)?.[1];

test("every page has a CSP whose script hashes match the inline scripts", () => {
  for (const p of PAGES) {
    const html = read(p);
    const policy = csp(html);
    assert.ok(policy, `${p}: CSP meta`);
    assert.ok(policy.includes("default-src 'none'") && policy.includes("object-src 'none'"), p);
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    for (const code of inline) {
      const hash = createHash("sha256").update(code).digest("base64");
      assert.ok(policy.includes(`'sha256-${hash}'`), `${p}: inline script hash`);
    }
    assert.ok(!/unsafe-inline|unsafe-eval/.test(policy), p);
  }
});

test("Google Tag Manager is not referenced in any page and is never loaded through an iframe", () => {
  for (const p of PAGES) {
    const html = read(p).replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, "");
    assert.ok(!/googletagmanager|google-analytics|gtag|<iframe/i.test(html), p);
  }
});

test("GTM is loaded only from consent.js, with Consent Mode defaults denied", () => {
  const js = read("assets/js/consent.js");
  assert.ok(js.includes("googletagmanager.com/gtm.js"));
  assert.match(js, /gtag\("consent", "default",[\s\S]*?ad_storage: "denied"[\s\S]*?analytics_storage: "denied"/);
  assert.ok(js.indexOf('"default"') < js.indexOf('analytics_storage: "granted"'));
  assert.ok(js.indexOf("function loadGtm") < js.indexOf("googletagmanager.com/gtm.js"));
  // loadGtm is only reached through apply("granted")
  assert.strictEqual([...js.matchAll(/loadGtm\(\)/g)].length, 2); // definition call site + declaration use
});

test("every page loads the consent script and offers cookie settings", () => {
  for (const p of PAGES) {
    const html = read(p);
    assert.match(html, /<script type="module" src="[^"]*assets\/js\/consent\.js"><\/script>/, p);
    assert.ok(html.includes("data-cookie-settings"), p);
  }
});

test("EN and UK pages are structurally equal", () => {
  for (const [a, b] of [["en/index.html", "uk/index.html"], ["en/privacy/index.html", "uk/privacy/index.html"], ["en/terms/index.html", "uk/terms/index.html"]]) {
    const count = (html, tag) => (html.match(new RegExp(`<${tag}[ >]`, "g")) ?? []).length;
    for (const tag of ["h1", "h2", "li", "p", "a", "button"]) {
      assert.strictEqual(count(read(a), tag), count(read(b), tag), `${a} vs ${b}: ${tag}`);
    }
  }
});

test("the consent banner gives accept and reject the same prominence", () => {
  const js = read("assets/js/consent.js");
  assert.ok(js.includes('btn("granted", t.accept), btn("denied", t.reject)'));
  assert.strictEqual([...js.matchAll(/className: "btn"/g)].length, 1); // one factory, one class for both
});
