# admin/src/i18n — Internationalization

i18next configuration and translation catalogs. The admin ships in **11 locales**:
`ar, de, de-AT, en, es, fr, it, nl, pl, pt, uk` (Arabic is RTL). `en.json` is the
canonical/source catalog; `locales/*.json` hold the rest.

## Conventions

- Every user-facing string goes through `react-i18next` — no hardcoded text in
  components.
- When you add or change a key, **backfill all 11 locale files**. Don't rely on the
  i18next fallback to English; full coverage is the rule.
- Keep keys namespaced by feature (e.g. `dashboard.workbench.*`,
  `setupChecklist.*`) and reuse existing keys rather than duplicating copy.
- `SUPPORTED_LANGUAGES` (in this folder) is the source of truth for the locale list
  and the Preferences language switcher.
