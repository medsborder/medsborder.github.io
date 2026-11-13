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
// How bad a status is for the traveller. "unknown" sits above "allowed" on purpose:
// no data never reads as allowed.
const SEVERITY = { allowed: 0, unknown: 1, prescription: 2, restricted: 3, banned: 4 };
const worstOf = (statuses) => statuses.reduce((a, b) => (SEVERITY[b] > SEVERITY[a] ? b : a), "allowed");
const VERDICT_KEY = { banned: "verdictBanned", prescription: "verdictPrescription", unknown: "verdictUnknown", allowed: "verdictAllowed" };

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

  const routeCodes = () => [
    ...departure.getItems(), ...layovers.getItems(), ...destinations.getItems(),
  ].map((i) => i.key);
  const requiredItems = () => meds.getItems().filter((i) => !i.optional);
  const optionalItems = () => meds.getItems().filter((i) => i.optional);

  function ingredientCanAdd(item) {
    const id = ingredientId(item);
    if (meds.getItems().some((i) => ingredientId(i) === id)) return fmt(t.alreadyAdded, { name: item.label });
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

  // ---------- pickers ----------
  const common = { t };
  const meds = createPicker({
    ...common, label: t.ingredients, hint: t.ingredientsHint, allowCustom: true,
    customLabel: (q) => fmt(t.addCustom, { q }), canAdd: ingredientCanAdd, onChange: changed,
    search: (q) => search(sIndex, q, {
      exclude: new Set(meds.getItems().filter((i) => !i.custom).map((i) => i.key)),
    }),
    chipMode: { required: t.mustHave, optional: t.niceToHave, label: (it, mode) => fmt(t.modeLabel, { name: it.label, mode }) },
  });
  const countrySearch = (q) => search(cIndex, q, { exclude: new Set(routeCodes()) });
  const departure = createPicker({
    ...common, label: t.departure, hint: t.departureHint, single: true, search: countrySearch,
    canAdd: (i) => countryCanAdd(i, departure), onChange: changed,
  });
  const layovers = createPicker({
    ...common, label: t.layovers, hint: t.layoversHint, search: countrySearch,
    canAdd: (i) => countryCanAdd(i, layovers), onChange: changed,
  });
  const destinations = createPicker({
    ...common, label: t.destinations, hint: t.destinationsHint, search: countrySearch,
    canAdd: (i) => countryCanAdd(i, destinations), onChange: changed,
  });

  // ---------- shareable state (URL fragment) ----------
  // The fragment holds the form state and, while the user is still filling it in, the step.
  // Results have no "step" part, so links shared from older versions keep working.
  const tokenOf = (i) => (i.custom ? customToken(i.text) : i.key);
  const uiState = () => ({
    required: requiredItems().map(tokenOf),
    optional: optionalItems().map(tokenOf),
    from: departure.getItems()[0]?.key ?? null,
    via: layovers.getItems().map((i) => i.key),
    to: destinations.getItems().map((i) => i.key),
  });
  const langLink = document.querySelector(".site-header a[hreflang]");
  const langBase = langLink?.getAttribute("href") ?? "";
  const rawHash = () => location.hash.replace(/^#/, "");
  const stepOf = (raw) => { const m = /(?:^|&)step=([12])(?:&|$)/.exec(raw); return m ? Number(m[1]) : null; };
  const stateOf = (raw) => raw.split("&").filter((x) => !x.startsWith("step=")).join("&");

  let step = 1;
  const fragment = () => {
    const f = serializeState(uiState());
    return step < 3 && f ? `${f}&step=${step}` : f;
  };
  function persist(mode = "replace") {
    const f = fragment();
    try {
      const url = f ? `#${f}` : location.pathname + location.search;
      if (mode === "push" && rawHash() !== f) history.pushState(null, "", url);
      else history.replaceState(null, "", url);
    } catch { /* ignore */ }
    langLink?.setAttribute("href", f ? `${langBase}#${f}` : langBase);
  }

  function applyState(st) {
    const ids = new Set();
    const ingredients = (tokens, optional) => tokens.flatMap((tok) => {
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
      return [optional ? { ...item, optional: true } : item];
    });
    const used = new Set();
    let budget = MAX_ROUTE_COUNTRIES;
    const places = (codes) => codes.flatMap((code) => {
      if (!countryByCode.has(code) || used.has(code) || budget <= 0) return [];
      used.add(code);
      budget -= 1;
      return [{ key: code, label: countryName(code) }];
    });
    meds.setItems([...ingredients(st.required, false), ...ingredients(st.optional, true)]);
    departure.setItems(places(st.from ? [st.from] : []));
    layovers.setItems(places(st.via));
    destinations.setItems(places(st.to));
    if (layovers.getItems().length) layoverDetails.open = true;
    sync();
  }

  const canStep2 = () => requiredItems().length >= 1;
  const canSubmit = () => canStep2() && departure.getItems().length === 1 && destinations.getItems().length >= 1;

  function restoreFromHash(focus = false) {
    const raw = rawHash();
    if (stateOf(raw) !== serializeState(uiState())) applyState(parseState(raw));
    show(stepOf(raw) ?? (canSubmit() ? 3 : canStep2() ? 2 : 1), "none", focus);
  }

  // ---------- wizard shell ----------
  const stepper = h("ol", { class: "steps" });
  const msg1 = h("p", { class: "field-msg error", role: "alert" });
  const msg2 = h("p", { class: "field-msg error", role: "alert" });
  const nextBtn = h("button", { type: "submit", class: "btn primary" }, t.next);
  const checkBtn = h("button", { type: "submit", class: "btn primary" }, t.check);
  const backBtn = h("button", { type: "button", class: "btn", onclick: () => show(1, "push") }, t.back);
  const routeList = h("ol", { class: "route-strip", "aria-live": "polite" });
  const layoverDetails = h("details", { class: "layovers" }, h("summary", {}, t.layoversSummary), layovers.el);
  const title1 = h("h2", { id: "step-1-title", tabindex: "-1" }, t.ingredientsTitle);
  const title2 = h("h2", { id: "step-2-title", tabindex: "-1" }, t.routeTitle);

  const panel1 = h("section", { class: "step-panel", "aria-labelledby": "step-1-title" },
    title1, h("p", { class: "hint" }, t.modeHelp), meds.el, msg1,
    h("div", { class: "actions" }, nextBtn));
  const panel2 = h("section", { class: "step-panel", "aria-labelledby": "step-2-title", hidden: true },
    title2, departure.el, layoverDetails, destinations.el,
    h("div", { class: "route-preview" }, h("p", { class: "link-title" }, t.routePreview), routeList),
    msg2,
    h("div", { class: "actions" }, backBtn, checkBtn));

  const results = h("section", {
    id: "results", "aria-labelledby": "results-title", hidden: true,
    onclick: (e) => {
      const a = e.target.closest?.("a[data-link-type]");
      if (a) track("external_link_click", { link_type: a.dataset.linkType });
    },
  });

  const form = h("form", { id: "check-form", novalidate: true, onsubmit: onSubmit }, panel1, panel2);
  slot.replaceChildren(h("nav", { "aria-label": t.stepsLabel }, stepper), form, results);

  function renderStepper() {
    stepper.replaceChildren(...t.step.map((name, i) => {
      const n = i + 1;
      const reachable = n === 1 || (n === 2 && canStep2()) || (n === 3 && canSubmit());
      return h("li", { class: n === step ? "current" : n < step ? "done" : "" },
        h("button", {
          type: "button", class: "step-btn", disabled: !reachable, "aria-current": n === step ? "step" : null,
          onclick: () => show(n, "push"),
        }, h("span", { class: "step-num", "aria-hidden": "true" }, n === step || n > step ? n : "✓"), " ", name));
    }));
  }

  function renderRoute() {
    const stops = [
      ...departure.getItems().map((i) => [i, "departure"]),
      ...layovers.getItems().map((i) => [i, "transit"]),
      ...destinations.getItems().map((i) => [i, "destination"]),
    ];
    routeList.replaceChildren(...(stops.length
      ? stops.map(([i, role]) => h("li", { class: `stop stop-${role}` },
        h("span", { class: "stop-name" }, i.label), " ", h("span", { class: "role" }, t.roles[role])))
      : [h("li", { class: "muted" }, t.routeEmpty)]));
  }

  function sync() {
    const full = routeCodes().length >= MAX_ROUTE_COUNTRIES;
    layovers.setDisabled(full, fmt(t.routeFull, { n: MAX_ROUTE_COUNTRIES }));
    destinations.setDisabled(full, fmt(t.routeFull, { n: MAX_ROUTE_COUNTRIES }));
    for (const [btn, ok, msg] of [[nextBtn, canStep2(), msg1], [checkBtn, canSubmit(), msg2]]) {
      btn.setAttribute("aria-disabled", String(!ok));
      btn.classList.toggle("disabled", !ok);
      if (ok) msg.textContent = "";
    }
    renderRoute();
    renderStepper();
  }

  function changed() {
    sync();
    persist("replace");
  }

  /** Goes to a step (clamped to what the data allows). mode: "push" | "replace" | "none" (history). */
  function show(n, mode = "push", focus = true) {
    step = n >= 3 && canSubmit() ? 3 : n >= 2 && canStep2() ? 2 : 1;
    panel1.hidden = step !== 1;
    panel2.hidden = step !== 2;
    form.hidden = step === 3;
    if (step === 3) render();
    else { results.hidden = true; results.replaceChildren(); }
    sync();
    if (mode !== "none") persist(mode);
    if (focus) document.getElementById(step === 3 ? "results-title" : `step-${step}-title`)?.focus();
  }

  function reset() {
    [meds, departure, layovers, destinations].forEach((p) => p.clear());
    layoverDetails.open = false;
    show(1, "push");
    meds.focus();
  }

  function onSubmit(e) {
    e.preventDefault();
    if (step === 1) {
      if (!canStep2()) { msg1.textContent = t.needIngredient; return; }
      show(2, "push");
    } else {
      if (!canSubmit()) { msg2.textContent = t.needRoute; return; }
      show(3, "push");
      // Counts only: ingredient and country names are never sent to analytics.
      track("check_submitted", {
        required_count: requiredItems().length, optional_count: optionalItems().length,
        layover_count: layovers.getItems().length, destination_count: destinations.getItems().length,
      });
    }
  }

  // ---------- results ----------
  function render() {
    const ingredients = [
      ...requiredItems().map((i) => ({ ...i, id: ingredientId(i), required: true })),
      ...optionalItems().map((i) => ({ ...i, id: ingredientId(i), required: false })),
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

    // verdict: the one-line answer, worst case first
    const worstIn = (code) => worstOf(ingredients.map((i) => map.cells[code][i.id].status));
    const worst = evalCodes.map(worstIn);
    const count = (...kinds) => worst.filter((w) => kinds.includes(w)).length;
    const bad = count("banned", "restricted");
    let kind = "allowed";
    let n = evalCodes.length;
    if (bad) { kind = worst.includes("banned") ? "banned" : "restricted"; n = bad; }
    else if (count("prescription")) { kind = "prescription"; n = count("prescription"); }
    else if (count("unknown")) { kind = "unknown"; n = count("unknown"); }
    const verdictEl = h("div", { class: `verdict status-${kind}` },
      h("p", { class: "verdict-title" },
        h("span", { class: "icon", "aria-hidden": "true" }, ICONS[kind]), " ",
        fmt(t[VERDICT_KEY[kind === "restricted" ? "banned" : kind]], { n, total: evalCodes.length })),
      h("p", { class: "verdict-note" }, t.verdictNote));

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

    const conclEl = h("details", { class: "more" },
      h("summary", {}, t.moreConclusions),
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
    const toolbar = h("div", { class: "toolbar" },
      h("div", { class: "actions" },
        h("button", { type: "button", class: "btn", onclick: () => show(1, "push") }, t.editMedicines),
        h("button", { type: "button", class: "btn", onclick: () => show(2, "push") }, t.editRoute),
        copyBtn,
        h("button", { type: "button", class: "btn", onclick: reset }, t.reset)),
      copyStatus,
      h("p", { class: "hint" }, t.shareNote));

    results.replaceChildren(
      h("h2", { id: "results-title", tabindex: "-1" }, t.results),
      h("p", { class: "route-line" }, `${t.resultsRoute}: ${map.countries.map((c) => countryName(c.alpha3)).join(t.routeSeparator)}`),
      ...[verdictEl, toolbar, warningsEl, tableEl, recoEl, conclEl].filter(Boolean));
    results.hidden = false;
  }

  function countryCard(c, map, ingredients, routeText) {
    const name = countryName(c.alpha3);
    const roleText = c.roles.map((r) => t.roles[r]).join(" + ");
    const worst = worstOf(ingredients.map((i) => map.cells[c.alpha3][i.id].status));
    const departureOnly = c.roles.length === 1 && c.roles[0] === "departure";
    return h("details", { class: "country", open: worst !== "allowed" && !departureOnly },
      h("summary", {},
        h("span", { class: "c-name" }, name), " ", h("span", { class: "role" }, roleText), " ",
        h("span", { class: `status status-${worst}` },
          h("span", { class: "icon", "aria-hidden": "true" }, ICONS[worst]), " ", t.status[worst])),
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

  window.addEventListener("hashchange", () => restoreFromHash(true));
  window.addEventListener("beforeprint", () => results.querySelectorAll("details").forEach((d) => { d.open = true; }));
  if (location.hash.length > 1) restoreFromHash(false);
  else show(1, "none", false);
}

init();
