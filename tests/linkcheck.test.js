import test from "node:test";
import assert from "node:assert";
import { classify, externalLinks, redirectsToHome, shouldUpdateUrl, staleSources, STALE_DAYS } from "../scripts/lib/links.mjs";

test("classify: success, dead pages and bot blocking are told apart", () => {
  assert.strictEqual(classify({ status: 200 }).kind, "ok");
  assert.strictEqual(classify({ status: 204 }).kind, "ok");
  assert.strictEqual(classify({ status: 404 }).kind, "broken");
  assert.strictEqual(classify({ status: 410 }).kind, "broken");
  assert.strictEqual(classify({ status: 400 }).kind, "broken");
  for (const status of [401, 403, 408, 429, 500, 502, 503]) assert.strictEqual(classify({ status }).kind, "unverified", String(status));
});

test("classify: network errors", () => {
  assert.strictEqual(classify({ errorCode: "ENOTFOUND" }).kind, "broken");
  assert.strictEqual(classify({ errorCode: "CERT_HAS_EXPIRED" }).kind, "broken");
  assert.strictEqual(classify({ errorCode: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" }).kind, "broken");
  assert.strictEqual(classify({ errorName: "TimeoutError" }).kind, "unverified");
  assert.strictEqual(classify({ errorCode: "EAI_AGAIN" }).kind, "unverified"); // transient DNS failure
  assert.strictEqual(classify({ errorCode: "ECONNRESET" }).kind, "unverified");
});

test("externalLinks: only external <a> links, without fragments, de-duplicated", () => {
  const html = `<a href="https://example.org/a#x">1</a> <a class="x" href="https://example.org/a">2</a>
    <a href="https://medsborder.github.io/en/">own</a> <a href="../x/">rel</a> <a href="mailto:a@b.c">m</a>
    <link rel="canonical" href="https://example.org/ignored">`;
  assert.deepStrictEqual(externalLinks(html), ["https://example.org/a"]);
});

test("redirects: deep link to the home page is suspicious, permanent moves are reported", () => {
  assert.strictEqual(redirectsToHome("https://a.org/laws/1", "https://a.org/"), true);
  assert.strictEqual(redirectsToHome("https://a.org/laws/1", "https://a.org/laws/2"), false);
  assert.strictEqual(redirectsToHome("https://a.org/", "https://a.org/"), false);
  assert.strictEqual(redirectsToHome("https://a.org/x", "https://b.org/"), false);
  const hop = (status) => [{ status, to: "https://a.org/new" }];
  assert.strictEqual(shouldUpdateUrl(hop(301), "https://a.org/old", "https://a.org/new"), true);
  assert.strictEqual(shouldUpdateUrl(hop(302), "https://a.org/old", "https://a.org/new"), false);
  assert.strictEqual(shouldUpdateUrl(hop(301), "http://a.org/new", "https://a.org/new/"), false); // only http->https / slash
  assert.strictEqual(shouldUpdateUrl([], "https://a.org/x", "https://a.org/x"), false);
});

test("staleSources flags sources older than a year and those about to be", () => {
  const now = new Date("2026-11-13T00:00:00Z");
  const ago = (d) => new Date(now.getTime() - d * 864e5).toISOString().slice(0, 10);
  const got = staleSources([
    { id: "fresh", verifiedAt: ago(10) },
    { id: "soon", verifiedAt: ago(STALE_DAYS - 10) },
    { id: "stale", verifiedAt: ago(STALE_DAYS + 5) },
  ], now);
  assert.deepStrictEqual(got.map((s) => [s.id, s.state]), [["soon", "soon"], ["stale", "stale"]]);
});
