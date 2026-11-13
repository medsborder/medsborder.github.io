// Pure helpers for the consent record. The record is a local preference
// (not shared with anyone) and expires so the user is asked again.
export const STORAGE_KEY = "consent";
export const CONSENT_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

export const encodeChoice = (granted, now = new Date()) =>
  JSON.stringify({ v: 1, analytics: Boolean(granted), at: now.toISOString() });

/** Returns "granted", "denied" or null (undecided, expired or invalid). */
export function readChoice(raw, now = new Date()) {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (o?.v !== 1 || typeof o.analytics !== "boolean") return null;
    const at = Date.parse(o.at);
    if (Number.isNaN(at)) return null;
    const age = now.getTime() - at;
    if (age > CONSENT_DAYS * DAY_MS || age < -DAY_MS) return null;
    return o.analytics ? "granted" : "denied";
  } catch {
    return null;
  }
}

export function storedChoice(now = new Date()) {
  try { return readChoice(localStorage.getItem(STORAGE_KEY), now); } catch { return null; }
}

export const GA_COOKIE = /^(_ga|_gid|_gat|_gcl_)/;

/** Host plus its parent domains, for deleting cookies set on any of them. */
export function cookieDomains(hostname) {
  const parts = hostname.split(".");
  const out = [hostname];
  for (let i = 1; i < parts.length - 1; i += 1) out.push(`.${parts.slice(i).join(".")}`);
  return out;
}
