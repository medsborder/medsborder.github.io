import { h, fmt } from "./dom.js";
import { STRINGS } from "./i18n.js";
import { createPicker } from "./picker.js";
import { buildMap, routeWarnings, MAX_ROUTE_COUNTRIES } from "../core/buildMap.js";
import { buildActions, buildTimeline, buildVerdict, ACTION_GROUPS } from "../core/conclusions.js";
import { worstOf } from "../core/status.js";
import { coveredCountries } from "../core/coverage.js";
import { recommendCountries } from "../core/recommend.js";
import { track } from "../analytics.js";
import { serializeState, parseState, customToken } from "../core/urlState.js";
import { buildLinks, KINDS } from "../core/links.js";
import { buildPrompt, PROMPT_LANGS } from "../core/prompt.js";
import { assistantLinks } from "../core/assistants.js";
import { buildHelpLinks } from "../core/help.js";
import { normalize, search, countryIndex, substanceIndex, displayName } from "../core/search.js";

const lang = document.documentElement.lang === "uk" ? "uk" : "en";
const t = STRINGS[lang];
const DATA = new URL("../../../data/", import.meta.url);
const ICONS = { allowed: "✓", prescription: "℞", restricted: "!", banned: "✕", unknown: "?" };
const ACTION_ICONS = { stop: "✕", prepare: "℞", verify: "?", ok: "✓" };

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
  const covered = coveredCountries(sources);

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
  });
  const countrySearch = (q) => search(cIndex, q, { exclude: new Set(routeCodes()) })
    .map((c) => ({ ...c, badge: covered.has(c.key) ? t.hasData : null }));
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
    ingredients: meds.getItems().map(tokenOf),
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
    meds.setItems(ingredients(st.ingredients));
    departure.setItems(places(st.from ? [st.from] : []));
    layovers.setItems(places(st.via));
    destinations.setItems(places(st.to));
    if (layovers.getItems().length) layoverDetails.open = true;
    sync();
  }

  const canStep2 = () => meds.getItems().length >= 1;
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
  const routeNote = h("p", { class: "hint" });
  const layoverDetails = h("details", { class: "layovers" }, h("summary", {}, t.layoversSummary), layovers.el);
  const title1 = h("h2", { id: "step-1-title", tabindex: "-1" }, t.ingredientsTitle);
  const title2 = h("h2", { id: "step-2-title", tabindex: "-1" }, t.routeTitle);

  const panel1 = h("section", { class: "step-panel", "aria-labelledby": "step-1-title" },
    title1, meds.el, msg1,
    h("div", { class: "actions" }, nextBtn));
  const panel2 = h("section", { class: "step-panel", "aria-labelledby": "step-2-title", hidden: true },
    title2, departure.el, layoverDetails, destinations.el,
    h("div", { class: "route-preview" }, h("p", { class: "link-title" }, t.routePreview), routeList, routeNote),
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
    const noData = stops.filter(([i, role]) => role !== "departure" && !covered.has(i.key)).map(([i]) => i.label);
    routeNote.textContent = noData.length ? fmt(t.routeNoData, { names: noData.join(", ") }) : "";
    routeList.replaceChildren(...(stops.length
      ? stops.map(([i, role]) => h("li", { class: `stop stop-${role}` },
        h("span", { class: "stop-name" }, i.label), " ", h("span", { class: "role" }, t.roles[role]),
        role !== "departure" && !covered.has(i.key) ? [" ", h("span", { class: "badge badge-muted" }, t.noDataTag)] : null))
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
        ingredient_count: meds.getItems().length,
        layover_count: layovers.getItems().length, destination_count: destinations.getItems().length,
      });
    }
  }

  // ---------- results ----------
  function render() {
    const ingredients = meds.getItems().map((i) => ({ ...i, id: ingredientId(i) }));
    const ids = ingredients.map((i) => i.id);
    const route = {
      departure: departure.getItems()[0].key,
      transit: layovers.getItems().map((i) => i.key),
      destinations: destinations.getItems().map((i) => i.key),
    };
    const map = buildMap(route, ids, sources, new Date());
    const labelOf = new Map(ingredients.map((i) => [i.id, ingredientLabel(i)]));
    const statusText = (s) => t.status[s];
    const icon = (status) => h("span", { class: "icon", "aria-hidden": "true" }, ICONS[status]);

    const warnings = routeWarnings(map, substances);
    // the departure-only country is context: export rules are not in our data
    const evalCodes = map.countries.filter((c) => !(c.roles.length === 1 && c.roles[0] === "departure")).map((c) => c.alpha3);
    const list = (codes) => (codes.length ? codes.map(countryName).join(", ") : t.none);

    // verdict: the one-line answer, worst case first
    const verdict = buildVerdict(map, ids, evalCodes);
    const verdictEl = h("div", { class: `verdict status-${verdict.kind}` },
      h("p", { class: "verdict-title" }, icon(verdict.kind), " ",
        fmt(t[VERDICT_KEY[verdict.kind === "restricted" ? "banned" : verdict.kind]], { n: verdict.n, total: verdict.total })),
      h("p", { class: "verdict-note" }, t.verdictNote));

    // what to do: grouped by action, most urgent first
    const actions = buildActions(map, ids, evalCodes);
    const countryWithRole = (x) => {
      const bits = [x.roles.map((r) => t.roles[r].toLowerCase()).join(" + ")];
      if (x.status !== "allowed" && x.status !== "unknown") bits.push(t.statusShort[x.status]);
      if (x.stale) bits.push(t.staleShort);
      return `${countryName(x.country)} (${bits.join(", ")})`;
    };
    const actionsEl = h("section", { class: "actions-list", "aria-labelledby": "todo-title" },
      h("h3", { id: "todo-title" }, t.actionsTitle),
      ACTION_GROUPS.filter((g) => actions[g].length).map((g) =>
        h("div", { class: `action-group action-${g}` },
          h("h4", {}, h("span", { class: "icon", "aria-hidden": "true" }, ACTION_ICONS[g]), " ", t.actionTitles[g]),
          h("p", { class: "hint" }, t.actionHints[g]),
          h("ul", {}, actions[g].map((item) => h("li", {},
            h("strong", {}, labelOf.get(item.substance)), ": ",
            fmt(t.actionLine, { countries: item.countries.map(countryWithRole).join("; ") })))))));

    // the same statuses along the route, one line per ingredient
    const timelineEl = h("section", { class: "timeline", "aria-labelledby": "timeline-title" },
      h("h3", { id: "timeline-title" }, t.timelineTitle),
      buildTimeline(map, ids).map((row) => {
        const name = labelOf.get(row.substance);
        const stops = row.stops.map((x) => `${countryName(x.country)}: ${statusText(x.status)}`).join("; ");
        return h("div", { class: "timeline-row" },
          h("p", { class: "timeline-name" }, name),
          h("ol", { "aria-label": fmt(t.stopsLabel, { name, stops }) }, row.stops.map((x) =>
            h("li", { class: `stop status-${x.status}`, "aria-hidden": "true" }, icon(x.status), " ", countryName(x.country)))));
      }));

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

    const tableEl = h("section", { "aria-labelledby": "table-title" },
      h("h3", { id: "table-title" }, t.table),
      h("p", { class: "hint" }, t.privacy),
      map.countries.map((c) => countryCard(c, map, ingredients)));

    const helpEl = helpSection(ingredients, evalCodes);
    const askEl = askSection(ingredients, map, evalCodes);

    const sortByName = (codes) => [...codes].sort((a, b) => countryName(a).localeCompare(countryName(b), lang));
    const reco = recommendCountries({
      sources, countries, ingredients, routeCodes: map.countries.map((c) => c.alpha3),
    });
    const recoEl = h("section", { "aria-labelledby": "reco-title" },
      h("h3", { id: "reco-title" }, t.recommendations),
      h("p", { class: "hint" }, t.recoIntro),
      h("dl", { class: "conclusions" },
        h("dt", {}, t.recoAll), h("dd", {}, list(sortByName(reco.allAllowed))),
        h("dt", {}, t.recoPrescription), h("dd", {}, list(sortByName(reco.prescriptionOnly)))),
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
      ...[verdictEl, toolbar, actionsEl, helpEl, timelineEl, warningsEl, tableEl, askEl, recoEl].filter(Boolean));
    results.hidden = false;
  }

  // ---------- help with paperwork (Google searches) ----------
  function helpSection(ingredients, evalCodes) {
    const names = ingredients.map((i) => (lang === "uk" && !i.custom ? substanceById.get(i.key).names.uk[0] : ingredientEnglish(i)));
    const help = buildHelpLinks({
      lang, names, home: countryName(departure.getItems()[0].key), countries: evalCodes.map((c) => ({ name: countryName(c) })),
    });
    const a = (href, text) => h("a", { href, target: "_blank", rel: "noopener noreferrer", "data-link-type": "help" }, text);
    return h("section", { class: "help", "aria-labelledby": "help-title" },
      h("h3", { id: "help-title" }, t.helpTitle),
      h("p", { class: "hint" }, t.helpIntro),
      h("h4", {}, t.helpDocs),
      h("ul", {}, help.documents.map((d) => h("li", {}, a(d.url, t.helpKinds[d.kind])))),
      h("h4", {}, t.helpCountries),
      h("ul", {}, help.countries.map((c) => h("li", {}, h("strong", {}, c.name), ": ", a(c.embassy, t.helpEmbassy), " · ", a(c.customs, t.helpCustoms)))),
      h("p", { class: "hint" }, t.helpNote));
  }

  // ---------- one prompt for AI assistants ----------
  function askSection(ingredients, map, evalCodes) {
    let promptLang = lang;
    let withFindings = false;
    const today = new Date().toISOString().slice(0, 10);
    const area = h("textarea", { id: "prompt-text", rows: "12", spellcheck: "false", "aria-describedby": "ask-warn" });
    const status = h("p", { class: "field-msg", role: "status", "aria-live": "polite" });
    const linkList = h("ul", { class: "assistants" });

    const generate = () => {
      const nameIn = (code) => countryByCode.get(code)?.name[promptLang] ?? code;
      const roleOf = (c) => (c.roles.includes("destination") ? "destination" : c.roles.includes("transit") ? "transit" : "departure");
      area.value = buildPrompt({
        lang: promptLang, today,
        ingredients: ingredients.map((i) => ({ en: ingredientEnglish(i), local: i.custom ? null : substanceById.get(i.key).names.uk[0] })),
        route: map.countries.map((c) => ({ name: nameIn(c.alpha3), role: roleOf(c) })),
        findings: withFindings
          ? ingredients.flatMap((i) => evalCodes.map((c) => ({ country: nameIn(c), substance: ingredientEnglish(i), status: map.cells[c][i.id].status })))
          : null,
      });
      refreshLinks();
    };
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(area.value);
        status.textContent = t.promptCopied;
        return true;
      } catch { status.textContent = t.promptCopyFailed; return false; }
    };
    function refreshLinks() {
      linkList.replaceChildren(...assistantLinks(area.value).map((l) => h("li", {},
        h("a", {
          href: l.url, target: "_blank", rel: "noopener noreferrer", "data-link-type": `assistant-${l.id}`,
          onclick: () => { copy(); },
        }, fmt(l.prefilled ? t.openIn : t.openInEmpty, { name: l.name })))));
    }
    area.addEventListener("input", refreshLinks);

    const langSelect = h("select", { id: "prompt-lang", onchange: (e) => { promptLang = e.target.value; generate(); } },
      PROMPT_LANGS.map((l) => h("option", { value: l, selected: l === promptLang }, l === "uk" ? "Українська" : "English")));
    const findingsBox = h("input", { type: "checkbox", id: "prompt-findings", onchange: (e) => { withFindings = e.target.checked; generate(); } });
    generate();

    return h("section", { class: "ask", "aria-labelledby": "ask-title" },
      h("h3", { id: "ask-title" }, t.askTitle),
      h("p", { class: "hint" }, t.askIntro),
      h("p", { id: "ask-warn", class: "notice" }, t.askWarn),
      h("div", { class: "ask-options" },
        h("label", { for: "prompt-lang" }, t.promptLang, " "), langSelect,
        h("p", {}, findingsBox, " ", h("label", { for: "prompt-findings" }, t.includeFindings))),
      h("label", { for: "prompt-text", class: "link-title" }, t.promptLabel),
      area,
      h("div", { class: "actions" }, h("button", { type: "button", class: "btn", onclick: copy }, t.copyPrompt)),
      status,
      linkList);
  }

  function countryCard(c, map, ingredients) {
    const name = countryName(c.alpha3);
    const roleText = c.roles.map((r) => t.roles[r]).join(" + ");
    const worst = worstOf(ingredients.map((i) => map.cells[c.alpha3][i.id].status));
    const departureOnly = c.roles.length === 1 && c.roles[0] === "departure";
    return h("details", { class: "country", open: worst !== "allowed" && !departureOnly },
      h("summary", {},
        h("span", { class: "c-name" }, name), " ", h("span", { class: "role" }, roleText), " ",
        departureOnly
          ? h("span", { class: "muted" }, t.departureNote)
          : h("span", { class: `status status-${worst}` },
            h("span", { class: "icon", "aria-hidden": "true" }, ICONS[worst]), " ", t.status[worst])),
      h("table", { class: "results" },
        h("caption", { class: "sr-only" }, `${t.table}: ${name}`),
        h("thead", {}, h("tr", {},
          h("th", { scope: "col" }, t.colIngredient), h("th", { scope: "col" }, t.colStatus),
          h("th", { scope: "col" }, t.colSources), h("th", { scope: "col" }, t.colCheck))),
        h("tbody", {}, ingredients.map((ing) => ingredientRow(c, ing, map, name)))));
  }

  function ingredientRow(c, ing, map, countryLabel) {
    const cell = map.cells[c.alpha3][ing.id];
    const links = buildLinks({ lang, ingredient: ingredientEnglish(ing), country: countryLabel });
    return h("tr", {},
      h("th", { scope: "row", "data-label": t.colIngredient },
        ing.label),
      h("td", { "data-label": t.colStatus },
        h("span", { class: `status status-${cell.status}` },
          h("span", { class: "icon", "aria-hidden": "true" }, ICONS[cell.status]), " ", t.status[cell.status]),
        cell.stale ? h("p", { class: "flag" }, t.stale) : null,
        cell.transitFallback ? h("p", { class: "flag" }, t.transitFallback) : null),
      h("td", { "data-label": t.colSources }, sourcesCell(cell, ing)),
      h("td", { "data-label": t.colCheck },
        h("details", {},
          h("summary", {}, t.colCheck),
          linkGroup(t.googleGroup, links.google, "google"))));
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
