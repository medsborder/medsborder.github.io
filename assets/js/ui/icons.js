// Inline SVG icons (no network, no style attributes: CSP forbids inline styles).
// Statuses and categories use different silhouettes, so meaning never rests on colour alone.
import { FLAGS } from "../core/flags.js";

const NS = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...kids);
  return el;
};
const path = (d, extra = {}) => svg("path", { d, ...extra });

const GLYPHS = {
  allowed: () => [svg("circle", { cx: 12, cy: 12, r: 9 }), path("M8 12.5l3 3 5-6")],
  prescription: () => [path("M7 3h7l4 4v14H7z"), path("M14 3v4h4"), path("M10 12h5M10 16h5")],
  restricted: () => [path("M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"), path("M12 8v5M12 16v.5")],
  banned: () => [svg("circle", { cx: 12, cy: 12, r: 9 }), path("M6 6l12 12")],
  unknown: () => [svg("circle", { cx: 12, cy: 12, r: 9 }), path("M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17v.5")],
  // substance categories
  opioid: () => [svg("rect", { x: 3, y: 9, width: 18, height: 6, rx: 3, transform: "rotate(-45 12 12)" }), path("M9.5 9.5l5 5")],
  stimulant: () => [path("M13 2L5 14h6l-1 8 8-12h-6z")],
  benzodiazepine: () => [path("M3 12c3-6 6 6 9 0s6 6 9 0")],
  "sleep-aid": () => [path("M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z")],
  anticonvulsant: () => [path("M3 12h4l2-6 4 12 2-6h5")],
  cannabinoid: () => [path("M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19l8-8")],
  analgesic: () => [svg("rect", { x: 4, y: 4, width: 16, height: 16, rx: 4 }), path("M12 8v8M8 12h8")],
  decongestant: () => [path("M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z")],
  food: () => [[8, 9], [15, 8], [12, 14], [7, 16], [17, 15]].map(([cx, cy]) => svg("circle", { cx, cy, r: 1.6 })),
  // route roles and misc
  departure: () => [path("M3 20h18M5 15l3-8 4 3 5-5 2 2-5 8z")],
  globe: () => [svg("circle", { cx: 12, cy: 12, r: 9 }), path("M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18")],
  shield: () => [path("M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"), path("M8.5 12l2.5 2.5 4.5-5")],
  lock: () => [svg("rect", { x: 5, y: 11, width: 14, height: 9, rx: 2 }), path("M8 11V8a4 4 0 0 1 8 0v3")],
  translate: () => [path("M4 5h9M8.5 3v2M6 5c0 4 3 7 6 8M12 5c0 4-3 7-7 8M13 20l4-9 4 9M14.5 17h5")],
};

/** Decorative icon: hidden from assistive tech; put the meaning in nearby text. */
export function icon(name, { size = 20, cls = "" } = {}) {
  const make = GLYPHS[name];
  const el = svg("svg", {
    viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor",
    "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round",
    class: `svg-icon ${cls}`.trim(), "aria-hidden": "true", focusable: "false",
  });
  if (make) el.append(...make().flat());
  return el;
}

/** Flag for a country with data, otherwise a small code badge. Decorative. */
export function flag(alpha3, { height = 14 } = {}) {
  const f = FLAGS[alpha3];
  if (!f) {
    const badge = document.createElement("span");
    badge.className = "flag-code";
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = alpha3;
    return badge;
  }
  const w = 24;
  const h = 16;
  const n = f.colors.length;
  const bands = f.colors.map((fill, i) => (f.dir === "h"
    ? svg("rect", { x: 0, y: (h / n) * i, width: w, height: h / n + 0.1, fill })
    : svg("rect", { x: (w / n) * i, y: 0, width: w / n + 0.1, height: h, fill })));
  return svg("svg", {
    viewBox: `0 0 ${w} ${h}`, width: Math.round((height * w) / h), height, class: "flag", "aria-hidden": "true", focusable: "false",
  }, ...bands, svg("rect", { x: 0.5, y: 0.5, width: w - 1, height: h - 1, fill: "none", stroke: "#6b7280", "stroke-width": 1, rx: 2 }));
}
