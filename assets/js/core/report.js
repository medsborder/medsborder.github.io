// "Report incorrect data": a prefilled GitHub issue. Opening it is the user's choice and
// anything they submit there is public, so the text asks for no personal or medical details.
export const REPO = "medsborder/medsborder.github.io";

/**
 * country: display name; rows: [{ ingredient, status, sources: [url] }]
 * -> https://github.com/<repo>/issues/new?... (title and body are filled in)
 */
export function reportUrl({ country, rows }) {
  const shown = rows.map((r) => `- ${r.ingredient}: ${r.status}${r.sources.length ? ` (source: ${r.sources.join(", ")})` : ""}`);
  const body = [
    `**Country:** ${country}`, "",
    "**Shown on the site:**", ...shown, "",
    "**What is wrong?**", "", "",
    "**Correct information and an official source (link):**", "", "",
    "_Please do not write personal or medical details. Issues on GitHub are public._",
  ].join("\n");
  const q = new URLSearchParams({ title: `Incorrect data: ${country}`, body, labels: "incorrect-data" });
  return `https://github.com/${REPO}/issues/new?${q}`;
}
