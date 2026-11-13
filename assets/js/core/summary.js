// Plain-text summary for "copy summary" and the travel sheet. All wording comes in
// from the caller (already translated), so this stays language-free and testable.
/**
 * groups: [{ title, hint?, lines: string[] }]; returns a multi-line string.
 */
export function buildSummary({ title, routeLabel, route, verdict, groups, checkedOn, note, url }) {
  const out = [title, `${routeLabel}: ${route.join(" → ")}`, "", verdict];
  for (const g of groups) {
    if (!g.lines.length) continue;
    out.push("", g.title.toUpperCase(), ...g.lines.map((l) => `- ${l}`));
  }
  out.push("", checkedOn, note);
  if (url) out.push(url);
  return out.join("\n");
}
