// Pure helpers for the "I understand" acknowledgement. Like the consent record it is a
// local preference (never sent anywhere). It expires, and it is invalidated when the
// wording changes (bump DISCLAIMER_VERSION), so people re-read what they agree to.
export const DISCLAIMER_KEY = "disclaimer";
export const DISCLAIMER_VERSION = 1;
export const DISCLAIMER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export const encodeAck = (now = new Date()) =>
  JSON.stringify({ v: DISCLAIMER_VERSION, at: now.toISOString() });

/** True only for a valid, current-version, unexpired acknowledgement. */
export function readAck(raw, now = new Date()) {
  if (!raw) return false;
  try {
    const o = JSON.parse(raw);
    if (o?.v !== DISCLAIMER_VERSION) return false;
    const at = Date.parse(o.at);
    if (Number.isNaN(at)) return false;
    const age = now.getTime() - at;
    return age <= DISCLAIMER_DAYS * DAY_MS && age >= -DAY_MS;
  } catch {
    return false;
  }
}

export function storedAck(now = new Date()) {
  try { return readAck(localStorage.getItem(DISCLAIMER_KEY), now); } catch { return false; }
}
