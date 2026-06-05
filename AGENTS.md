# AGENTS.md

Guidance for AI coding agents (and humans) working in the Forja monorepo. Each
package and major subdirectory has its own `AGENTS.md` with local detail — read
the one closest to the code you're touching.

These files are tool-agnostic: any agent (or person) should rely on `AGENTS.md`
as the single source of truth. The repository intentionally carries no
vendor-specific instruction files.

## What Forja is

Forja is an open-source, **multi-site** CMS: a single Rust backend serves content
for many independent sites, managed through a React admin dashboard and rendered
by Astro templates. Its differentiator is **privacy/GDPR by construction** —
PII classification, encryption-at-rest, retention, and erasure are part of the
data model, not bolted on. See `CONTEXT.md` for the domain glossary (Content
entity, Site, Actor, publish lifecycle, validation seam).

## Monorepo map

| Directory | What it is | Stack |
|-----------|-----------|-------|
| [`backend/`](backend/AGENTS.md) | REST API — the system of record | Rust · Axum 0.8 · SQLx · PostgreSQL · Redis |
| [`admin/`](admin/AGENTS.md) | Admin dashboard SPA | React 19 · MUI v9 · Vite · TanStack Query · Clerk |
| [`libs/`](libs/AGENTS.md) | Shared TS packages (`@forjacms/*`) | analytics · client SDK · sections · sections-react |
| [`templates/astro-blog/`](templates/astro-blog/AGENTS.md) | Reference public site | Astro 5 SSR |
| [`e2e/`](e2e/AGENTS.md) | End-to-end BDD suite | Cucumber + Playwright |
| [`docs/`](docs/AGENTS.md) | Documentation site | Docusaurus |
| [`scripts/`](scripts/AGENTS.md) | Dev/release helper scripts | Bash |

Other top-level files: `docker-compose.*.yaml` (local infra + prod), `Dockerfile`,
`railway.toml` (deploy), `rust-toolchain.toml` (Rust 1.93), `.nvmrc` (Node 24).

## Cross-cutting conventions

- **i18n is non-negotiable.** The admin ships in **11 locales** (`ar, de, de-AT,
  en, es, fr, it, nl, pl, pt, uk`, including RTL Arabic). User-facing strings go
  through `react-i18next`; backfill *every* locale, don't rely on fallback.
- **Never edit an existing migration.** Add a new one. Migrations are
  irreversible and may already be applied in production.
- **Soft-delete + Trash.** Blogs, pages, media, documents, legal, social links,
  and navigation soft-delete to a 30-day Trash. (Portfolio/projects/forms/
  collections currently soft-delete *without* a Trash entry — see open issues.)
- **Validation seam.** Backend DTOs use a `ValidatedJson<T>` extractor; never the
  raw `Json<T>`. CI enforces this.
- **OpenAPI is the contract.** Backend handlers are annotated with utoipa; the
  admin's `src/generated/api-types.ts` is generated from that spec.
- **Accessibility:** target WCAG 2.1 AA. **Test IDs:** add `data-testid` to UI
  for e2e; don't rely on CSS selectors.

## Working agreements

- Make the **minimum** change that solves the problem; match surrounding style;
  don't refactor unrelated code or delete pre-existing dead code unprompted.
- Prefer tests as the verification loop. Run the relevant package's checks before
  declaring done (see each package's `AGENTS.md`).
- Don't commit plan/spec/scratch docs into the tree.

## Quickstart

```bash
docker compose -f docker-compose.dev.yaml up -d   # Postgres + Redis + pgAdmin
cd backend && cp .env.example .env && sqlx migrate run && cargo run   # API :8000
cd admin && npm install && npm run dev                                # SPA :3000
```
