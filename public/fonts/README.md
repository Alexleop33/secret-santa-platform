Self-hosted web fonts, latin subset only, downloaded from Google Fonts on
2026-10-15. Both are variable fonts, so one file covers every weight.

- Manrope (headings), weights 600–800 — SIL Open Font License 1.1
- IBM Plex Sans (body), weights 400–600 — SIL Open Font License 1.1

They live here rather than loading from fonts.googleapis.com so the
Content-Security-Policy in `_headers` can stay `'self'` and the site makes no
request to Google when a page loads.
