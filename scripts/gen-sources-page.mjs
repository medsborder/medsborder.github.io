// Writes en/sources/index.html and uk/sources/index.html. Run through `just sources-page` (Docker).
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { renderSourcesPage } from "./lib/sourcesPage.mjs";

const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const data = {
  countries: json("data/countries.json"),
  substances: json("data/substances.json"),
  sources: json("data/sources/index.json").map((f) => json(`data/sources/${f}`)),
};
for (const lang of ["en", "uk"]) {
  const terms = readFileSync(`${lang}/terms/index.html`, "utf8");
  mkdirSync(`${lang}/sources`, { recursive: true });
  writeFileSync(`${lang}/sources/index.html`, renderSourcesPage(lang, data, terms));
  console.log(`${lang}/sources/index.html`);
}
