import test from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { renderSourcesPage, SOURCES_TEXT } from "../scripts/lib/sourcesPage.mjs";
import { coveredCountries } from "../assets/js/core/coverage.js";
import { readJson } from "./helpers.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const data = {
  countries: readJson("data/countries.json"),
  substances: readJson("data/substances.json"),
  sources: readJson("data/sources/index.json").map((f) => readJson(`data/sources/${f}`)),
};

test("the committed sources pages match the data (run `just sources-page` after changing data/)", () => {
  for (const lang of ["en", "uk"]) {
    assert.strictEqual(read(`${lang}/sources/index.html`), renderSourcesPage(lang, data, read(`${lang}/terms/index.html`)), `${lang}/sources is stale`);
  }
});

test("every covered country, source link, date and substance appears on the page", () => {
  const covered = coveredCountries(data.sources);
  for (const lang of ["en", "uk"]) {
    const html = read(`${lang}/sources/index.html`);
    for (const c of data.countries.filter((x) => covered.has(x.alpha3))) assert.ok(html.includes(c.name[lang]), `${lang}: ${c.alpha3}`);
    for (const s of data.sources) {
      assert.ok(html.includes(`href="${s.url}"`) && html.includes(s.verifiedAt), `${lang}: ${s.id}`);
    }
    for (const s of data.substances) assert.ok(html.includes(s.names.en[0]), `${lang}: ${s.id}`);
    for (const [k] of SOURCES_TEXT[lang].statuses) assert.ok(html.includes(`status-${k}`), `${lang}: legend ${k}`);
    assert.ok(/rel="noopener noreferrer"/.test(html) && !/target="_blank"(?![^>]*noopener)/.test(html));
  }
});

test("the sources pages are linked from the footer of every page", () => {
  for (const [file, expect] of [["index.html", "en/sources/"], ["404.html", "/en/sources/"], ["en/index.html", "sources/"], ["uk/index.html", "sources/"],
    ["en/privacy/index.html", "../sources/"], ["uk/terms/index.html", "../sources/"]]) {
    const footer = read(file).split('class="site-footer"')[1];
    assert.ok(footer.includes(`href="${expect}`), `${file} footer`);
  }
});
