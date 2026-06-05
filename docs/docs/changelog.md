---
sidebar_position: 100
---

# Changelog

This page tracks the release history of Forja. The canonical changelog lives in
[CHANGELOG.md](https://github.com/dominikdorfstetter/forja/blob/main/CHANGELOG.md)
at the repository root; this page mirrors it.

Forja is a GDPR-first, multi-tenant headless CMS — a Rust (Axum) backend and a
React (MUI Material 3) admin SPA — built privately over a long arc before its
first public cut. The pre-1.0 entries below are a condensed history of how that
foundation came together; precise dates start at the first public release.

## 1.0.0 — 2026-06-05

The first public release of Forja: a multi-tenant, GDPR-first headless CMS with a
Rust (Axum) backend, a React (MUI Material 3) admin SPA, and provider-agnostic
integrations. Everything below is shipped and exercised end to end — backend,
admin, client SDK, web-component library, and reference template.

### Architecture

- **Rust backend on Axum.** An async HTTP service backed by PostgreSQL (SQLx,
  compile-time-checked queries, additive-only migrations) and Redis. Thin
  handlers over an explicit service/repository layering, with stable, documented
  error codes on every failure path and an OpenAPI spec generated from the code.
- **React admin SPA.** A Material 3 ("expressive") dashboard built with MUI,
  React Hook Form, and TanStack Query, served from the backend at `/dashboard/`.
  A composable list-page design system underpins every management screen, with a
  command palette (Cmd/Ctrl-K), a global save bar with per-field revert and a
  navigation guard, and light/dark theming.
- **Multi-tenant by construction.** Every site is an isolated tenant; content,
  members, API keys, and quotas are scoped per site. Slug uniqueness is enforced
  per-site, never globally.

### Content & authoring

- **Core content types** — blogs, pages (section-composed), legal documents,
  navigation menus, taxonomy (tags/categories), and media — with full CRUD,
  version history, scheduled publishing, and an audit trail.
- **Publish lifecycle.** A single transactional create/update path with a publish
  gate that requires only each site's **default** locale to be filled; readers
  fall back to the default for any locale left untranslated.
- **Trash & restore.** Content soft-deletes to a per-site Trash, is restorable for
  30 days, then auto-purges — uniformly across every content type.
- **Portfolio module** — projects, CV entries, and skills, with localizations,
  media, links, and per-locale list endpoints.
- **Forms module** — structured submission collection with typed, validated,
  translatable fields; copy-on-create templates; a triage inbox with status
  workflow, notes, and CSV export; self-service reference codes; an hourly GDPR
  retention worker; and PII-safe webhook payloads.
- **Collections (custom content types)** — site owners define their own
  translatable content types from the admin with no code, migration, or deploy.
  Entries ride the same content spine (inheriting lifecycle, versioning, audit,
  and webhooks), schemas are stored as data rather than DDL, and every field
  declares its PII status, purpose, legal basis, and retention.

### Compliance & privacy

- **GDPR by construction.** PII fields are encrypted at rest (AES-256-GCM),
  stripped from public read APIs, redacted by role, retention-purged on schedule,
  and erasable per subject with an audit record.
- **Records of Processing (Art. 30).** A site's Collections schema auto-generates
  a RoPA export.
- **Runtime-config GDPR Imprint** (Impressum) served from environment
  configuration, so no operator PII is committed to the repository.
- **Privacy-first bot protection.** Self-hosted [ALTCHA](https://altcha.org/)
  proof-of-work is the default — challenges issued and verified in-process, no
  third-party request, no cookies, with single-use replay protection — alongside
  an optional remote-vendor mode.

### Security & access control

- **Role-based access control** with a clear permission hierarchy, scoped per site
  and enforced on every mutation.
- **Dual authentication** — site-scoped API keys and Clerk-issued JWTs — resolved
  through one actor seam.
- **API-key quotas & rate limiting** with configurable per-key burst caps and
  calendar quotas, backed by Redis.
- **Request validation** enforced repo-wide: invalid bodies return `422` with
  field-level detail.
- **Audit logging** across membership changes, ownership transfers, and content
  mutations.

### Performance

- **Response cache.** A short-lived, Redis-backed read-through cache sits after
  authentication on the public content surface; writes invalidate the affected
  site's cache through a single publish chokepoint, so reads stay fast without
  serving stale content.

### Integrations & delivery

- **Provider-agnostic AI.** A sealed adapter seam over OpenAI-compatible chat APIs
  powers admin authoring assists (translate-from-default, vision tagging/alt-text)
  with selectable provider presets — never a hardcoded vendor.
- **Webhooks** with HMAC-SHA256 signing, retries, and delivery tracking; in-app
  notifications; and RSS 2.0 feeds for blogs.
- **URL redirect management** (301/302/307/308) with single-path lookup for SSR
  middleware.
- **Media library** with local-filesystem or S3-compatible storage, image
  processing (thumbnails, optimization, focal point), and folder organization.
- **`@forjacms/client`** — an Angular/TypeScript SDK generated from the OpenAPI
  spec, covering the full public surface including a generic `collections(key)`
  resource.
- **`@forjacms/sections`** — a framework-agnostic Stencil web-component library
  (Hero, Features, CTA, Gallery, Contact, Newsletter, Portfolio, and more) with an
  auto-generated React wrapper, HTML-sanitized by default.
- **Astro reference template** (`templates/astro-blog/`) — a build-memoized
  blog/portfolio site that renders pages, Portfolio, legal documents, forms, and
  page Collections from the API.

### Internationalization

- **11 locales** — Arabic, Austrian German, German, English, Spanish, French,
  Italian, Dutch, Polish, Portuguese, and Ukrainian — across the admin UI and
  visitor-facing content, with a build-time key-parity check and full RTL support.

### Infrastructure

- Multi-stage Docker build on a hardened Debian base; Docker Compose for local
  development (PostgreSQL, Redis).
- GitHub Actions CI: backend build/clippy/test, admin build/typecheck/test,
  frontend health gate, and an OpenAPI-drift check.
- Railway deployment with health-check-driven zero-downtime rollout and graceful
  shutdown.

## Pre-1.0 development history

_Condensed milestones from the private build-out. Exact dates were not preserved;
phasing is given relative to the project's development arc._

### 0.6.0 — _Late development_

- **Collections — compliance-grade custom content types** stored as data on the
  content spine, with per-field PII classification, legal basis, retention,
  encryption at rest, and auto-generated Art. 30 RoPA export.
- **Welcome rebrand & GDPR Imprint** — a plain-language, compliance-first
  signed-out experience and a runtime-config Impressum.
- **Documentation, screenshots, and an agent-agnostic repository.**

### 0.5.0 — _Mid-to-late development_

- **Forms module** — structured, translatable submission collection with
  templates, a triage workflow, reference codes, retention worker, and PII-safe
  webhooks.
- **Self-hosted ALTCHA** as the default, privacy-first bot-protection provider.
- **API-key quotas & response cache** — enforced quotas, configurable burst caps,
  and a Redis-backed read-through cache.
- **Multi-tenant slug uniqueness** rescoped from global to per-site; multi-replica
  worker safety.
- **AI feature rollout** behind a provider-agnostic adapter seam.

### 0.4.0 — _Mid development_

- **Rocket → Axum cutover**, consolidating extraction, error handling, and routing.
- **Material 3 admin redesign** ("expressive") with dashboard statistics and a
  global save system replacing autosave.
- **Security defaults hardening** and a monorepo dependency refresh.

### 0.3.0 — _Early-to-mid development_

- **Portfolio module** — projects, CV entries, and skills.
- **Web-component Sections library** plus the expanded `@forjacms/client` SDK and
  server-side locale filtering.
- **Observability foundation** — request-scoped tracing, structured JSON logs.
- **SEO, RBAC depth, and user moderation**, navigation redesign, draft preview,
  focal-point media, and content Trash/restore.

### 0.2.0 — _Early development_

- **Multi-site content management** — blogs, pages, legal documents, navigation
  menus, taxonomy, and media, with i18n, scheduled publishing, RSS feeds, and URL
  redirects.
- **React admin dashboard** with MUI, a block editor, a drag-and-drop menu
  builder, a command palette, and a language switcher.
- **Webhooks** (HMAC-signed, retried, tracked), in-app notifications, audit
  logging, and API-key + Clerk JWT authentication.

### 0.1.0 — _Project foundation_

- Initial Rust backend over PostgreSQL (SQLx migrations) and Redis, with
  role-based access control, OpenAPI/Swagger documentation, and Redis-backed rate
  limiting.
- S3-compatible and local media storage with image processing.
- The first Astro-based reference template.
- Docker and Docker Compose for local development, and the initial CI pipeline.
