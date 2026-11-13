// Search and ChatGPT links. These send the ingredient and country names to
// third parties, so the UI warns the user next to them.
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

const CHATGPT = {
  en: {
    allowed: (i, c, r) => `I am travelling (${r}). Can I legally bring ${i} (medication or substance) into ${c}? Please cite official sources and tell me what to verify.`,
    prescription: (i, c, r) => `I am travelling (${r}). Do I need a prescription or permit to bring ${i} into ${c}? Please cite official sources and tell me what to verify.`,
    banned: (i, c, r) => `I am travelling (${r}). Is ${i} banned or prohibited in ${c}? Please cite official sources and tell me what to verify.`,
  },
  uk: {
    allowed: (i, c, r) => `Я подорожую (${r}). Чи можна легально ввезти ${i} (ліки або речовину) до країни: ${c}? Наведи офіційні джерела та що мені перевірити.`,
    prescription: (i, c, r) => `Я подорожую (${r}). Чи потрібні рецепт або дозвіл, щоб ввезти ${i} до країни: ${c}? Наведи офіційні джерела та що мені перевірити.`,
    banned: (i, c, r) => `Я подорожую (${r}). Чи заборонений ${i} у країні: ${c}? Наведи офіційні джерела та що мені перевірити.`,
  },
};

export const googleUrl = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
export const chatgptUrl = (p) => `https://chatgpt.com/?q=${encodeURIComponent(p)}`;

/** route: human-readable route text, e.g. "from Ukraine via Poland to Germany". */
export function buildLinks({ lang, ingredient, country, route }) {
  const g = GOOGLE[lang];
  const c = CHATGPT[lang];
  return {
    google: Object.fromEntries(KINDS.map((k) => [k, googleUrl(g[k](ingredient, country))])),
    chatgpt: Object.fromEntries(KINDS.map((k) => [k, chatgptUrl(c[k](ingredient, country, route))])),
  };
}
