import test from "node:test";
import assert from "node:assert";
import { buildPrompt, PROMPT_LANGS } from "../assets/js/core/prompt.js";
import { assistantLinks, ASSISTANTS, MAX_PREFILL_URL } from "../assets/js/core/assistants.js";
import { buildHelpLinks, MAX_NAMES } from "../assets/js/core/help.js";

const base = {
  today: "2026-11-14",
  ingredients: [{ en: "Codeine", local: "Кодеїн" }, { en: "my herbal tea" }],
  route: [{ name: "Ukraine", role: "departure" }, { name: "Poland", role: "transit" }, { name: "Germany", role: "destination" }],
};

test("the prompt lists the route in order with roles, every ingredient and the date", () => {
  const p = buildPrompt({ ...base, lang: "en" });
  assert.ok(p.indexOf("1. Ukraine (departure)") < p.indexOf("2. Poland (layover)"));
  assert.ok(p.indexOf("2. Poland (layover)") < p.indexOf("3. Germany (destination)"));
  assert.ok(p.includes("- Codeine\n") && p.includes("- my herbal tea"));
  assert.ok(p.includes("Today is 2026-11-14."));
  assert.ok(/official sources/.test(p) && /do not invent sources/i.test(p));
});

test("the Ukrainian prompt names ingredients as 'Ukrainian (English)' and keeps custom text as typed", () => {
  const p = buildPrompt({ ...base, lang: "uk", route: [{ name: "Україна", role: "departure" }, { name: "Німеччина", role: "destination" }] });
  assert.ok(p.includes("- Кодеїн (Codeine)") && p.includes("- my herbal tea"));
  assert.ok(p.includes("(відправлення)") && p.includes("(призначення)") && p.includes("Сьогодні 2026-11-14."));
  assert.ok(!p.includes("{date}"));
});

test("findings are included only when asked for and never contain placeholders", () => {
  const without = buildPrompt({ ...base, lang: "en" });
  const withF = buildPrompt({ ...base, lang: "en", findings: [{ country: "Poland", substance: "Codeine", status: "restricted" }, { country: "Germany", substance: "Codeine", status: "unknown" }] });
  assert.ok(!/unverified/.test(without));
  assert.ok(withF.includes("- Poland, Codeine: restricted (permit, certificate or limit)") && withF.includes("- Germany, Codeine: no data"));
  assert.deepStrictEqual(PROMPT_LANGS, ["en", "uk"]);
  assert.ok(!/undefined|\{\w+\}/.test(withF));
});

test("assistant links fill the prompt in where documented, and fall back to the home page", () => {
  const prompt = "Is Codeine ok in Côte d'Ivoire?\nThanks & bye";
  const links = Object.fromEntries(assistantLinks(prompt).map((l) => [l.id, l]));
  assert.deepStrictEqual(ASSISTANTS.map((a) => a.id), ["chatgpt", "claude", "perplexity", "gemini"]);
  assert.strictEqual(links.claude.url, `https://claude.ai/new?q=${encodeURIComponent(prompt)}`);
  assert.ok(links.chatgpt.url.startsWith("https://chatgpt.com/?q=") && links.perplexity.url.startsWith("https://www.perplexity.ai/search?q="));
  assert.ok(links.claude.prefilled && !links.gemini.prefilled);
  assert.strictEqual(links.gemini.url, "https://gemini.google.com/app");
  assert.ok(!links.claude.url.includes("\n") && !links.claude.url.includes(" "));
});

test("a prompt that would make the URL too long is not put in the URL", () => {
  const long = "ліки ".repeat(MAX_PREFILL_URL);
  for (const l of assistantLinks(long)) {
    assert.ok(!l.prefilled && l.url.length < 100, l.id);
  }
});

test("help links are Google searches that use the language, home country and at most a few names", () => {
  const h = buildHelpLinks({ lang: "en", names: ["A", "B", "C", "D", "E"], home: "Ukraine", countries: [{ name: "Poland" }, { name: "Germany" }] });
  assert.deepStrictEqual(h.documents.map((d) => d.kind), ["clinic", "online", "translation"]);
  const q = (u) => decodeURIComponent(u.split("q=")[1]);
  assert.ok(q(h.documents[0].url).includes("A, B, C") && !q(h.documents[0].url).includes("D"));
  assert.strictEqual(MAX_NAMES, 3);
  assert.ok(q(h.countries[0].embassy).includes("Poland embassy in Ukraine"));
  assert.ok(q(h.countries[1].customs).includes("Germany customs"));
  assert.ok(h.documents.every((d) => d.url.startsWith("https://www.google.com/search?q=")));
  const uk = buildHelpLinks({ lang: "uk", names: ["Кодеїн"], home: "Україна", countries: [{ name: "Польща" }] });
  assert.ok(q(uk.countries[0].embassy).includes("посольство Польща"));
});

test("a normal Ukrainian prompt (3 ingredients, 4 countries) is still filled in", () => {
  const ing = ["Codeine", "Zolpidem", "Melatonin"].map((en) => ({ en, local: "Кодеїн" }));
  const route = ["Україна", "Польща", "Німеччина", "Франція"].map((name, i) => ({ name, role: i === 0 ? "departure" : "destination" }));
  const p = buildPrompt({ lang: "uk", ingredients: ing, route, today: "2026-11-14" });
  assert.ok(assistantLinks(p).find((l) => l.id === "claude").prefilled);
});
