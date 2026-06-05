# libs/sections — @forjacms/sections

Framework-agnostic Web Components for rendering Forja page sections, built with
[Stencil](https://stenciljs.com/). Ships as vanilla Custom Elements with
auto-generated React wrappers ([`../sections-react/`](../sections-react/AGENTS.md)).
Zero bundled CSS — consumers style via BEM class hooks.

```bash
npm run build   # Stencil build (also regenerates React wrappers)
npm test
```

## Conventions

- `src/types.ts` defines the **`SectionType`** union — the canonical list of page
  section types (Hero, Features, Cta, Gallery, Testimonials, Pricing, Faq, Contact,
  Custom, Stats, Team, Timeline, LogoCloud, Newsletter, Video, Divider, Text,
  Portfolio, TagCloud, Projects, Blog, Legal). The admin's "Add Section" picker
  offers a subset of these; keep the union authoritative.
- Keep components presentational and dependency-light — no app/framework coupling.
- After changing component public props, rebuild so the React wrappers regenerate.
