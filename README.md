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
