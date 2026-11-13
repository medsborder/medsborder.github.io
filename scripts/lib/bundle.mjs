// Pure helpers for the production build (unit-tested; no esbuild here).
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

/** Short content hash used in file names, so a new deploy never serves a stale file. */
export const contentHash = (content) => createHash("sha256").update(content).digest("hex").slice(0, 10);

/** Merges countries, substances and every source file into one object (one request instead of seven). */
export function bundleData(dataDir) {
  const read = (...p) => JSON.parse(readFileSync(path.join(dataDir, ...p), "utf8"));
  const manifest = read("sources", "index.json");
  return {
    countries: read("countries.json"),
    substances: read("substances.json"),
    sources: manifest.map((f) => read("sources", f)),
  };
}

const APP_TAG = /<script type="module" src="([^"]*?)assets\/js\/ui\/app\.js"><\/script>/;
const CONSENT_TAG = /([ \t]*)<script type="module" src="([^"]*?)assets\/js\/consent\.js"><\/script>\n?/;

/**
 * Points a page at the bundles. Checker pages get the app bundle (it already
 * contains the consent code) plus a preload for the data; other pages only get
 * the consent bundle. Relative prefixes (`../`, `/`) are kept as they were.
 */
export function rewriteHtml(html, { app, consent, data }) {
  const appMatch = html.match(APP_TAG);
  if (appMatch) {
    const prefix = appMatch[1];
    const tags = `<link rel="preload" href="${prefix}assets/${data}" as="fetch" crossorigin>\n  <script type="module" src="${prefix}assets/${app}"></script>`;
    return html.replace(APP_TAG, tags).replace(CONSENT_TAG, "");
  }
  return html.replace(CONSENT_TAG, (_, indent, prefix) => `${indent}<script type="module" src="${prefix}assets/${consent}"></script>\n`);
}
