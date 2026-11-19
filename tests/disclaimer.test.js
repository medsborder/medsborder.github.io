import test from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { readAck, encodeAck, DISCLAIMER_DAYS, DISCLAIMER_VERSION } from "../assets/js/core/disclaimer.js";

const NOW = new Date("2026-11-20T12:00:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 864e5);

test("acknowledgement round-trips", () => {
  assert.strictEqual(readAck(encodeAck(NOW), NOW), true);
});

test("no record, garbage or a different wording version means not acknowledged", () => {
  for (const raw of [null, "", "x", "{}", JSON.stringify({ v: DISCLAIMER_VERSION + 1, at: NOW.toISOString() }), '{"v":1,"at":"nope"}']) {
    assert.strictEqual(readAck(raw, NOW), false, String(raw));
  }
});

test("the acknowledgement expires (and is not valid from the future)", () => {
  assert.strictEqual(readAck(encodeAck(daysAgo(DISCLAIMER_DAYS - 1)), NOW), true);
  assert.strictEqual(readAck(encodeAck(daysAgo(DISCLAIMER_DAYS + 1)), NOW), false);
  assert.strictEqual(readAck(encodeAck(daysAgo(-30)), NOW), false);
});

test("the dialog cannot be dismissed without the checkbox, in both languages", () => {
  const js = readFileSync(new URL("../assets/js/disclaimer.js", import.meta.url), "utf8");
  assert.ok(js.includes('addEventListener("cancel", (e) => e.preventDefault())'));
  assert.ok(js.includes("if (!done) dlg.showModal()"));
  assert.ok(js.includes("done = true;"));
  assert.ok(js.includes("disabled: true") && js.includes("go.disabled = !box.checked"));
  assert.ok(js.includes("if (!box.checked) return;"));
  assert.match(js, /en: \{[\s\S]*?\buk: \{/);
  assert.strictEqual((js.match(/points: \[/g) ?? []).length, 2);
});

test("the cookie banner waits for the disclaimer", () => {
  const js = readFileSync(new URL("../assets/js/consent.js", import.meta.url), "utf8");
  assert.ok(js.includes("const gate = disclaimerGate(lang);"));
  assert.ok(js.includes("if (!choice) gate.then(() => show(false));"));
  // the gate must not sit inside the "no cookie choice yet" branch
  assert.ok(!/else\s+disclaimerGate/.test(js));
});

test("the app renders nothing before the disclaimer is acknowledged", () => {
  const js = readFileSync(new URL("../assets/js/ui/app.js", import.meta.url), "utf8");
  const init = js.indexOf("async function init()");
  const gate = js.indexOf("await disclaimerGate(lang)", init);
  assert.ok(init > 0 && gate > init);
  assert.ok(gate < js.indexOf("slot.replaceChildren(", init));
  assert.ok(gate < js.indexOf("loadData()", init));
});
