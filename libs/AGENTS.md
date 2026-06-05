# libs — Shared TypeScript packages

Reusable `@forjacms/*` packages consumed by the frontend templates (and published
to npm). Templates reference them as local `file:../../libs/*` dependencies.

| Package | What it does |
|---------|--------------|
| [`analytics/`](analytics/AGENTS.md) | `@forjacms/analytics` — privacy-first pageview tracker (no cookies/PII). |
| [`client/`](client/AGENTS.md) | `@forjacms/client` — typed SDK for the content API (Node/browser/edge). |
| [`sections/`](sections/AGENTS.md) | `@forjacms/sections` — framework-agnostic Web Components for page sections. |
| [`sections-react/`](sections-react/AGENTS.md) | `@forjacms/sections-react` — React wrappers for the above. |

## Conventions

- Each package builds standalone (`cd <pkg> && npm run build`) and has its own tests.
- The `SectionType` union in `sections/` is the source of truth for page-section
  types; the admin section picker is a subset of it.
- Keep packages framework-agnostic where the name implies it — React-specific code
  belongs in `sections-react/`, not `sections/`.
