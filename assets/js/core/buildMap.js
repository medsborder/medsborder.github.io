import { RANK, UNKNOWN, strictest } from "./status.js";

export const MAX_ROUTE_COUNTRIES = 10;
export const STALE_AFTER_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

function isStale(verifiedAt, nowMs) {
  return nowMs - Date.parse(verifiedAt) > STALE_AFTER_DAYS * DAY_MS;
}

/**
 * Collects route countries (deduplicated) with all their roles.
 * route: { departure?: alpha3, transit?: alpha3[], destinations?: alpha3[] }
 */
function routeCountries(route) {
  const roles = new Map();
  const add = (code, role) => {
    if (!roles.has(code)) roles.set(code, []);
    if (!roles.get(code).includes(role)) roles.get(code).push(role);
  };
  if (route.departure) add(route.departure, "departure");
  for (const c of route.transit ?? []) add(c, "transit");
  for (const c of route.destinations ?? []) add(c, "destination");
  if (roles.size > MAX_ROUTE_COUNTRIES) {
    throw new RangeError(`Route has more than ${MAX_ROUTE_COUNTRIES} countries`);
  }
  return [...roles].map(([alpha3, r]) => ({ alpha3, roles: r }));
}

function resolveCell(alpha3, substanceId, transitOnly, sources, nowMs) {
  const hits = [];
  for (const src of sources) {
    if (!src.countries.includes(alpha3)) continue;
    const entry = src.entries.find((e) => e.substance === substanceId);
    if (entry) hits.push({ src, entry });
  }
  const transitHits = hits.filter((h) => h.src.scope === "transit");
  const regularHits = hits.filter((h) => h.src.scope !== "transit");

  // Transit-scope sources apply only to a country that is transit-only.
  const useTransit = transitOnly && transitHits.length > 0;
  const pool = useTransit ? transitHits : regularHits;
  if (pool.length === 0) {
    return { status: UNKNOWN, stale: false, transitFallback: false, sources: [] };
  }

  // A country-level source overrides group sources; ties -> strictest status.
  const countryLevel = pool.filter((h) => h.src.scope !== "group");
  const winners = countryLevel.length > 0 ? countryLevel : pool;
  const status = strictest(winners.map((h) => h.entry.status));

  return {
    status,
    stale: winners.some((h) => isStale(h.src.verifiedAt, nowMs)),
    transitFallback: transitOnly && !useTransit,
    sources: pool.map((h) => ({
      id: h.src.id,
      url: h.src.url,
      scope: h.src.scope,
      status: h.entry.status,
      verifiedAt: h.src.verifiedAt,
      stale: isStale(h.src.verifiedAt, nowMs),
      quote: h.entry.quote ?? null,
      note: h.entry.note ?? null,
      overridden: !winners.includes(h),
    })),
  };
}

/**
 * Pure function: route x substances x sources -> status map.
 * The single source of truth for the table, conclusions, recommendations
 * and route warnings.
 *
 * A substance id with no matching entries (including custom ingredients)
 * yields "unknown".
 */
export function buildMap(route, substanceIds, sources, now = new Date()) {
  const countries = routeCountries(route);
  const substances = [...new Set(substanceIds)];
  const cells = buildCells(countries, substances, sources, now);
  return { countries, substances, cells };
}

/**
 * Status cells for any list of { alpha3, roles } (no route-size limit).
 * Used by buildMap and by recommendations over the whole country list.
 */
export function buildCells(countries, substances, sources, now = new Date()) {
  const nowMs = now.getTime();
  const cells = {};
  for (const { alpha3, roles } of countries) {
    const transitOnly = roles.length === 1 && roles[0] === "transit";
    cells[alpha3] = {};
    for (const id of substances) {
      cells[alpha3][id] = resolveCell(alpha3, id, transitOnly, sources, nowMs);
    }
  }
  return cells;
}

/**
 * A neighbouring step (e.g. prescription vs restricted) is not worth a
 * warning; a gap of two or more steps, or "allowed" next to anything
 * stricter, is.
 */
export function isNotableGap(min, max) {
  return max - min >= 2 || (min === 0 && max >= 1);
}

/**
 * Warnings for substances whose known statuses differ between route
 * countries (e.g. allowed in one, banned in another). Unknown is ignored
 * but listed. `substanceMeta` (optional) lets common items sort first.
 */
export function routeWarnings(map, substanceMeta = []) {
  const meta = new Map(substanceMeta.map((s) => [s.id, s]));
  const warnings = [];
  for (const id of map.substances) {
    const all = [];
    const unknown = [];
    for (const { alpha3 } of map.countries) {
      const { status } = map.cells[alpha3][id];
      if (status === UNKNOWN) unknown.push(alpha3);
      else all.push({ country: alpha3, status });
    }
    const ranks = all.map((x) => RANK[x.status]);
    if (new Set(ranks).size < 2) continue;
    const min = Math.min(...ranks);
    const max = Math.max(...ranks);
    if (!isNotableGap(min, max)) continue;
    warnings.push({
      substance: id,
      common: meta.get(id)?.common ?? false,
      gap: max - min,
      lenient: all.filter((x) => RANK[x.status] === min),
      strict: all.filter((x) => RANK[x.status] === max),
      all,
      unknown,
    });
  }
  return warnings.sort((a, b) => Number(b.common) - Number(a.common) || b.gap - a.gap);
}
