import { h } from "./dom.js";

let uid = 0;

/**
 * Accessible ARIA 1.2 combobox with chips.
 * opts: { label, hint, search(query) -> [{key,label}], allowCustom, customLabel(q),
 *         single, canAdd(item) -> null | error string, onChange(items), iconFor?(item) -> Node, t }
 * items: { key, label, custom?: boolean, text?: string }
 */
export function createPicker(opts) {
  const id = `picker-${++uid}`;
  let items = [];
  let results = [];
  let active = -1;
  let disabledReason = "";

  const input = h("input", {
    id: `${id}-input`, type: "text", role: "combobox", autocomplete: "off",
    autocapitalize: "none", spellcheck: "false",
    "aria-autocomplete": "list", "aria-expanded": "false",
    "aria-controls": `${id}-list`, "aria-describedby": `${id}-hint ${id}-msg`,
  });
  const list = h("ul", { id: `${id}-list`, role: "listbox", class: "options", hidden: true, "aria-label": opts.label });
  const chips = h("ul", { class: "chips", "aria-label": opts.label });
  const msg = h("p", { id: `${id}-msg`, class: "field-msg", role: "status", "aria-live": "polite" });
  const el = h("div", { class: "field" },
    h("label", { for: `${id}-input` }, opts.label),
    h("p", { id: `${id}-hint`, class: "hint" }, opts.hint ?? ""),
    chips,
    h("div", { class: "combo" }, input, list),
    msg);

  const say = (text, isError = false) => {
    msg.textContent = text;
    msg.classList.toggle("error", isError);
  };

  function renderChips() {
    chips.replaceChildren(...items.map((it) =>
      h("li", { class: "chip" },
        opts.iconFor?.(it) ?? null,
        h("span", {}, it.label),
        it.custom ? h("span", { class: "chip-tag" }, opts.t.custom) : null,
        h("button", {
          type: "button", class: "chip-remove",
          "aria-label": opts.t.remove.replace("{name}", it.label),
          onclick: () => { items = items.filter((x) => x !== it); renderChips(); changed(); input.focus(); },
        }, "×"))));
  }

  const changed = () => opts.onChange?.(items);

  function close() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  }

  function setActive(i) {
    active = i;
    [...list.children].forEach((li, n) => li.setAttribute("aria-selected", String(n === i)));
    if (i >= 0) {
      input.setAttribute("aria-activedescendant", list.children[i].id);
      list.children[i].scrollIntoView?.({ block: "nearest" });
    } else input.removeAttribute("aria-activedescendant");
  }

  function refresh() {
    const q = input.value.trim();
    results = q ? opts.search(q).map((r) => ({ ...r })) : [];
    const exact = results.some((r) => r.label.toLowerCase() === q.toLowerCase());
    if (opts.allowCustom && q.length >= 2 && !exact) {
      results.push({ key: `custom:${q}`, label: opts.customLabel(q), custom: true, text: q });
    }
    list.replaceChildren(...results.map((r, n) =>
      h("li", {
        id: `${id}-opt-${n}`, role: "option", "aria-selected": "false",
        class: r.custom ? "option custom" : "option",
        onmousedown: (e) => e.preventDefault(),
        onclick: () => pick(r),
      }, opts.iconFor?.(r) ?? null, r.label, r.badge ? [" ", h("span", { class: "badge" }, r.badge)] : null)));
    const open = results.length > 0;
    list.hidden = !open;
    input.setAttribute("aria-expanded", String(open));
    setActive(-1);
    if (open) say(opts.t.resultsCount.replace("{n}", results.length));
    else if (q) say(opts.t.noResults);
    else say("");
  }

  /** Adds an item as if it was picked from the list. Returns an error text or null. */
  function add(item) {
    const err = opts.canAdd?.(item);
    if (err) { say(err, true); return err; }
    items = opts.single ? [item] : [...items, item];
    renderChips();
    say(opts.t.added.replace("{name}", item.label));
    changed();
    return null;
  }

  function pick(r) {
    const item = r.custom
      ? { key: `custom:${r.text.toLowerCase()}`, label: r.text, custom: true, text: r.text }
      : { key: r.key, label: r.label };
    if (add(item) === null) {
      input.value = "";
      close();
    }
  }

  input.addEventListener("input", refresh);
  input.addEventListener("focus", () => { if (input.value.trim()) refresh(); });
  input.addEventListener("blur", () => setTimeout(close, 120));
  input.addEventListener("keydown", (e) => {
    const n = results.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (list.hidden) refresh();
      if (n) setActive((active + 1) % n);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (n) setActive(active <= 0 ? n - 1 : active - 1);
    } else if (e.key === "Home" && !list.hidden) { e.preventDefault(); setActive(0); }
    else if (e.key === "End" && !list.hidden) { e.preventDefault(); setActive(n - 1); }
    else if (e.key === "Enter") {
      if (input.value.trim() || !list.hidden) e.preventDefault();
      if (n) pick(results[active >= 0 ? active : 0]);
    } else if (e.key === "Escape" && !list.hidden) { e.preventDefault(); close(); }
  });

  return {
    el,
    getItems: () => items,
    add,
    setItems(next) { items = next; renderChips(); },
    clear() { items = []; input.value = ""; close(); renderChips(); say(""); },
    setDisabled(disabled, reason = "") {
      input.disabled = disabled;
      disabledReason = disabled ? reason : "";
      if (disabled) { close(); say(disabledReason); } else if (msg.textContent === disabledReason) say("");
    },
    focus: () => input.focus(),
  };
}
