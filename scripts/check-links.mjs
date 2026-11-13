// Checks that the URLs in data/sources and the external links in the static pages are alive,
// and reports sources that are stale or about to be. Needs network.
//   node scripts/check-links.mjs [--strict]   (via `just check-links`)
// Exit 1 on broken links (and, with --strict, on unverified ones too).
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { classify, externalLinks, redirectsToHome, shouldUpdateUrl, staleSources } from "./lib/links.mjs";

const STRICT = process.argv.includes("--strict");
const TIMEOUT_MS = 15000;
const MAX_HOPS = 6;
const UA = "MedsBorder-link-checker (+https://github.com/medsborder/medsborder.github.io)";
const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sourceFiles = readdirSync(new URL("data/sources/", root)).filter((f) => f.endsWith(".json") && f !== "index.json");
const sources = sourceFiles.map((f) => JSON.parse(read(`data/sources/${f}`)));
const pages = ["index.html", "404.html", "en/index.html", "uk/index.html", "en/privacy/index.html", "uk/privacy/index.html", "en/terms/index.html", "uk/terms/index.html"];

// url -> where it is used
const targets = new Map();
const use = (url, where) => targets.set(url, [...(targets.get(url) ?? []), where]);
for (const s of sources) use(s.url, `source ${s.id}`);
for (const p of pages) for (const u of externalLinks(read(p))) use(u, `page ${p}`);

async function once(url, method) {
  const res = await fetch(url, {
    method, redirect: "manual", headers: { "User-Agent": UA, Accept: "text/html,*/*" }, signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  res.body?.cancel().catch(() => {});
  return res;
}

async function request(url) {
  let res = await once(url, "HEAD");
  if (res.status >= 400 || res.status === 405) res = await once(url, "GET"); // some servers mishandle HEAD
  return res;
}

async function check(url) {
  const hops = [];
  let current = url;
  for (let i = 0; i < MAX_HOPS; i += 1) {
    let res;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        res = await request(current);
        if (res.status !== 429 && res.status < 500) break;
      } catch (e) {
        res = { error: e };
        if (e.cause?.code === "ENOTFOUND") break;
      }
      await sleep(1500);
    }
    if (res.error) {
      return { url, hops, finalUrl: current, ...classify({ errorCode: res.error.cause?.code ?? res.error.code, errorName: res.error.name }) };
    }
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      hops.push({ status: res.status, to: new URL(loc, current).href });
      current = hops.at(-1).to;
      continue;
    }
    return { url, hops, finalUrl: current, status: res.status, ...classify({ status: res.status }) };
  }
  return { url, hops, finalUrl: current, kind: "broken", reason: "too many redirects" };
}

// Polite: a few hosts at a time, one request at a time per host.
const byHost = new Map();
for (const url of targets.keys()) byHost.set(new URL(url).host, [...(byHost.get(new URL(url).host) ?? []), url]);
const results = [];
await Promise.all([...byHost.values()].map(async (urls) => {
  for (const url of urls) {
    const r = await check(url);
    r.usedBy = targets.get(url);
    if (r.kind === "ok" && redirectsToHome(url, r.finalUrl)) { r.kind = "broken"; r.reason = "redirects to the home page (page probably gone)"; }
    r.updateTo = r.kind === "ok" && shouldUpdateUrl(r.hops, url, r.finalUrl) ? r.finalUrl : null;
    results.push(r);
    await sleep(400);
  }
}));
results.sort((a, b) => a.url.localeCompare(b.url));

const stale = staleSources(sources);
const icon = { ok: "ok         ", broken: "BROKEN     ", unverified: "unverified " };
console.log(`Checked ${results.length} URLs\n`);
for (const r of results) {
  console.log(`${icon[r.kind]} ${r.url}${r.reason ? `  (${r.reason})` : ""}`);
  console.log(`            used by: ${r.usedBy.join(", ")}`);
  if (r.updateTo) console.log(`            permanent redirect, update to: ${r.updateTo}`);
}
if (stale.length) {
  console.log("\nSources to re-verify:");
  for (const s of stale) console.log(`${s.state === "stale" ? "STALE" : "soon "} ${s.id}: verified ${s.verifiedAt} (${s.ageDays} days ago)`);
}
const broken = results.filter((r) => r.kind === "broken");
const unverified = results.filter((r) => r.kind === "unverified");
console.log(`\n${results.length - broken.length - unverified.length} ok, ${unverified.length} unverified (open them by hand), ${broken.length} broken, ${stale.length} stale/soon.`);

mkdirSync(new URL("audit/out/", root), { recursive: true });
writeFileSync(new URL("audit/out/links.json", root), JSON.stringify({ checkedAt: new Date().toISOString(), results, stale }, null, 2));
process.exit(broken.length || (STRICT && unverified.length) ? 1 : 0);
