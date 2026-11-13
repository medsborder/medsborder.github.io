// Production build: bundles JS, merges data, rewrites HTML. Runs in Docker
// (see scripts/stage-site.sh). Usage: node /build/build.mjs <staged-site-dir>
import { build } from "esbuild";
import { readdirSync, readFileSync, writeFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const { bundleData, rewriteHtml, contentHash } = await import(pathToFileURL(path.resolve("scripts/lib/bundle.mjs")));
const site = path.resolve(process.argv[2] ?? "_site");
const assets = path.join(site, "assets");

// data
const dataJson = JSON.stringify(bundleData("data"));
const dataName = `data.${contentHash(dataJson)}.json`;
writeFileSync(path.join(assets, dataName), dataJson);
rmSync(path.join(site, "data"), { recursive: true, force: true });

// js
async function bundle(prefix, contents) {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: path.resolve("assets/js"), loader: "js" },
    bundle: true, minify: true, format: "esm", target: "es2020", write: false,
    define: { __DATA_BUNDLE__: JSON.stringify(dataName) },
  });
  const code = outputFiles[0].text;
  const name = `${prefix}.${contentHash(code)}.js`;
  writeFileSync(path.join(assets, name), code);
  return name;
}
const app = await bundle("app", 'import "./ui/app.js"; import "./consent.js";');
const consent = await bundle("consent", 'import "./consent.js";');
rmSync(path.join(assets, "js"), { recursive: true, force: true });

// html
function* htmlFiles(dir) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) yield* htmlFiles(p);
    else if (f.endsWith(".html")) yield p;
  }
}
for (const f of htmlFiles(site)) {
  writeFileSync(f, rewriteHtml(readFileSync(f, "utf8"), { app, consent, data: dataName }));
}
console.log(`built: ${app}, ${consent}, ${dataName}`);
