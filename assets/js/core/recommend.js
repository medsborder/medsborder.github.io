import { buildCells } from "./buildMap.js";

/**
 * An alternative route: other countries (not on the route) where every
 * ingredient is "allowed", and where nothing is banned or restricted but at
 * least one ingredient needs a prescription. Countries with any unknown
 * ingredient never qualify: unknown is not allowed. ingredients: [{ id }].
 */
export function recommendCountries({ sources, countries, ingredients, routeCodes, now = new Date() }) {
  const exclude = new Set(routeCodes);
  const candidates = countries
    .filter((c) => !c.hidden && !exclude.has(c.alpha3))
    .map((c) => ({ alpha3: c.alpha3, roles: ["destination"] }));
  const cells = buildCells(candidates, ingredients.map((i) => i.id), sources, now);
  const out = { allAllowed: [], prescriptionOnly: [] };
  if (!ingredients.length) return out;
  for (const { alpha3 } of candidates) {
    const statuses = ingredients.map((i) => cells[alpha3][i.id].status);
    if (statuses.every((s) => s === "allowed")) out.allAllowed.push(alpha3);
    else if (statuses.every((s) => s === "allowed" || s === "prescription")) out.prescriptionOnly.push(alpha3);
  }
  return out;
}
