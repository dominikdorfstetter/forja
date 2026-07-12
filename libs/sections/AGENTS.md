# libs/sections — @forjacms/sections

Framework-agnostic Web Components for rendering Forja page sections, built with
[Stencil](https://stenciljs.com/). Ships as vanilla Custom Elements with
auto-generated React wrappers ([`../sections-react/`](../sections-react/AGENTS.md)).
Zero bundled CSS — consumers style via BEM class hooks.

```bash
npm run build   # Stencil build (also regenerates React wrappers)
npm test
```

## Build Gotcha: `./define` vs. tests

`npm run build` = `stencil build && node scripts/generate-define-all.js` — the
second step generates `dist/define-all.js`, which backs the `./define` package
export. `npm test` (`stencil-test`) rebuilds `dist/` **without** running the
generator, so running tests after a build silently breaks the `./define` export
until the next `npm run build`.

Rules:
- After running tests locally, rebuild before relying on (or publishing) `dist/`.
- The test-then-build order in CI (`.github/workflows/npm-publish.yml`) is
  load-bearing — do not reorder those steps.

## Conventions

- `src/types.ts` defines the **`SectionType`** union — the canonical list of page
  section types (Hero, Features, Cta, Gallery, Testimonials, Pricing, Faq, Contact,
  Custom, Stats, Team, Timeline, LogoCloud, Newsletter, Video, Divider, Text,
  Portfolio, TagCloud, Projects, Blog, Legal). The admin's "Add Section" picker
  offers a subset of these; keep the union authoritative.
- Keep components presentational and dependency-light — no app/framework coupling.
- After changing component public props, rebuild so the React wrappers regenerate.
