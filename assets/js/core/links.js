// Per-ingredient Google searches. They send the ingredient and country names to
// Google, so the UI warns the user next to them. AI assistants are in assistants.js.
export const KINDS = ["allowed", "prescription", "banned"];

const GOOGLE = {
  en: {
    allowed: (i, c) => `Is ${i} available in ${c}? travelling with medication`,
    prescription: (i, c) => `Is a prescription needed for ${i} in ${c}?`,
    banned: (i, c) => `Is ${i} banned or prohibited in ${c}?`,
  },
  uk: {
    allowed: (i, c) => `${i} — чи доступний у країні: ${c}`,
    prescription: (i, c) => `${i} — чи потрібен рецепт у країні: ${c}`,
    banned: (i, c) => `${i} — чи заборонений у країні: ${c}`,
  },
};

export const googleUrl = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

/** Google searches for one ingredient in one country. */
export function buildLinks({ lang, ingredient, country }) {
  const g = GOOGLE[lang];
  return { google: Object.fromEntries(KINDS.map((k) => [k, googleUrl(g[k](ingredient, country))])) };
}
