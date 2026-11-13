// Accessibility (axe) and Lighthouse audit against a local static copy of the site.
// Exits with 1 when a threshold is missed, a CSP violation or JS error is seen.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import axe from "axe-core";
import puppeteer from "puppeteer-core";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import { runE2E } from "./e2e.mjs";

const SITE_DIR = process.env.SITE_DIR ?? "/site";
const OUT_DIR = process.env.OUT_DIR ?? "/audit/out";
const PROD = "https://medsborder.github.io";
const thresholds = JSON.parse(await fs.readFile(new URL("./thresholds.json", import.meta.url), "utf8"));
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/chromium";
const CHROME_FLAGS = ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--disable-crash-reporter"];
await fs.mkdir(OUT_DIR, { recursive: true });

// ---------- static server that behaves like GitHub Pages ----------
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
};
const TEXT = new Set([".html", ".css", ".js", ".json", ".webmanifest", ".xml", ".txt", ".svg"]);
const REWRITE = new Set([".html", ".webmanifest", ".xml", ".txt"]);

async function resolveFile(urlPath) {
  let p = path.join(SITE_DIR, decodeURIComponent(urlPath.split("?")[0]));
  if (!p.startsWith(SITE_DIR)) return null;
  try {
    const st = await fs.stat(p);
    if (st.isDirectory()) p = path.join(p, "index.html");
    await fs.access(p);
    return p;
  } catch { return null; }
}

const server = http.createServer(async (req, res) => {
  let file = await resolveFile(req.url);
  let status = 200;
  if (!file) { file = path.join(SITE_DIR, "404.html"); status = 404; }
  const ext = path.extname(file);
  let body = await fs.readFile(file);
  // Canonical/OG URLs point at production; serve them as this host so the checks apply.
  if (REWRITE.has(ext)) body = Buffer.from(body.toString("utf8").replaceAll(PROD, `http://localhost:${server.address().port}`));
  const headers = { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Cache-Control": "public, max-age=600" };
  if (TEXT.has(ext) && /\bgzip\b/.test(req.headers["accept-encoding"] ?? "")) {
    body = zlib.gzipSync(body);
    headers["Content-Encoding"] = "gzip";
  }
  headers["Content-Length"] = body.length;
  res.writeHead(status, headers).end(body);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://localhost:${server.address().port}`;

// ---------- scenarios ----------
const DENIED = JSON.stringify({ v: 1, analytics: false, at: new Date().toISOString() });
const RESULTS = "#r=codeine,poppy-seeds,~my%20herbal%20tea&o=melatonin&from=UKR&via=POL&to=DEU,FRA";
const PAGES = ["/", "/en/", "/uk/", "/en/privacy/", "/uk/privacy/", "/en/terms/", "/uk/terms/", "/en/sources/", "/uk/sources/", "/404.html"];
const DESKTOP = { width: 1280, height: 900, deviceScaleFactor: 1 };
const MOBILE = { width: 375, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

const scenarios = [];
for (const p of PAGES) {
  scenarios.push({ name: `${p} banner light desktop`, url: p, storage: {}, scheme: "light", viewport: DESKTOP });
  scenarios.push({ name: `${p} clean dark mobile`, url: p, storage: { consent: DENIED, theme: "dark" }, scheme: "dark", viewport: MOBILE });
}
for (const p of ["/en/", "/uk/"]) {
  scenarios.push({ name: `${p} results light desktop`, url: p + RESULTS, storage: { consent: DENIED }, scheme: "light", viewport: DESKTOP, results: true });
  scenarios.push({ name: `${p} results dark mobile`, url: p + RESULTS, storage: { consent: DENIED, theme: "dark" }, scheme: "dark", viewport: MOBILE, results: true });
}

for (const p of ["/en/", "/uk/"]) {
  scenarios.push({ name: `${p} step 2 light desktop`, url: p + "#r=codeine&o=melatonin&from=UKR&via=POL&step=2", storage: { consent: DENIED }, scheme: "light", viewport: DESKTOP });
  scenarios.push({ name: `${p} step 1 dark mobile`, url: p + "#r=codeine&step=1", storage: { consent: DENIED, theme: "dark" }, scheme: "dark", viewport: MOBILE });
}

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const problems = [];
const fail = (msg) => problems.push(msg);

async function runAxe(browser) {
  console.log(`\n== axe (${scenarios.length} scenarios) ==`);
  for (const s of scenarios) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(`JS error: ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error") errors.push(`console error: ${m.text()}`); });
    page.on("requestfailed", (r) => errors.push(`request failed: ${r.url()}`));
    await page.setViewport(s.viewport);
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: s.scheme }, { name: "prefers-reduced-motion", value: "reduce" }]);
    await page.evaluateOnNewDocument((storage) => {
      for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
    }, s.storage);
    await page.goto(BASE + s.url, { waitUntil: "networkidle0" });
    if (s.url.includes("/en/") || s.url.includes("/uk/")) {
      if (!/privacy|terms|sources/.test(s.url)) await page.waitForSelector("#check-form");
      if (s.results) await page.waitForSelector("#results:not([hidden]) table");
    }
    await page.evaluate(() => document.querySelectorAll("details").forEach((d) => { d.open = true; }));
    await page.evaluate(axe.source);
    const result = await page.evaluate((tags) => axe.run(document, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] }), AXE_TAGS);
    const v = result.violations;
    console.log(`${v.length === 0 && errors.length === 0 ? "ok  " : "FAIL"} ${s.name}${v.length ? `  (${v.length} violations)` : ""}`);
    for (const x of v) {
      console.log(`     [${x.impact}] ${x.id}: ${x.help}\n       ${x.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      fail(`axe ${s.name}: ${x.id}`);
    }
    for (const e of errors) {
      // The 404 page is expected to answer 404 for the missing resource requested by the browser.
      console.log(`     ${e}`);
      fail(`${s.name}: ${e}`);
    }
    await page.close();
  }
}

async function runLighthouse() {
  console.log("\n== Lighthouse (mobile) ==");
  const names = ["/", "/en/", "/uk/", "/en/privacy/", "/uk/privacy/", "/en/terms/", "/uk/terms/", "/en/sources/", "/uk/sources/"];
  for (const url of names) {
    const chrome = await chromeLauncher.launch({ chromePath: CHROME, chromeFlags: CHROME_FLAGS });
    try {
      const run = await lighthouse(BASE + url, {
        port: chrome.port, logLevel: "error", output: ["json", "html"],
        onlyCategories: Object.keys(thresholds.lighthouse),
      });
      const slug = url === "/" ? "root" : url.replaceAll("/", "-").replace(/^-|-$/g, "");
      await fs.writeFile(path.join(OUT_DIR, `lighthouse-${slug}.json`), run.report[0]);
      await fs.writeFile(path.join(OUT_DIR, `lighthouse-${slug}.html`), run.report[1]);
      const cats = run.lhr.categories;
      const line = Object.entries(thresholds.lighthouse).map(([k, min]) => {
        const score = cats[k].score ?? 0;
        if (score < min) fail(`lighthouse ${url} ${k}: ${score} < ${min}`);
        return `${k} ${Math.round(score * 100)}${score < min ? "!" : ""}`;
      }).join("  ");
      console.log(`${url.padEnd(14)} ${line}`);
      for (const [k, min] of Object.entries(thresholds.lighthouse)) {
        if ((cats[k].score ?? 0) >= 1) continue;
        for (const ref of cats[k].auditRefs) {
          const a = run.lhr.audits[ref.id];
          if (ref.weight > 0 && a.score !== null && a.score < 1) console.log(`     ${k}: ${a.title}${a.displayValue ? ` (${a.displayValue})` : ""}`);
        }
      }
    } finally {
      await chrome.kill();
    }
  }
}

const browser = await puppeteer.launch({ executablePath: CHROME, args: CHROME_FLAGS });
try {
  await runAxe(browser);
  await runE2E({ browser, base: BASE, fail });
} finally {
  await browser.close();
}
await runLighthouse();
server.close();

console.log(problems.length ? `\n${problems.length} problem(s):\n- ${problems.join("\n- ")}` : "\nAll audits passed.");
process.exit(problems.length ? 1 : 0);
