import { STATUSES } from "./status.js";

const SCOPES = ["country", "group", "transit"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns a list of error strings (empty = valid). */
export function validateSources(sources, countryCodes, substanceIds) {
  const errors = [];
  const seen = new Set();
  for (const s of sources) {
    const at = `source ${s.id ?? "?"}`;
    if (!s.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id)) errors.push(`${at}: bad id`);
    if (seen.has(s.id)) errors.push(`${at}: duplicate id`);
    seen.add(s.id);
    if (typeof s.url !== "string" || !s.url.startsWith("https://")) errors.push(`${at}: url must be https`);
    if (!SCOPES.includes(s.scope)) errors.push(`${at}: bad scope`);
    if (!DATE.test(s.verifiedAt ?? "") || Number.isNaN(Date.parse(s.verifiedAt))) errors.push(`${at}: bad verifiedAt`);
    if (!s.license) errors.push(`${at}: license required`);
    if (!Array.isArray(s.countries) || s.countries.length === 0) errors.push(`${at}: countries required`);
    for (const c of s.countries ?? []) {
      if (!countryCodes.has(c)) errors.push(`${at}: unknown country ${c}`);
    }
    if (s.scope === "country" && s.countries?.length !== 1) errors.push(`${at}: country scope needs exactly 1 country`);
    if (!Array.isArray(s.entries) || s.entries.length === 0) errors.push(`${at}: entries required`);
    const subs = new Set();
    for (const e of s.entries ?? []) {
      if (!substanceIds.has(e.substance)) errors.push(`${at}: unknown substance ${e.substance}`);
      if (!STATUSES.includes(e.status)) errors.push(`${at}: bad status for ${e.substance}`);
      if (subs.has(e.substance)) errors.push(`${at}: duplicate entry ${e.substance}`);
      subs.add(e.substance);
    }
  }
  return errors;
}
