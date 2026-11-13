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
