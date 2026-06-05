# templates/astro-blog — Reference public site

A server-rendered blog + portfolio site built with [Astro](https://astro.build) 5
(SSR) that consumes the Forja backend via the `@forjacms/*` libraries. This is the
reference template showing how a public Forja site renders content, sections,
navigation, and analytics.

```bash
npm install
npm run dev     # Astro dev server
npm run build   # production build
```

## Conventions

- Reads content through [`@forjacms/client`](../../libs/client/AGENTS.md); renders
  page sections via [`@forjacms/sections`](../../libs/sections/AGENTS.md); tracks
  views with [`@forjacms/analytics`](../../libs/analytics/AGENTS.md). These are
  local `file:` dependencies — rebuild the lib if you change it.
- Site URL, API base, and keys come from environment/config, not hardcoded — this
  template must work for any Forja site, so don't bake in site-specific values.
- Keep it provider-agnostic (analytics, captcha, etc. are configured per site).
