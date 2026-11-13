import test from "node:test";
import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { buildSitemap, PAGES, SITE } from "../scripts/sitemap.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const file = (path) => (path.endsWith("/") ? `${path.slice(1)}index.html` : path.slice(1));
const meta = (html, attr, name) => html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`))?.[1];
const link = (html, rel) => [...html.matchAll(new RegExp(`<link rel="${rel}"([^>]*)>`, "g"))].map((m) => m[1]);
const attr = (s, name) => s.match(new RegExp(`${name}="([^"]*)"`))?.[1];
const pngSize = (p) => { const b = readFileSync(new URL(`../${p}`, import.meta.url)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const siteFile = (url) => url.replace(SITE, "").slice(1);

test("every indexable page has complete, consistent head metadata", () => {
  for (const { path } of PAGES) {
    const html = read(file(path));
    const title = html.match(/<title>(.*?)<\/title>/)[1];
    const desc = meta(html, "name", "description");
    const canonical = attr(link(html, "canonical")[0], "href");
    assert.strictEqual(canonical, `${SITE}${path}`, `${path}: canonical`);
    assert.ok(title.length >= 10 && title.length <= 70, `${path}: title length ${title.length}`);
    assert.ok(desc.length >= 50 && desc.length <= 200, `${path}: description length ${desc.length}`);
    for (const [a, n, v] of [["property", "og:type", "website"], ["property", "og:site_name", "MedsBorder"],
      ["property", "og:title", title.replace(/&amp;/g, "&")], ["property", "og:description", desc],
      ["property", "og:url", canonical], ["property", "og:image:width", "1200"], ["property", "og:image:height", "630"],
      ["name", "twitter:card", "summary_large_image"], ["name", "twitter:title", title.replace(/&amp;/g, "&")],
      ["name", "twitter:description", desc]]) {
      assert.strictEqual(meta(html, a, n)?.replace(/&amp;/g, "&"), v, `${path}: ${n}`);
    }
    const image = meta(html, "property", "og:image");
    assert.strictEqual(meta(html, "name", "twitter:image"), image, `${path}: twitter:image`);
    assert.ok(existsSync(new URL(`../${siteFile(image)}`, import.meta.url)), `${path}: og image exists`);
    assert.ok(meta(html, "property", "og:image:alt") && meta(html, "name", "twitter:image:alt"), `${path}: image alt`);
    assert.ok(meta(html, "property", "og:locale") && meta(html, "property", "og:locale:alternate"), `${path}: locale`);
  }
});

test("OG image language matches the page and images have the right size", () => {
  for (const lang of ["en", "uk"]) {
    const html = read(`${lang}/index.html`);
    assert.ok(meta(html, "property", "og:image").endsWith(`og-${lang}.png`));
    assert.deepStrictEqual(pngSize(`assets/og/og-${lang}.png`), [1200, 630]);
  }
});

test("icons, favicon and manifest exist, are linked and have the declared sizes", () => {
  const manifest = JSON.parse(read("site.webmanifest"));
  assert.ok(manifest.name && manifest.short_name && manifest.start_url && manifest.theme_color);
  for (const i of manifest.icons) {
    const [w, h] = i.sizes.split("x").map(Number);
    assert.deepStrictEqual(pngSize(i.src.slice(1)), [w, h], i.src);
  }
  assert.ok(manifest.icons.some((i) => i.purpose === "maskable"));
  assert.deepStrictEqual(pngSize("assets/icons/apple-touch-icon.png"), [180, 180]);
  assert.ok(read("assets/icons/icon.svg").startsWith("<svg"));
  assert.ok(readFileSync(new URL("../favicon.ico", import.meta.url)).readUInt16LE(2) === 1); // ICO type
  for (const { path } of PAGES) {
    const html = read(file(path));
    const hrefs = [...link(html, "icon"), ...link(html, "apple-touch-icon"), ...link(html, "manifest")].map((l) => attr(l, "href"));
    assert.strictEqual(hrefs.length, 4, `${path}: icon links`);
  }
  const notFound = read("404.html");
  assert.ok(notFound.includes('href="/favicon.ico"') && notFound.includes("noindex"));
});

test("JSON-LD is valid and the FAQ matches the visible text", () => {
  for (const lang of ["en", "uk"]) {
    const html = read(`${lang}/index.html`);
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    const app = ld["@graph"].find((n) => n["@type"] === "WebApplication");
    const faq = ld["@graph"].find((n) => n["@type"] === "FAQPage");
    assert.strictEqual(app.url, `${SITE}/${lang}/`);
    assert.strictEqual(app.inLanguage, lang);
    assert.strictEqual(app.isAccessibleForFree, true);
    const visible = [...html.matchAll(/<details><summary>(.*?)<\/summary><p>(.*?)<\/p><\/details>/g)].map((m) => [m[1], m[2]]);
    assert.ok(visible.length >= 3);
    assert.deepStrictEqual(faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]), visible);
  }
  const root = JSON.parse(read("index.html").match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.strictEqual(root["@type"], "WebSite");
  assert.ok(!JSON.stringify(root).includes("SearchAction"), "no fake site search");
});

test("sitemap is generated from the page list and matches each page's hreflang", () => {
  const xml = read("sitemap.xml");
  const lastmod = xml.match(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/)[1];
  assert.strictEqual(xml, buildSitemap(lastmod), "run `just sitemap`");
  assert.ok(!xml.includes("404"));
  for (const p of PAGES) {
    assert.ok(existsSync(new URL(`../${file(p.path)}`, import.meta.url)), p.path);
    if (!p.alt) continue;
    const head = link(read(file(p.path)), "alternate").map((l) => [attr(l, "hreflang"), attr(l, "href")]);
    const inMap = { ...Object.fromEntries(Object.entries(p.alt).map(([l, h]) => [l, `${SITE}${h}`])), "x-default": `${SITE}${p.xdefault}` };
    assert.deepStrictEqual(Object.fromEntries(head), inMap, p.path);
  }
});

test("robots.txt points at the sitemap, and the deploy workflow publishes every root file", () => {
  assert.ok(read("robots.txt").includes(`Sitemap: ${SITE}/sitemap.xml`));
  assert.ok(!/Disallow:\s*\/\s*$/m.test(read("robots.txt")));
  const copy = read("scripts/stage-site.sh").match(/cp -r (.*) _site\//)[1].split(/\s+/);
  for (const f of ["index.html", "404.html", "robots.txt", "sitemap.xml", "humans.txt", "site.webmanifest", "favicon.ico", "en", "uk", "assets", "data"]) {
    assert.ok(copy.includes(f), `stage-site.sh copies ${f}`);
  }
  assert.ok(read("humans.txt").includes("/* TEAM */"));
});
