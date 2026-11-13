import { readFileSync } from "node:fs";

export const readJson = (p) =>
  JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));
