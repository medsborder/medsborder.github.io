// Pure helpers for the link check (unit-tested; no network here).
export const STALE_DAYS = 365;
export const WARN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** External hrefs of <a> tags (own-site and non-http links excluded). */
export function externalLinks(html, ownOrigin = "https://medsborder.github.io") {
  const out = new Set();
  for (const m of html.matchAll(/<a\s[^>]*href="(https?:\/\/[^"#]+)[^"]*"/g)) {
    if (!m[1].startsWith(ownOrigin)) out.add(m[1]);
  }
  return [...out];
}

/**
 * kind: "ok" | "broken" | "unverified".
 * Bot blocking (401/403/429), server errors and timeouts are "unverified":
 * government sites often refuse automated clients, so they need a human look
 * instead of failing the build.
 */
export function classify({ status, errorCode, errorName }) {
  if (errorCode || errorName) {
    if (errorCode === "ENOTFOUND") return { kind: "broken", reason: "domain not found" };
    if (/^(CERT_|UNABLE_TO_VERIFY|DEPTH_ZERO|ERR_TLS_CERT|SELF_SIGNED)/.test(errorCode ?? "")) {
      return { kind: "broken", reason: "certificate error" };
    }
    if (errorName === "TimeoutError" || errorName === "AbortError") return { kind: "unverified", reason: "timeout" };
    return { kind: "unverified", reason: `network error${errorCode ? ` (${errorCode})` : ""}` };
  }
  if (status >= 200 && status < 300) return { kind: "ok", reason: "" };
  if (status === 404 || status === 410) return { kind: "broken", reason: `HTTP ${status}` };
  if ([401, 403, 408, 429].includes(status) || status >= 500) return { kind: "unverified", reason: `HTTP ${status} (possibly blocks bots or is down)` };
  if (status >= 400) return { kind: "broken", reason: `HTTP ${status}` };
  return { kind: "unverified", reason: `HTTP ${status}` };
}

const trimSlash = (p) => p.replace(/\/+$/, "");

/** A deep link that redirects to a site's home page is usually a dead page. */
export function redirectsToHome(from, to) {
  const a = new URL(from);
  const b = new URL(to);
  return trimSlash(a.pathname) !== "" && trimSlash(b.pathname) === "" && a.hostname === b.hostname;
}

/** Permanent redirect that changes the address: the stored URL should be updated. */
export function shouldUpdateUrl(hops, from, to) {
  if (!hops.length || ![301, 308].includes(hops[0].status)) return false;
  const norm = (u) => trimSlash(new URL(u).href.replace(/^http:/, "https:"));
  return norm(from) !== norm(to);
}

export function staleSources(sources, now = new Date()) {
  return sources
    .map((s) => ({ id: s.id, verifiedAt: s.verifiedAt, ageDays: Math.floor((now.getTime() - Date.parse(s.verifiedAt)) / DAY_MS) }))
    .map((s) => ({ ...s, state: s.ageDays > STALE_DAYS ? "stale" : s.ageDays > STALE_DAYS - WARN_DAYS ? "soon" : "fresh" }))
    .filter((s) => s.state !== "fresh");
}
