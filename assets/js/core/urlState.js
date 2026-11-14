// Shareable state in the URL fragment (never sent to a server).
// #r=codeine,~my%20tea&from=UKR&via=POL&to=DEU,FRA
// Ingredient tokens: a substance id, or "~" + free text for a custom one.
// Older links may carry "o=" (optional ingredients); they are merged into "r=" on read.
export const MAX_TEXT = 60;
export const MAX_INGREDIENTS = 20;
export const MAX_COUNTRIES = 10;

const enc = (list) => list.map(encodeURIComponent).join(",");

export const customToken = (text) => `~${text}`;

export function serializeState(s) {
  const parts = [];
  if (s.ingredients.length) parts.push(`r=${enc(s.ingredients)}`);
  if (s.from) parts.push(`from=${encodeURIComponent(s.from)}`);
  if (s.via.length) parts.push(`via=${enc(s.via)}`);
  if (s.to.length) parts.push(`to=${enc(s.to)}`);
  return parts.join("&");
}

function values(val) {
  return val.split(",").filter(Boolean).flatMap((v) => {
    try { return [decodeURIComponent(v)]; } catch { return []; }
  });
}

const ingredient = (v) => {
  if (v.startsWith("~")) {
    const text = v.slice(1).trim().slice(0, MAX_TEXT);
    return text ? `~${text}` : null;
  }
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v) ? v : null;
};
const country = (v) => (/^[A-Z]{3}$/.test(v) ? v : null);
const clean = (list, fn, max) => [...new Set(list.map(fn).filter(Boolean))].slice(0, max);

/** Never throws; unknown or malformed parts are dropped. */
export function parseState(hash) {
  const out = { ingredients: [], from: null, via: [], to: [] };
  const found = { r: [], o: [] };
  const raw = String(hash ?? "").replace(/^#/, "");
  for (const part of raw.split("&")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const key = part.slice(0, i);
    const list = values(part.slice(i + 1));
    if (key === "r" || key === "o") found[key].push(...list.map(ingredient));
    else if (key === "from") out.from = clean(list, country, 1)[0] ?? null;
    else if (key === "via") out.via = clean(list, country, MAX_COUNTRIES);
    else if (key === "to") out.to = clean(list, country, MAX_COUNTRIES);
  }
  out.ingredients = clean([...found.r, ...found.o], (v) => v, MAX_INGREDIENTS);
  return out;
}
