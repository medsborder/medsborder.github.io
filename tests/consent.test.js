import test from "node:test";
import assert from "node:assert";
import { readChoice, encodeChoice, CONSENT_DAYS, cookieDomains, GA_COOKIE } from "../assets/js/core/consent.js";

const NOW = new Date("2026-11-13T12:00:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 864e5);

test("stored choice round-trips", () => {
  assert.strictEqual(readChoice(encodeChoice(true, NOW), NOW), "granted");
  assert.strictEqual(readChoice(encodeChoice(false, NOW), NOW), "denied");
});

test("no record, garbage or wrong shape means undecided", () => {
  for (const raw of [null, "", "x", "{}", '{"v":2,"analytics":true,"at":"2026-11-01T00:00:00Z"}',
    '{"v":1,"analytics":"yes","at":"2026-11-01T00:00:00Z"}', '{"v":1,"analytics":true,"at":"nope"}']) {
    assert.strictEqual(readChoice(raw, NOW), null, String(raw));
  }
});

test("the choice expires after the validity period (and is not valid from the future)", () => {
  assert.strictEqual(readChoice(encodeChoice(true, daysAgo(CONSENT_DAYS - 1)), NOW), "granted");
  assert.strictEqual(readChoice(encodeChoice(true, daysAgo(CONSENT_DAYS + 1)), NOW), null);
  assert.strictEqual(readChoice(encodeChoice(true, daysAgo(-30)), NOW), null);
});

test("cookie helpers", () => {
  assert.deepStrictEqual(cookieDomains("medsborder.github.io"), ["medsborder.github.io", ".github.io"]);
  assert.deepStrictEqual(cookieDomains("localhost"), ["localhost"]);
  for (const n of ["_ga", "_ga_ABC123", "_gid", "_gcl_au"]) assert.match(n, GA_COOKIE);
  for (const n of ["theme", "consent"]) assert.doesNotMatch(n, GA_COOKIE);
});
