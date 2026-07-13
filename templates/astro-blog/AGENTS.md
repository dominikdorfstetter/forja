# templates/astro-blog — Reference public site

A server-rendered blog + portfolio site built with [Astro](https://astro.build) 7
(SSR) that consumes the Forja backend via the `@forjacms/*` libraries. This is the
reference template showing how a public Forja site renders content, sections,
navigation, and analytics.

```bash
npm install
npm run dev     # Astro dev server
npm run build   # production build
npm test        # unit tests (node --test with type stripping)
```

## Conventions

- Reads content through [`@forjacms/client`](../../libs/client/AGENTS.md); renders
  page sections via [`@forjacms/sections`](../../libs/sections/AGENTS.md) — the
  section custom elements are registered client-side via
  `import '@forjacms/sections/define'` in `src/layouts/Base.astro`; tracks
  views with [`@forjacms/analytics`](../../libs/analytics/AGENTS.md). These are
  local `file:` dependencies — rebuild the lib if you change it.
- Site URL, API base, and keys come from environment/config, not hardcoded — this
  template must work for any Forja site, so don't bake in site-specific values.
- Keep it provider-agnostic (analytics, captcha, etc. are configured per site).
- Never hard-code English chrome (labels, headings, aria texts) in `.astro`
  files. Use `const t = await getTranslator(Astro.locals.locale)` from
  `src/lib/ui-strings` — it resolves CMS UI Strings → per-locale defaults in
  `src/i18n/defaults/{locale}.json` → key literal. New keys must be backfilled
  in every default JSON (the files double as the operator-facing key list);
  `src/lib/__tests__/i18n-defaults.test.ts` enforces key-set parity.
- Inline client-side `<script>` blocks can't call the server-side `t()`.
  Render the strings a script needs into a `data-i18n` JSON attribute
  (`data-i18n={JSON.stringify(...)}`) on the script's root element and parse
  it once with `readI18n` from `src/lib/client-i18n` — its literal fallbacks
  keep the script working if the attribute is missing. Status-code messages
  use a `{status}` placeholder filled via `withStatus`.
- Site chrome data (nav menus, UI strings, locales, code injection) goes
  through the TTL-cached facades in `src/lib/api.ts` (`fetchWithTtlCache`) —
  they never throw into a page; failures fall back to empty values and retry
  after a short window. Operator code injection is rendered verbatim (by
  design) in `src/layouts/Base.astro` head and footer.
