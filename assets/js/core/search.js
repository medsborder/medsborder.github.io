/** Lowercase, strip diacritics, unify apostrophes and spaces. */
export function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ʼ’`']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function rank(q, term) {
  if (term === q) return 0;
  if (term.startsWith(q)) return 1;
  if (term.split(/[\s,()/-]+/).some((w) => w.startsWith(q))) return 2;
  if (term.includes(q)) return 3;
  return null;
}

/** entries: [{ key, label, terms: string[], ...rest }] */
export function buildIndex(entries) {
  return entries.map((e) => ({ ...e, norm: e.terms.filter(Boolean).map(normalize) }));
}

export function search(index, query, { limit = 8, exclude = new Set() } = {}) {
  const q = normalize(query);
  if (q.length === 0) return [];
  const hits = [];
  for (const e of index) {
    if (exclude.has(e.key)) continue;
    let best = null;
    for (const t of e.norm) {
      const r = rank(q, t);
      if (r !== null && (best === null || r < best)) best = r;
    }
    if (best !== null) hits.push({ e, best });
  }
  hits.sort((a, b) => a.best - b.best || a.e.label.localeCompare(b.e.label));
  return hits.slice(0, limit).map((h) => h.e);
}

export function countryIndex(countries, lang) {
  return buildIndex(
    countries
      .filter((c) => !c.hidden)
      .map((c) => ({
        key: c.alpha3,
        label: c.name[lang],
        terms: [c.name.en, c.name.uk, c.alpha3, ...(c.aliases ?? [])],
      }))
  );
}

export function displayName(substance, lang) {
  const en = substance.names.en[0];
  return lang === "en" ? en : `${en} (${substance.names.uk[0]})`;
}

export function substanceIndex(substances, lang) {
  return buildIndex(
    substances.map((s) => ({
      key: s.id,
      label: displayName(s, lang),
      terms: [...s.names.en, ...s.names.uk, s.inn, ...s.brands],
    }))
  );
}
