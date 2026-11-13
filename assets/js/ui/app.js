import { h, fmt } from "./dom.js";
import { STRINGS } from "./i18n.js";
import { createPicker } from "./picker.js";
import { buildMap, routeWarnings, MAX_ROUTE_COUNTRIES } from "../core/buildMap.js";
import { buildConclusions } from "../core/conclusions.js";
import { recommendCountries } from "../core/recommend.js";
import { track } from "../analytics.js";
import { serializeState, parseState, customToken } from "../core/urlState.js";
import { buildLinks, KINDS } from "../core/links.js";
import { normalize, search, countryIndex, substanceIndex, displayName } from "../core/search.js";

const lang = document.documentElement.lang === "uk" ? "uk" : "en";
const t = STRINGS[lang];
const DATA = new URL("../../../data/", import.meta.url);
const ICONS = { allowed: "✓", prescription: "℞", restricted: "!", banned: "✕", unknown: "?" };

// ---------- theme ----------
function initTheme(slot) {
  let saved = "system";
  try { saved = localStorage.getItem("theme") || "system"; } catch { /* storage may be blocked */ }
  const apply = (v) => {
    if (v === "light" || v === "dark") document.documentElement.dataset.theme = v;
    else delete document.documentElement.dataset.theme;
  };
  const select = h("select", {
    id: "theme-select",
    onchange: (e) => {
      apply(e.target.value);
      try { localStorage.setItem("theme", e.target.value); } catch { /* ignore */ }
    },
  }, ["system", "light", "dark"].map((v) => h("option", { value: v, selected: v === saved }, t.themes[v])));
  apply(saved);
  slot.replaceChildren(h("label", { for: "theme-select" }, t.theme, " "), select);
}

// ---------- data ----------
async function loadJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

async function loadData() {
  // The production build merges all data into one file (see build/build.mjs).
  if (typeof __DATA_BUNDLE__ !== "undefined") return loadJson(new URL(__DATA_BUNDLE__, import.meta.url));
  const [countries, substances, manifest] = await Promise.all([
    loadJson(new URL("countries.json", DATA)),
    loadJson(new URL("substances.json", DATA)),
    loadJson(new URL("sources/index.json", DATA)),
  ]);
  const sources = await Promise.all(manifest.map((f) => loadJson(new URL(`sources/${f}`, DATA))));
  return { countries, substances, sources };
}

// ---------- app ----------
async function init() {
  const slot = document.getElementById("app");
  initTheme(document.getElementById("theme-slot"));
  slot.replaceChildren(h("p", { class: "notice", role: "status" }, t.loading));

  let data;
  try {
    data = await loadData();
  } catch (err) {
    console.error(err);
    slot.replaceChildren(h("p", { class: "notice error", role: "alert" }, t.loadError));
    return;
  }
  const { countries, substances, sources } = data;
  const countryByCode = new Map(countries.map((c) => [c.alpha3, c]));
  const substanceById = new Map(substances.map((s) => [s.id, s]));
  const cIndex = countryIndex(countries, lang);
  const sIndex = substanceIndex(substances, lang);
  const countryName = (code) => countryByCode.get(code)?.name[lang] ?? code;

  const ingredientId = (item) => (item.custom ? `custom:${normalize(item.text)}` : item.key);
  const ingredientLabel = (it) => it.label;
  const ingredientEnglish = (it) => (it.custom ? it.text : substanceById.get(it.key).names.en[0]);

  // pickers
  const routeCodes = () => [
    ...departure.getItems(), ...layovers.getItems(), ...destinations.getItems(),
  ].map((i) => i.key);

  function ingredientCanAdd(item) {
    const id = ingredientId(item);
    const all = [...required.getItems(), ...optional.getItems()];
    if (all.some((i) => ingredientId(i) === id)) return fmt(t.alreadyAdded, { name: item.label });
    if (item.custom) {
      const n = normalize(item.text);
      if (sIndex.some((e) => e.norm.includes(n))) return t.alreadyKnown;
    }
    return null;
  }

  function countryCanAdd(item, self) {
    const others = [departure, layovers, destinations].filter((p) => p !== self).flatMap((p) => p.getItems());
    if (others.some((i) => i.key === item.key) || self.getItems().some((i) => i.key === item.key)) {
      return fmt(t.countryUsed, { name: item.label });
    }
    const total = routeCodes().length - (self === departure ? self.getItems().length : 0);
    if (total >= MAX_ROUTE_COUNTRIES) return fmt(t.routeFull, { n: MAX_ROUTE_COUNTRIES });
    return null;
  }

  const common = { t };
  const ingredientSearch = () => (q) => search(sIndex, q, {
    exclude: new Set([...required.getItems(), ...optional.getItems()].filter((i) => !i.custom).map((i) => i.key)),
  });
  const required = createPicker({
    ...common, label: t.required, hint: t.requiredHint, allowCustom: true,
    customLabel: (q) => fmt(t.addCustom, { q }), search: ingredientSearch(), canAdd: ingredientCanAdd, onChange: sync,
  });
  const optional = createPicker({
    ...common, label: t.optional, hint: t.optionalHint, allowCustom: true,
    customLabel: (q) => fmt(t.addCustom, { q }), search: ingredientSearch(), canAdd: ingredientCanAdd, onChange: sync,
  });
  const countrySearch = (q) => search(cIndex, q, { exclude: new Set(routeCodes()) });
  const departure = createPicker({
    ...common, label: t.departure, hint: t.departureHint, single: true, search: countrySearch,
    canAdd: (i) => countryCanAdd(i, departure), onChange: sync,
  });
  const layovers = createPicker({
    ...common, label: t.layovers, hint: t.layoversHint, search: countrySearch,
    canAdd: (i) => countryCanAdd(i, layovers), onChange: sync,
  });
  const destinations = createPicker({
    ...common, label: t.destinations, hint: t.destinationsHint, search: countrySearch,
    canAdd: (i) => countryCanAdd(i, destinations), onChange: sync,
  });

  // ---------- shareable state (URL fragment) ----------
  const tokenOf = (i) => (i.custom ? customToken(i.text) : i.key);
  const uiState = () => ({
    required: required.getItems().map(tokenOf),
    optional: optional.getItems().map(tokenOf),
    from: departure.getItems()[0]?.key ?? null,
    via: layovers.getItems().map((i) => i.key),
    to: destinations.getItems().map((i) => i.key),
  });
  const langLink = document.querySelector(".site-header a[hreflang]");
  const langBase = langLink?.getAttribute("href") ?? "";

  function persist() {
    const frag = serializeState(uiState());
    try { history.replaceState(null, "", frag ? `#${frag}` : location.pathname + location.search); } catch { /* ignore */ }
    langLink?.setAttribute("href", frag ? `${langBase}#${frag}` : langBase);
  }

  function applyState(st) {
    const ids = new Set();
    const ingredients = (tokens) => tokens.flatMap((tok) => {
      let item;
      if (tok.startsWith("~")) {
        const text = tok.slice(1);
        if (sIndex.some((e) => e.norm.includes(normalize(text)))) return [];
        item = { key: `custom:${text.toLowerCase()}`, label: text, custom: true, text };
      } else {
        const sub = substanceById.get(tok);
        if (!sub) return [];
        item = { key: sub.id, label: displayName(sub, lang) };
      }
      const id = ingredientId(item);
      if (ids.has(id)) return [];
      ids.add(id);
      return [item];
    });
    const used = new Set();
    let budget = MAX_ROUTE_COUNTRIES;
    const places = (codes) => codes.flatMap((code) => {
      if (!countryByCode.has(code) || used.has(code) || budget <= 0) return [];
      used.add(code);
      budget -= 1;
      return [{ key: code, label: countryName(code) }];
    });
    required.setItems(ingredients(st.required));
    optional.setItems(ingredients(st.optional));
    departure.setItems(places(st.from ? [st.from] : []));
    layovers.setItems(places(st.via));
    destinations.setItems(places(st.to));
    sync();
  }

  const canSubmit = () =>
    required.getItems().length >= 1 && departure.getItems().length === 1 && destinations.getItems().length >= 1;

  function restoreFromHash() {
    const next = location.hash.replace(/^#/, "");
    if (next === serializeState(uiState())) return;
    applyState(parseState(location.hash));
    if (canSubmit()) render();
    else { results.hidden = true; results.replaceChildren(); }
  }

  const submit = h("button", { type: "submit", class: "btn primary", id: "check-btn", "aria-describedby": "submit-hint" }, t.check);
  const resetBtn = h("button", { type: "button", class: "btn", onclick: reset }, t.reset);
  const submitHint = h("p", { id: "submit-hint", class: "hint" }, t.submitNeeds);
  const results = h("section", {
    id: "results", "aria-labelledby": "results-title", hidden: true,
    onclick: (e) => {
      const a = e.target.closest?.("a[data-link-type]");
      if (a) track("external_link_click", { link_type: a.dataset.linkType });
    },
  });

  const form = h("form", { id: "check-form", novalidate: true, onsubmit: onSubmit },
    h("fieldset", {}, h("legend", {}, lang === "uk" ? "Інгредієнти" : "Ingredients"), required.el, optional.el),
    h("fieldset", {}, h("legend", {}, t.resultsRoute), departure.el, layovers.el, destinations.el),
    h("div", { class: "actions" }, submit, resetBtn),
    submitHint);

  slot.replaceChildren(form, results);

  function sync() {
    const total = routeCodes().length;
    const full = total >= MAX_ROUTE_COUNTRIES;
    layovers.setDisabled(full, fmt(t.routeFull, { n: MAX_ROUTE_COUNTRIES }));
    destinations.setDisabled(full, fmt(t.routeFull, { n: MAX_ROUTE_COUNTRIES }));
    const ok = canSubmit();
    submit.setAttribute("aria-disabled", String(!ok));
    submit.classList.toggle("disabled", !ok);
    submitHint.hidden = ok;
  }

  function reset() {
    [required, optional, departure, layovers, destinations].forEach((p) => p.clear());
    results.hidden = true;
    results.replaceChildren();
    sync();
    persist();
    required.focus();
  }

  function onSubmit(e) {
    e.preventDefault();
    if (submit.getAttribute("aria-disabled") === "true") {
      submitHint.hidden = false;
      return;
    }
    render();
    const title = document.getElementById("results-title");
    title?.focus();
  }

  // ---------- results ----------
  function render() {
    const ingredients = [
      ...required.getItems().map((i) => ({ ...i, id: ingredientId(i), required: true })),
      ...optional.getItems().map((i) => ({ ...i, id: ingredientId(i), required: false })),
    ];
    const route = {
      departure: departure.getItems()[0].key,
      transit: layovers.getItems().map((i) => i.key),
      destinations: destinations.getItems().map((i) => i.key),
    };
    const map = buildMap(route, ingredients.map((i) => i.id), sources, new Date());
    const labelOf = new Map(ingredients.map((i) => [i.id, ingredientLabel(i)]));
    const routeText = `${t.routePrefix}: ${map.countries.map((c) => countryName(c.alpha3)).join(t.routeSeparator)}`;
    const statusText = (s) => t.status[s];

    const warnings = routeWarnings(map, substances);
    const evalCodes = map.countries.filter((c) => !(c.roles.length === 1 && c.roles[0] === "departure")).map((c) => c.alpha3);
    const concl = buildConclusions(map, ingredients, evalCodes);

    const list = (codes) => (codes.length ? codes.map(countryName).join(", ") : t.none);

    const warningsEl = warnings.length
      ? h("section", { class: "warnings", "aria-labelledby": "warn-title" },
        h("h3", { id: "warn-title" }, "⚠ ", t.warningsTitle),
        h("p", {}, t.warningsIntro),
        h("ul", {}, warnings.map((w) => h("li", {}, fmt(t.warningLine, {
          name: labelOf.get(w.substance),
          mild: w.lenient.map((x) => `${countryName(x.country)} (${statusText(x.status)})`).join(", "),
          strict: w.strict.map((x) => `${countryName(x.country)} (${statusText(x.status)})`).join(", "),
        })))))
      : null;

    const conclEl = h("section", { "aria-labelledby": "concl-title" },
      h("h3", { id: "concl-title" }, t.conclusions),
      h("dl", { class: "conclusions" }, Object.keys(t.conclusionTitles).flatMap((k) => [
        h("dt", {}, t.conclusionTitles[k]),
        h("dd", {}, list(concl[k])),
      ])));

    const tableEl = h("section", { "aria-labelledby": "table-title" },
      h("h3", { id: "table-title" }, t.table),
      h("p", { class: "hint" }, t.privacy),
      map.countries.map((c) => countryCard(c, map, ingredients, routeText)));

    const sortByName = (codes) => [...codes].sort((a, b) => countryName(a).localeCompare(countryName(b), lang));
    const reco = recommendCountries({
      sources, countries, ingredients, routeCodes: map.countries.map((c) => c.alpha3),
    });
    const recoEl = h("section", { "aria-labelledby": "reco-title" },
      h("h3", { id: "reco-title" }, t.recommendations),
      h("p", { class: "hint" }, t.recoIntro),
      h("dl", { class: "conclusions" },
        h("dt", {}, t.recoAll), h("dd", {}, list(sortByName(reco.allAllowed))),
        h("dt", {}, t.recoRequired), h("dd", {}, list(sortByName(reco.requiredAllowed)))),
      ingredients.some((i) => i.custom) ? h("p", { class: "hint" }, t.recoCustom) : null);

    const copyStatus = h("span", { class: "field-msg", role: "status", "aria-live": "polite" });
    const copyBtn = h("button", {
      type: "button", class: "btn",
      onclick: async () => {
        try {
          await navigator.clipboard.writeText(location.href);
          copyStatus.textContent = t.linkCopied;
          track("share_link_copied");
        } catch { copyStatus.textContent = t.copyFailed; }
      },
    }, t.copyLink);
    const shareEl = h("div", { class: "share" }, copyBtn, " ", copyStatus, h("p", { class: "hint" }, t.shareNote));

    results.replaceChildren(
      h("h2", { id: "results-title", tabindex: "-1" }, t.results),
      h("p", { class: "route-line" }, `${t.resultsRoute}: ${map.countries.map((c) => countryName(c.alpha3)).join(t.routeSeparator)}`),
      shareEl, warningsEl, conclEl, tableEl, recoEl);
    results.hidden = false;
    persist();
    // Counts only: ingredient and country names are never sent to analytics.
    track("check_submitted", {
      required_count: required.getItems().length, optional_count: optional.getItems().length,
      layover_count: layovers.getItems().length, destination_count: destinations.getItems().length,
    });
  }

  function countryCard(c, map, ingredients, routeText) {
    const name = countryName(c.alpha3);
    const roleText = c.roles.map((r) => t.roles[r]).join(" + ");
    return h("section", { class: "country", "aria-labelledby": `c-${c.alpha3}` },
      h("h4", { id: `c-${c.alpha3}` }, name, " ", h("span", { class: "role" }, roleText)),
      h("table", { class: "results" },
        h("caption", { class: "sr-only" }, `${t.table}: ${name}`),
        h("thead", {}, h("tr", {},
          h("th", { scope: "col" }, t.colIngredient), h("th", { scope: "col" }, t.colStatus),
          h("th", { scope: "col" }, t.colSources), h("th", { scope: "col" }, t.colCheck))),
        h("tbody", {}, ingredients.map((ing) => ingredientRow(c, ing, map, name, routeText)))));
  }

  function ingredientRow(c, ing, map, countryLabel, routeText) {
    const cell = map.cells[c.alpha3][ing.id];
    const links = buildLinks({
      lang, ingredient: ingredientEnglish(ing), country: countryLabel, route: routeText,
    });
    return h("tr", {},
      h("th", { scope: "row", "data-label": t.colIngredient },
        ing.label, " ", h("span", { class: "tag" }, ing.required ? t.reqTag : t.optTag)),
      h("td", { "data-label": t.colStatus },
        h("span", { class: `status status-${cell.status}` },
          h("span", { class: "icon", "aria-hidden": "true" }, ICONS[cell.status]), " ", t.status[cell.status]),
        cell.stale ? h("p", { class: "flag" }, t.stale) : null,
        cell.transitFallback ? h("p", { class: "flag" }, t.transitFallback) : null),
      h("td", { "data-label": t.colSources }, sourcesCell(cell, ing)),
      h("td", { "data-label": t.colCheck },
        h("details", {},
          h("summary", {}, t.colCheck),
          linkGroup(t.googleGroup, links.google, "google"),
          linkGroup(t.chatgptGroup, links.chatgpt, "chatgpt"))));
  }

  function sourcesCell(cell, ing) {
    if (cell.sources.length === 0) {
      return h("p", { class: "muted" }, ing.custom ? t.customNoData : t.noSources);
    }
    return h("ul", { class: "sources" }, cell.sources.map((s) => {
      let host = s.url;
      try { host = new URL(s.url).hostname; } catch { /* keep raw */ }
      return h("li", {},
        h("a", { href: s.url, target: "_blank", rel: "noopener noreferrer", "data-link-type": "source" }, host),
        " · ", t.status[s.status], " · ", fmt(t.verified, { date: s.verifiedAt }),
        s.overridden ? [" · ", t.overridden] : null,
        s.note && !s.overridden ? h("p", { class: "note" }, s.note) : null);
    }));
  }

  function linkGroup(title, urls, type) {
    return h("div", { class: "link-group" },
      h("p", { class: "link-title" }, title),
      h("ul", {}, KINDS.map((k) =>
        h("li", {}, h("a", { href: urls[k], target: "_blank", rel: "noopener noreferrer", "data-link-type": type }, t.kinds[k])))));
  }

  sync();
  window.addEventListener("hashchange", restoreFromHash);
  if (location.hash.length > 1) restoreFromHash();
}

init();
