// Statuses ordered from least to most strict. "unknown" is not a status of the
// data: it means "no data", which must never be read as "allowed".
export const STATUSES = ["allowed", "prescription", "restricted", "banned"];
export const UNKNOWN = "unknown";

export const RANK = Object.freeze(
  Object.fromEntries(STATUSES.map((s, i) => [s, i]))
);

export function strictest(statuses) {
  return statuses.reduce((a, b) => (RANK[b] > RANK[a] ? b : a));
}

// How bad a status is for the traveller. "unknown" sits above "allowed" on
// purpose: no data must never read as allowed.
export const SEVERITY = Object.freeze({ allowed: 0, [UNKNOWN]: 1, prescription: 2, restricted: 3, banned: 4 });

/** The most worrying of several statuses ("allowed" for an empty list). */
export function worstOf(statuses) {
  return statuses.reduce((a, b) => (SEVERITY[b] > SEVERITY[a] ? b : a), "allowed");
}
