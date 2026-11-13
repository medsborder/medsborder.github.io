# Roadmap

What is done and what is still missing on MedsBorder. Everything here is a plan, not a promise; priorities may change. To suggest a change or report a wrong entry, open an issue.

> MedsBorder is an information tool. Results must be verified independently; this is neither legal nor medical advice.

## Done

- Three-step wizard (medicines, route, results) with a verdict, a "what to do" list (do not bring / prepare / check yourself), a timeline along the route and an alternative route; every ingredient is treated equally.
- Bilingual (EN/UK) static site, light/dark/system theme, accessible form (ARIA combobox), results table (cards on mobile), conclusions, recommendations, route-conflict warnings, shareable links.
- Consent banner and Google Tag Manager loaded only after consent; privacy and cookie policy; terms of use and disclaimer.
- SEO (metadata, JSON-LD, sitemap, icons, social cards), CSP, axe and Lighthouse gates, link checks, unit tests.
- Data sources (each with a verification date): Ukraine, Germany, Poland, France (partial).

## Data (most important)

- [ ] **Spain** (AEMPS / BOE lists).
- [ ] **France**: codeine and other substances on the "liste I" and psychotropic decrees; ANSM decisions since 2022.
- [ ] **Poland**: newer consolidated text of the list.
- [ ] **Ukraine**: official personal-import rules for medicines (State Service on Medicines, Customs), not only the control list.
- [ ] More countries towards 25–40 (popular destinations and transit hubs first), with INCB/WHO lists as a cross-check.
- [ ] Everyday items: poppy seeds, melatonin, CBD, OTC codeine, pseudoephedrine, with customs or health-ministry sources.
- [ ] Decide how to model cannabis and CBD (currently `restricted` everywhere, which can understate the risk) and how to compare "restricted" with "prescription" across countries.
- [ ] More substances (30–50) with synonyms, brand names and alternatives, EN and UK.

## Procedural rules (`data/rules/`)

- [ ] Per-country rules shown as "what to prepare": certificate or permit, quantity limit (for example 28 or 30 days), customs declaration, original packaging, doctor's letter or translation, transit differences.
- [ ] Schema, validation and tests like the status sources; every rule needs an official source and `verifiedAt`.

## Product

- [ ] Save the last request locally (optional); print view and "copy summary".
- [ ] Departure country as its own rules (export), not only context.
- [ ] Programmatic pages such as "medicine X in country Y" (SEO) once the data is broad enough.
- [ ] Offline support (PWA).

## Quality and operations

- [ ] First full run of the CI pipeline on `main` (test, audit, deploy) and a review of the weekly link-check report.
- [ ] Scheduled data-refresh reminders from stale `verifiedAt` dates.
- [ ] Contribution guide and an issue template "Report incorrect data".
- [ ] Manual checks: keyboard-only and screen-reader pass, real-device mobile test.

## Legal and ownership

- [ ] Name the data controller and a private contact in the privacy policy.
- [ ] Sign Google's data processing terms and set analytics retention to 14 months or less.
- [ ] Legal review of the terms (governing law, limitation of liability) and of the data licence.
