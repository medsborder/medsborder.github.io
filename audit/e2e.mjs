// End-to-end walk through the checker (wizard, URL state, results, prompt, help links) in a real
// browser, in English and Ukrainian. Called from run.mjs, so CI runs it with the axe and Lighthouse
// checks and a failure blocks the deploy.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const CONSENT = () => localStorage.setItem("consent", JSON.stringify({ v: 1, analytics: false, at: new Date().toISOString() }));

const LANGS = [
  ["en", { ing: "codeine", from: "Ukraine", via: "Poland", to: "Germany" }],
  ["uk", { ing: "кодеїн", from: "Україна", via: "Польща", to: "Німеччина" }],
];

export async function runE2E({ browser, base, fail }) {
  console.log("\n== end-to-end (wizard, results, prompt, links) ==");
  let count = 0;
  const ok = (cond, msg) => {
    count += 1;
    if (!cond) { console.log(`FAIL ${msg}`); fail(`e2e: ${msg}`); }
  };

  for (const [lang, w] of LANGS) {
    const pg = await browser.newPage();
    await pg.setViewport({ width: 1000, height: 900 });
    const errs = [];
    pg.on("pageerror", (e) => errs.push(e.message));
    pg.on("console", (m) => m.type() === "error" && errs.push(m.text()));
    await pg.evaluateOnNewDocument(CONSENT);
    await pg.goto(`${base}/${lang}/`, { waitUntil: "networkidle0" });
    const vis = (sel) => pg.$eval(sel, (e) => !e.hidden && e.offsetParent !== null).catch(() => false);
    const hash = () => pg.evaluate(() => location.hash);
    const val = (sel) => pg.$eval(sel, (e) => e.value);
    const submit = () => pg.click("form .step-panel:not([hidden]) button[type=submit]");
    const action = (name) => pg.click(`[data-action="${name}"]`);
    // inputs of all steps are in the DOM: 0 = medicines, 1 = departure, 2 = layovers, 3 = destinations
    const type = async (i, text) => {
      const inputs = await pg.$$("form input[type=text]");
      await inputs[i].focus();
      await inputs[i].type(text);
      await wait(150);
      await pg.keyboard.press("Enter");
    };
    const L = (m) => `${lang}: ${m}`;

    // home page and step 1
    ok(await vis("#step-1-title"), L("step 1 shown"));
    ok((await pg.$$(".hero .trust li")).length === 3 && (await pg.$$("#coverage-list li")).length === 4, L("hero trust list and coverage list"));
    await submit();
    ok((await pg.$eval("form .field-msg.error", (e) => e.textContent)).length > 0, L("next is blocked with a message"));
    ok((await pg.$$(".quick-chip")).length >= 5, L("quick picks for common medicines"));
    if (lang === "en") await pg.click(".quick-chip"); else await type(0, w.ing);
    ok((await pg.$$(".chip")).length === 1 && (await hash()).includes("r=codeine"), L("ingredient added and kept in the URL"));
    await submit();
    ok((await vis("#step-2-title")) && (await hash()).includes("step=2"), L("step 2 and step=2 in the URL"));

    // step 2
    await pg.evaluate(() => { document.querySelector("details.layovers").open = true; });
    await type(1, w.from);
    await type(2, w.via);
    await type(3, w.to);
    ok((await pg.$$eval(".route-strip .stop", (els) => els.length)) === 3, L("route preview has 3 stops"));
    ok((await pg.$$(".quick-chip")).length >= 1, L("quick country picks"));
    await submit();
    await pg.waitForSelector("#results:not([hidden]) .verdict");

    // results
    ok(!(await hash()).includes("step=") && (await pg.evaluate(() => document.activeElement.id === "results-title")), L("results: no step in URL, focus on the title"));
    ok((await pg.$$(".action-group h4")).length >= 1 && (await pg.$$(".action-group svg")).length >= 1, L("what to do, with icons"));
    ok((await pg.$$(".timeline-row .stop")).length === 3, L("timeline has 3 stops"));
    ok((await pg.$$(".country > summary .flag")).length === 3, L("a flag in every country card"));
    const report = await pg.$$eval(".report a", (as) => as.map((a) => a.href));
    ok(report.length === 3 && report.every((h) => h.startsWith("https://github.com/medsborder/medsborder.github.io/issues/new?")), L("report links"));
    await action("copy-summary");
    await wait(150);
    ok((await pg.$eval(".toolbar .field-msg", (e) => e.textContent)).length > 0, L("copy summary gives feedback"));

    // prompt and help
    const links = await pg.$$eval(".assistants a", (as) => as.map((a) => [a.dataset.linkType, a.target, a.rel]));
    ok(links.length === 4 && links.every((l) => l[1] === "_blank" && l[2] === "noopener noreferrer"), L("four assistant links with noopener"));
    const text = await val("#prompt-text");
    ok(text.includes("Codeine") && /1\. /.test(text), L("prompt has the ingredient and the route"));
    await pg.select("#prompt-lang", lang === "en" ? "uk" : "en");
    ok((await val("#prompt-text")) !== text, L("prompt language switch changes the text"));
    await pg.click("#prompt-findings");
    const withFindings = await val("#prompt-text");
    ok(withFindings.includes("restricted") || withFindings.includes("обмежено"), L("opt-in adds what we found"));
    ok((await pg.$$(".help a")).length === 3 + 2 * 2, L("help links"));

    // history and sharing
    await pg.goBack(); await wait(200);
    ok(await vis("#step-2-title"), L("back goes to step 2"));
    await pg.goBack(); await wait(200);
    ok(await vis("#step-1-title"), L("back goes to step 1"));
    await pg.goForward(); await wait(100); await pg.goForward(); await wait(200);
    ok(await vis("#results .verdict"), L("forward goes to the results"));
    const shared = pg.url();
    const other = await browser.newPage();
    await other.evaluateOnNewDocument(CONSENT);
    await other.goto(shared, { waitUntil: "networkidle0" });
    ok(await other.$eval("#results", (e) => !e.hidden), L("a shared link opens the results"));
    await other.close();
    await action("edit-route");
    ok(await vis("#step-2-title"), L("edit route goes to step 2"));
    await submit();
    await pg.waitForSelector("#results:not([hidden])");
    await action("reset");
    ok((await vis("#step-1-title")) && (await hash()) === "" && (await pg.$$(".chip")).length === 0, L("start over clears everything"));
    ok(errs.length === 0, L(`no console or page errors ${errs.join(" | ")}`));
    await pg.close();
  }

  // an old link with optional ingredients (o=) still works
  const old = await browser.newPage();
  await old.evaluateOnNewDocument(CONSENT);
  await old.goto(`${base}/en/#r=codeine&o=melatonin&from=UKR&to=DEU`, { waitUntil: "networkidle0" });
  ok((await old.$$(".timeline-row")).length === 2, "old link with o= shows both ingredients");
  await old.close();

  console.log(`${count} end-to-end checks run`);
}
