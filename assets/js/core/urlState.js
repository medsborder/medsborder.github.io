// Shareable state in the URL fragment (never sent to a server).
// #r=codeine,~my%20tea&o=melatonin&from=UKR&via=POL&to=DEU,FRA
// Ingredient tokens: a substance id, or "~" + free text for a custom one.
export const MAX_TEXT = 60;
export const MAX_INGREDIENTS = 20;
export const MAX_COUNTRIES = 10;

const enc = (list) => list.map(encodeURIComponent).join(",");

export const customToken = (text) => `~${text}`;

export function serializeState(s) {
  const parts = [];
  if (s.required.length) parts.push(`r=${enc(s.required)}`);
  if (s.optional.length) parts.push(`o=${enc(s.optional)}`);
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
  const out = { required: [], optional: [], from: null, via: [], to: [] };
  const raw = String(hash ?? "").replace(/^#/, "");
  for (const part of raw.split("&")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const key = part.slice(0, i);
    const list = values(part.slice(i + 1));
    if (key === "r") out.required = clean(list, ingredient, MAX_INGREDIENTS);
    else if (key === "o") out.optional = clean(list, ingredient, MAX_INGREDIENTS);
    else if (key === "from") out.from = clean(list, country, 1)[0] ?? null;
    else if (key === "via") out.via = clean(list, country, MAX_COUNTRIES);
    else if (key === "to") out.to = clean(list, country, MAX_COUNTRIES);
  }
  return out;
}
