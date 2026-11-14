import test from "node:test";
import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { PAGES, SITE } from "../scripts/sitemap.mjs";

// Offline check of the links written in the static HTML (JS-built links are not covered).
const ROOT = new URL("../", import.meta.url).pathname;
const FILES = [...PAGES.map((p) => (p.path.endsWith("/") ? `${p.path.slice(1)}index.html` : p.path.slice(1))), "404.html"];
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

function targetFile(from, href) {
  const raw = href.replace(SITE, "");
  const clean = raw.split("#")[0].split("?")[0];
  const abs = clean.startsWith("/") ? clean.slice(1) : path.posix.join(path.posix.dirname(from), clean);
  const norm = path.posix.normalize(abs);
  return norm.endsWith("/") || norm === "." ? path.posix.join(norm === "." ? "" : norm, "index.html") : norm;
}

const refs = (html) => [...html.matchAll(/<(?:a|link|script|img)\s[^>]*?(?:href|src)="([^"]*)"/g)].map((m) => m[1])
  .filter((h) => h && !/^(mailto:|tel:|data:|javascript:)/.test(h) && (!/^https?:\/\//.test(h) || h.startsWith(SITE)));

test("every internal link and asset in the static pages exists", () => {
  for (const file of FILES) {
    for (const href of refs(read(file))) {
      if (href.startsWith("#")) continue;
      const target = targetFile(file, href);
      assert.ok(existsSync(path.join(ROOT, target)), `${file}: ${href} -> ${target} is missing`);
    }
  }
});

test("fragment links point to an existing id", () => {
  for (const file of FILES) {
    for (const href of refs(read(file)).filter((h) => h.includes("#"))) {
      const frag = href.split("#")[1];
      if (frag.includes("=")) continue; // checker state (#r=codeine&from=...), not an element id
      const target = href.startsWith("#") ? file : targetFile(file, href);
      if (!target.endsWith(".html") || !frag) continue;
      assert.ok(new RegExp(`id="${frag}"`).test(read(target)), `${file}: ${href} has no matching id`);
    }
  }
});

test("links that open a new tab use rel=noopener noreferrer", () => {
  for (const file of FILES) {
    for (const [tag] of read(file).matchAll(/<a\s[^>]*target="_blank"[^>]*>/g)) {
      assert.ok(/rel="noopener noreferrer"/.test(tag), `${file}: ${tag}`);
    }
  }
  // the same rule for links built in JavaScript
  const app = read("assets/js/ui/app.js");
  for (const [m] of app.matchAll(/target: "_blank"[^}]*}/g)) assert.ok(m.includes('rel: "noopener noreferrer"'), m);
});

test("every source url is https and not a placeholder", () => {
  const files = JSON.parse(read("data/sources/index.json"));
  for (const f of files) {
    const url = JSON.parse(read(`data/sources/${f}`)).url;
    assert.ok(url.startsWith("https://") && !/example\.(org|com)/.test(url), `${f}: ${url}`);
  }
});
