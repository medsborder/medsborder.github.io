import { buildCells } from "./buildMap.js";

/**
 * Other countries (not on the route) where every ingredient / every required
 * ingredient is "allowed". Countries without data never qualify: unknown is
 * not allowed. ingredients: [{ id, required }].
 */
export function recommendCountries({ sources, countries, ingredients, routeCodes, now = new Date() }) {
  const exclude = new Set(routeCodes);
  const candidates = countries
    .filter((c) => !c.hidden && !exclude.has(c.alpha3))
    .map((c) => ({ alpha3: c.alpha3, roles: ["destination"] }));
  const cells = buildCells(candidates, ingredients.map((i) => i.id), sources, now);
  const required = ingredients.filter((i) => i.required);
  const allowed = (code, list) => list.every((i) => cells[code][i.id].status === "allowed");
  const out = { allAllowed: [], requiredAllowed: [] };
  for (const { alpha3 } of candidates) {
    if (ingredients.length && allowed(alpha3, ingredients)) out.allAllowed.push(alpha3);
    if (required.length && allowed(alpha3, required)) out.requiredAllowed.push(alpha3);
  }
  return out;
}
