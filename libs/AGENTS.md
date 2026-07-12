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

## Publishing

Releases are tag-driven: pushing a `v*` tag triggers
`.github/workflows/npm-publish.yml`, which sets each package version from the tag
and publishes with npm Trusted Publishing (OIDC) + `--provenance` — no long-lived
NPM token. `sections-react` publishes after `sections` (`needs:` ordering), since
its peer range must resolve against the freshly published version.
