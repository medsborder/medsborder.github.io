import { UNKNOWN } from "./status.js";

/**
 * Lists of countries for the conclusions section.
 * ingredients: [{ id, required }]; countryCodes: countries to evaluate.
 */
export function buildConclusions(map, ingredients, countryCodes) {
  const out = {
    allAllowed: [],
    requiredAllowed: [],
    anyPrescription: [],
    requiredPrescription: [],
    optionalPrescription: [],
    anyRestrictedOrBanned: [],
    insufficientData: [],
  };
  const required = ingredients.filter((i) => i.required);
  const optional = ingredients.filter((i) => !i.required);
  for (const code of countryCodes) {
    const st = (i) => map.cells[code][i.id].status;
    const all = ingredients.map(st);
    const req = required.map(st);
    const opt = optional.map(st);
    if (all.length && all.every((s) => s === "allowed")) out.allAllowed.push(code);
    if (req.length && req.every((s) => s === "allowed")) out.requiredAllowed.push(code);
    if (all.includes("prescription")) out.anyPrescription.push(code);
    if (req.includes("prescription")) out.requiredPrescription.push(code);
    if (opt.includes("prescription")) out.optionalPrescription.push(code);
    if (all.some((s) => s === "restricted" || s === "banned")) out.anyRestrictedOrBanned.push(code);
    if (all.includes(UNKNOWN)) out.insufficientData.push(code);
  }
  return out;
}
