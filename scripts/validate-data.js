import { readFileSync, readdirSync } from "node:fs";
import { validateSources } from "../assets/js/core/validate.js";

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));
const countries = read("data/countries.json");
const substances = read("data/substances.json");
const dir = new URL("../data/sources/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "index.json").sort();
const manifest = read("data/sources/index.json");
if (JSON.stringify([...manifest].sort()) !== JSON.stringify(files)) {
  console.error("data/sources/index.json must list exactly the source files:\n" + files.join("\n"));
  process.exit(1);
}
const sources = files.map((f) => read(`data/sources/${f}`));

const errors = validateSources(
  sources,
  new Set(countries.map((c) => c.alpha3)),
  new Set(substances.map((s) => s.id))
);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`data OK: ${countries.length} countries, ${substances.length} substances, ${sources.length} sources`);
