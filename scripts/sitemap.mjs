// Generates sitemap.xml. Usage: node scripts/sitemap.mjs [YYYY-MM-DD] > sitemap.xml
// Run through `just sitemap` (Docker).
export const SITE = "https://medsborder.github.io";

// Indexable pages. `alt` lists the language alternates of a page (including itself).
export const PAGES = [
  { path: "/", alt: null },
  { path: "/en/", alt: { en: "/en/", uk: "/uk/" }, xdefault: "/" },
  { path: "/uk/", alt: { en: "/en/", uk: "/uk/" }, xdefault: "/" },
  { path: "/en/privacy/", alt: { en: "/en/privacy/", uk: "/uk/privacy/" }, xdefault: "/en/privacy/" },
  { path: "/uk/privacy/", alt: { en: "/en/privacy/", uk: "/uk/privacy/" }, xdefault: "/en/privacy/" },
  { path: "/en/terms/", alt: { en: "/en/terms/", uk: "/uk/terms/" }, xdefault: "/en/terms/" },
  { path: "/uk/terms/", alt: { en: "/en/terms/", uk: "/uk/terms/" }, xdefault: "/en/terms/" },
  { path: "/en/sources/", alt: { en: "/en/sources/", uk: "/uk/sources/" }, xdefault: "/en/sources/" },
  { path: "/uk/sources/", alt: { en: "/en/sources/", uk: "/uk/sources/" }, xdefault: "/en/sources/" },
];

export function buildSitemap(lastmod) {
  const urls = PAGES.map((p) => {
    const links = p.alt
      ? Object.entries(p.alt).map(([l, href]) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE}${href}"/>`)
          .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${p.xdefault}"/>`)
      : [];
    return ["  <url>", `    <loc>${SITE}${p.path}</loc>`, `    <lastmod>${lastmod}</lastmod>`, ...links, "  </url>"].join("\n");
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(buildSitemap(process.argv[2] ?? new Date().toISOString().slice(0, 10)));
}
