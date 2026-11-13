import { readFileSync, readdirSync } from "node:fs";
import { validateSources } from "../assets/js/core/validate.js";

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));
const countries = read("data/countries.json");
const substances = read("data/substances.json");
const dir = new URL("../data/sources/", import.meta.url);
const sources = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => read(`data/sources/${f}`));

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
