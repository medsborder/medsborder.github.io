import { UNKNOWN, worstOf } from "./status.js";

// What the traveller should DO, derived only from statuses in the map.
// banned -> stop, restricted/prescription -> prepare, unknown -> verify, allowed -> ok.
const GROUP_OF = Object.freeze({
  banned: "stop", restricted: "prepare", prescription: "prepare", [UNKNOWN]: "verify", allowed: "ok",
});
export const ACTION_GROUPS = Object.freeze(["stop", "prepare", "verify", "ok"]);

/**
 * Action groups: { stop|prepare|verify|ok: [{ substance, countries: [{ country, roles, status,
 * stale, transitFallback }] }] }. Countries follow route order; substances keep input order.
 * countryCodes: the countries to evaluate (the departure-only country is left out by the caller).
 */
export function buildActions(map, substanceIds, countryCodes) {
  const roles = new Map(map.countries.map((c) => [c.alpha3, c.roles]));
  const out = Object.fromEntries(ACTION_GROUPS.map((g) => [g, []]));
  for (const id of substanceIds) {
    const byGroup = Object.fromEntries(ACTION_GROUPS.map((g) => [g, []]));
    for (const country of countryCodes) {
      const cell = map.cells[country][id];
      byGroup[GROUP_OF[cell.status]].push({
        country, roles: roles.get(country) ?? [], status: cell.status,
        stale: cell.stale, transitFallback: cell.transitFallback,
      });
    }
    for (const g of ACTION_GROUPS) {
      if (byGroup[g].length) out[g].push({ substance: id, countries: byGroup[g] });
    }
  }
  return out;
}

/**
 * Per substance, the statuses along the whole route in route order:
 * [{ substance, stops: [{ country, roles, status }] }].
 */
export function buildTimeline(map, substanceIds) {
  return substanceIds.map((substance) => ({
    substance,
    stops: map.countries.map(({ alpha3, roles }) => ({ country: alpha3, roles, status: map.cells[alpha3][substance].status })),
  }));
}

/** The one-line answer: the worst case on the route, with how many countries it concerns. */
export function buildVerdict(map, substanceIds, countryCodes) {
  const worst = countryCodes.map((c) => worstOf(substanceIds.map((id) => map.cells[c][id].status)));
  const count = (...kinds) => worst.filter((w) => kinds.includes(w)).length;
  const total = countryCodes.length;
  const bad = count("banned", "restricted");
  if (bad) return { kind: worst.includes("banned") ? "banned" : "restricted", n: bad, total };
  if (count("prescription")) return { kind: "prescription", n: count("prescription"), total };
  if (count(UNKNOWN)) return { kind: UNKNOWN, n: count(UNKNOWN), total };
  return { kind: "allowed", n: total, total };
}
