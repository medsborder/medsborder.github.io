# MedsBorder

Static EN/UK site that helps travellers check whether medicines and other substances are allowed, need a prescription, or are banned in departure, transit and destination countries.

Everything runs in the browser. Entered ingredients are never sent to any server of ours.

> Results must be verified independently. This is neither legal nor medical advice.

## Status

Planning and foundation (stage 1). See `CLAUDE.md` for the product requirements.

## Inspiration

UX reference only: [dochq.co.uk/travel-medicine-checker/check](https://dochq.co.uk/travel-medicine-checker/check)

## License

See `LICENSE`.

## Analytics and consent

- Google Tag Manager (`GTM-WJMLCVGW`) is loaded **only after the visitor accepts analytics**. Before that nothing from Google is loaded and no cookie is set. The standard `<noscript><iframe>` snippet is deliberately not used, because it would load GTM without consent.
- After consent the loader sets Consent Mode v2 (`default: denied`, then `analytics_storage: granted`) and loads `gtm.js`. Withdrawing consent (footer "Cookie settings") sets `analytics_storage: denied` and deletes the Google cookies.
- Events sent through `assets/js/analytics.js` carry no ingredient or country data: `check_submitted` (counts only), `share_link_copied`, `external_link_click` (`link_type`: google, chatgpt or source).
- GTM container tips: fire Google tags with built-in consent checks (analytics storage), and do not add tags that need `unsafe-inline` or other hosts without updating the CSP meta in every page (a test checks that the inline-script hashes match).
- The consent record (`localStorage` key `consent`) expires after 180 days.
- GitHub Pages cannot set HTTP headers, so a `Content-Security-Policy` meta tag is used (it cannot set `frame-ancestors`).

## Quality gates

`just test` runs the unit and static tests (Node, in Docker). `just audit` stages the publishable files into `_site/` and audits them in a real Chromium (Docker, reports in `audit/out/`):

- **axe-core**: WCAG 2.0/2.1/2.2 A and AA plus best practices, on 16 states (language, banner shown or dismissed, results, light and dark, desktop and mobile). Zero violations allowed. Also fails on JavaScript errors, failed requests and Content-Security-Policy violations.
- **Lighthouse (mobile)**: thresholds in `audit/thresholds.json` (performance and best practices/SEO at least 0.9/0.95, accessibility 1).

In CI (`.github/workflows/pages.yml`) the deploy job needs both `test` and `audit`; a failed gate blocks the deploy, and pull requests run the checks without deploying. The audit server mimics GitHub Pages (gzip, cache headers, 404 page) and serves canonical/OG URLs as the local host so the checks apply. To change thresholds, edit `audit/thresholds.json` and say why in the commit.

Layout shifts matter here: the form and the theme switcher are added by JavaScript, so `#app` and `#theme-slot` reserve their size in `assets/css/main.css`. If you add fields to the form, re-measure and update `#app { min-height }`.

## Link checks

- `just test` includes an offline check of every link and asset written in the static HTML (files exist, `#fragments` have an id, new-tab links use `rel="noopener noreferrer"`).
- `just check-links` (needs network, Docker) requests every source URL in `data/sources` and every external link in the pages, and lists sources whose `verifiedAt` is older than a year or about to be. Results: `ok`, `broken` (404/410, unknown domain, certificate error, a deep link that redirects to a home page) and `unverified` (HTTP 401/403/429/5xx, timeouts, DNS hiccups). Government sites often block bots, so `unverified` only asks for a manual look; only `broken` fails the run (`--strict` also fails on `unverified`). A permanent redirect is reported with the new address to store. The report is written to `audit/out/links.json`.
- `.github/workflows/links.yml` runs it every Monday and on demand. When a source is re-verified, update its `verifiedAt` in the same change.
