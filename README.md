# MedsBorder

Static EN/UK site that helps travellers check whether medicines and other substances are allowed, need a prescription, or are banned in departure, transit and destination countries.

Everything runs in the browser. Entered ingredients are never sent to any server of ours.

> Results must be verified independently. This is neither legal nor medical advice.

## Status

Working MVP with data for Ukraine, Germany, Poland and France. See [ROADMAP.md](ROADMAP.md) for what is missing and `CLAUDE.md` for the product requirements.

## Inspiration

UX reference only: [dochq.co.uk/travel-medicine-checker/check](https://dochq.co.uk/travel-medicine-checker/check)

## License

See `LICENSE`.

## Analytics and consent

- Google Tag Manager (`GTM-WJMLCVGW`) is loaded **only after the visitor accepts analytics**. Before that nothing from Google is loaded and no cookie is set. The standard `<noscript><iframe>` snippet is deliberately not used, because it would load GTM without consent.
- After consent the loader sets Consent Mode v2 (`default: denied`, then `analytics_storage: granted`) and loads `gtm.js`. Withdrawing consent (footer "Cookie settings") sets `analytics_storage: denied` and deletes the Google cookies.
- Events sent through `assets/js/analytics.js` carry no ingredient or country data: `check_submitted` (counts only), `share_link_copied`, `external_link_click` (`link_type`: google, chatgpt or source).
- GTM container tips: fire Google tags with built-in consent checks (analytics storage), and do not add tags that need `unsafe-inline` or other hosts without updating the CSP meta in every page (a test checks that the inline-script hashes match).
- Terms of use and disclaimer: `/en/terms/` and `/uk/terms/`. Legal wording is the maintainers' to approve (governing law and a private contact are not included).
- The consent record (`localStorage` key `consent`) expires after 180 days.
- GitHub Pages cannot set HTTP headers, so a `Content-Security-Policy` meta tag is used (it cannot set `frame-ancestors`).

## Quality gates

`just build` (alias of `just stage`, Docker) writes the production site to `_site/`: all JS is bundled and minified with esbuild into `assets/app.<hash>.js` (checker pages) and `assets/consent.<hash>.js` (other pages), all data is merged into one `assets/data.<hash>.json`, and the HTML is rewritten to point at them. The sources in `assets/js/` and `data/` stay as they are, so `just serve` works without a build and the tests import the modules directly.

`just test` runs the unit and static tests (Node, in Docker). `just audit` stages the publishable files into `_site/` and audits them in a real Chromium (Docker, reports in `audit/out/`):

- **axe-core**: WCAG 2.0/2.1/2.2 A and AA plus best practices, on 20 states (language, banner shown or dismissed, results, light and dark, desktop and mobile). Zero violations allowed. Also fails on JavaScript errors, failed requests and Content-Security-Policy violations.
- **Lighthouse (mobile)**: thresholds in `audit/thresholds.json` (performance and best practices/SEO at least 0.9/0.95, accessibility 1).

In CI (`.github/workflows/pages.yml`) the deploy job needs both `test` and `audit`; a failed gate blocks the deploy, and pull requests run the checks without deploying. The audit server mimics GitHub Pages (gzip, cache headers, 404 page) and serves canonical/OG URLs as the local host so the checks apply. To change thresholds, edit `audit/thresholds.json` and say why in the commit.

Layout shifts matter here: the form and the theme switcher are added by JavaScript, so `#app` and `#theme-slot` reserve their size in `assets/css/main.css`. If you add fields to the form, re-measure and update `#app { min-height }`.

## Link checks

- `just test` includes an offline check of every link and asset written in the static HTML (files exist, `#fragments` have an id, new-tab links use `rel="noopener noreferrer"`).
- `just check-links` (needs network, Docker) requests every source URL in `data/sources` and every external link in the pages, and lists sources whose `verifiedAt` is older than a year or about to be. Results: `ok`, `broken` (404/410, unknown domain, certificate error, a deep link that redirects to a home page) and `unverified` (HTTP 401/403/429/5xx, timeouts, DNS hiccups). Government sites often block bots, so `unverified` only asks for a manual look; only `broken` fails the run (`--strict` also fails on `unverified`). A permanent redirect is reported with the new address to store. The report is written to `audit/out/links.json`.
- `.github/workflows/links.yml` runs it every Monday and on demand. When a source is re-verified, update its `verifiedAt` in the same change.

## AI assistant links

The results page builds one prompt for the whole trip (`assets/js/core/prompt.js`) and links to ChatGPT, Claude, Perplexity and Gemini (`assets/js/core/assistants.js`). Checked on 2026-11-14:

- Claude documents `https://claude.ai/new?q=...`: the text is filled in and the user presses send (long text is cut at about 14,000 characters).
- ChatGPT (`https://chatgpt.com/?q=`) and Perplexity (`https://www.perplexity.ai/search?q=`) accept `q` but do not document it; ChatGPT does not auto-send.
- Gemini has no documented parameter, so it opens empty and the prompt is pasted.
- Every click also copies the prompt to the clipboard, and prompts whose encoded URL is over 8,000 characters are not put in the URL. These formats are not under our control: re-check them when a link stops filling in the prompt.

