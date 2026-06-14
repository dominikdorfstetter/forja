# Changelog

All notable changes to Forja are documented here. This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Forja is a GDPR-first, multi-tenant headless CMS — a Rust (Axum) backend and a React (MUI Material 3) admin SPA. It matured through a private 1.x series; **2.0.0 is the first release published as open source**, so the public version history begins at 2.0. The pre-release milestones below condense how the foundation came together; precise dates start at the first public release.

## [Unreleased]

## [2.0.1] — 2026-06-14

A maintenance release: it completes the GDPR transparency surface, hardens the engineering foundation laid in 2.0.0, brings the end-to-end suite back online as a CI gate, and refreshes every dependency to clear all outstanding security advisories.

### Added

- **PII inventory on the Profile page.** A "what we store about you" view (GDPR Art. 15) backed by `GET /auth/pii-inventory`, listing each identity-bearing field with its purpose, legal basis, retention behaviour, and the caller's live record count.
- **Built-in PII classification.** A registry declaring purpose, legal basis, and retention behaviour per identity field; it auto-generates the Records of Processing (RoPA) entries, drives a configurable data-retention cap, and is kept honest by account-erasure parity checks.
- **End-to-end critical-journey CI gate.** The Cucumber/Playwright suite runs its `@critical` journeys — login, blog publish through to the public content-API view, and document management — on every pull request, with the full suite scheduled nightly. A failed scenario retries once before failing the check.

### Changed

- **Typed query-key factory.** Admin data fetching now routes through one centralized, lint-locked TanStack Query key factory with per-site cache invalidation, replacing ad-hoc inline keys.
- **Zero inline SQL in handlers.** All database queries live in the repository/model layer; handlers stay thin.
- **Broader behavioural test coverage** for previously untested hooks and shared components.
- **Pinned React Doctor in CI** — the admin quality gate runs a version-pinned CLI instead of tracking an upstream marketplace action.
- **Dependency refresh** across the whole monorepo to the latest compatible versions (MUI 9.1, Tiptap 3.26.1, jsonwebtoken 10, and patch/minor bumps throughout).

### Fixed

- **Site members could not save localized content.** The blog/page/legal localization endpoints gated on API-key permission tiers, so a signed-in editor was rejected before their site role was ever checked; authorization now resolves by site role.
- **First localization save failed.** The admin dropped the locale id when creating a content localization, so the first save of any new post errored.
- **Render-phase side effects** (ref writes and `setState` during render) removed from Social Links and the cookie-consent page.
- **Test setup hardening** so service mocks cover every module, removing a class of flaky/false-negative admin tests.

### Security

- Cleared a **high-severity esbuild advisory** (GHSA-gv7w-rqvm-qjhr) by forcing the patched release in the Astro reference template, and a **moderate joi advisory** in the docs site.
- jsonwebtoken upgraded to v10 with an explicit crypto provider.
- `npm audit` and `cargo audit` are clean across every package.

## [2.0.0] — 2026-06-05

The first open-source release of Forja: a multi-tenant, GDPR-first headless CMS with a Rust (Axum) backend, a React (MUI Material 3) admin SPA, and provider-agnostic integrations. Everything below is shipped and exercised end to end — backend, admin, client SDK, web-component library, and reference template.

### Architecture

- **Rust backend on Axum.** An async HTTP service backed by PostgreSQL (SQLx, compile-time-checked queries, additive-only migrations) and Redis. Thin handlers over an explicit service/repository layering, with stable, documented error codes on every failure path and an OpenAPI spec generated from the code.
- **React admin SPA.** A Material 3 ("expressive") dashboard built with MUI, React Hook Form, and TanStack Query, served from the backend at `/dashboard/`. A composable list-page design system (page header, data table, filters, loading/empty/error states) underpins every management screen, with a command palette (Cmd/Ctrl-K), a global save bar with per-field revert and a navigation guard, and light/dark theming.
- **Multi-tenant by construction.** Every site is an isolated tenant; content, members, API keys, and quotas are scoped per site. Slug uniqueness is enforced per-site, never globally.

### Content & authoring

- **Core content types** — blogs, pages (section-composed), legal documents, navigation menus, taxonomy (tags/categories), and media — with full CRUD, version history, scheduled publishing, and an audit trail.
- **Publish lifecycle.** A single transactional create/update path with a publish gate that requires only each site's **default** locale to be filled; readers fall back to the default for any locale left untranslated.
- **Trash & restore.** Content soft-deletes to a per-site Trash, is restorable for 30 days, then auto-purges — uniformly across every content type, including Portfolio entries.
- **Portfolio module** — projects, CV entries, and skills, with localizations, media, links, and per-locale list endpoints sized to avoid per-item detail fan-out.
- **Forms module** — structured submission collection with typed, validated, translatable fields; copy-on-create templates; a triage inbox with status workflow, notes, and CSV export; crypto-grade self-service reference codes; an hourly GDPR retention worker; and PII-safe webhook payloads.
- **Collections (custom content types)** — site owners define their own translatable content types from the admin with no code, migration, or deploy. Entries ride the same content spine (so they inherit lifecycle, versioning, audit, and webhooks), schemas are stored as data rather than DDL, and every field declares its PII status, purpose, legal basis, and retention.

### Compliance & privacy

- **GDPR by construction.** PII fields are encrypted at rest (AES-256-GCM), stripped from public read APIs, redacted by role, retention-purged on schedule, and erasable per subject with an audit record.
- **Records of Processing (Art. 30).** A site's Collections schema auto-generates a RoPA export.
- **Runtime-config GDPR Imprint** (Impressum) served from environment configuration, so no operator PII is committed to the repository.
- **Privacy-first bot protection.** Self-hosted [ALTCHA](https://altcha.org/) proof-of-work is the default — challenges issued and verified in-process, no third-party request, no cookies, with single-use replay protection — alongside an optional remote-vendor mode.

### Security & access control

- **Role-based access control** with a clear permission hierarchy, scoped per site and enforced on every mutation.
- **Dual authentication** — site-scoped API keys and Clerk-issued JWTs — resolved through one actor seam.
- **API-key quotas & rate limiting** with configurable per-key burst caps and calendar quotas, backed by Redis.
- **Request validation** enforced repo-wide: invalid bodies return `422` with field-level detail.
- **Audit logging** across membership changes, ownership transfers, and content mutations.

### Performance

- **Response cache.** A short-lived, Redis-backed read-through cache sits after authentication on the public content surface; writes invalidate the affected site's cache through a single publish chokepoint, so reads stay fast without serving stale content.

### Integrations & delivery

- **Provider-agnostic AI.** A sealed adapter seam over OpenAI-compatible chat APIs powers admin authoring assists (translate-from-default, vision tagging/alt-text) with selectable provider presets — never a hardcoded vendor.
- **Webhooks** with HMAC-SHA256 signing, retries, and delivery tracking; in-app notifications; and RSS 2.0 feeds for blogs.
- **URL redirect management** (301/302/307/308) with single-path lookup for SSR middleware.
- **Media library** with local-filesystem or S3-compatible storage, image processing (thumbnails, optimization, focal point), and folder organization.
- **`@forjacms/client`** — an Angular/TypeScript SDK generated from the OpenAPI spec, covering the full public surface including a generic `collections(key)` resource.
- **`@forjacms/sections`** — a framework-agnostic Stencil web-component library (Hero, Features, CTA, Gallery, Contact, Newsletter, Portfolio, and more) with an auto-generated React wrapper, HTML-sanitized by default.
- **Astro reference template** (`templates/astro-blog/`) — a build-memoized blog/portfolio site that renders pages, Portfolio, legal documents, forms, and page Collections from the API.

### Internationalization

- **11 locales** — Arabic, Austrian German, German, English, Spanish, French, Italian, Dutch, Polish, Portuguese, and Ukrainian — across the admin UI and visitor-facing content, with a build-time key-parity check and full RTL support.

### Infrastructure

- Multi-stage Docker build on a hardened Debian base; Docker Compose for local development (PostgreSQL, Redis).
- GitHub Actions CI: backend build/clippy/test, admin build/typecheck/test, frontend health gate, and an OpenAPI-drift check.
- Railway deployment with health-check-driven zero-downtime rollout and graceful shutdown.

## Development history

_The 0.x milestones below condense the early build-out; development then continued through a private 1.x series before the 2.0.0 open-source release. Exact dates were not preserved; phasing is relative._

## [0.6.0] — _Late development_

- **Collections — compliance-grade custom content types.** Site-defined translatable content types stored as data on the content spine, with per-field PII classification, legal basis, retention, encryption at rest, public-API stripping, and auto-generated Art. 30 RoPA export.
- **Welcome rebrand & GDPR Imprint.** A plain-language, compliance-first signed-out experience and a runtime-config Impressum.
- **Documentation, screenshots, and an agent-agnostic repository.** Verified admin/getting-started docs, a repeatable screenshot pipeline, and tool-neutral repo guidance.

## [0.5.0] — _Mid-to-late development_

- **Forms module** — structured, translatable submission collection with templates, a triage workflow, self-service reference codes, retention worker, and PII-safe webhooks.
- **Self-hosted ALTCHA** as the default, privacy-first bot-protection provider, with an optional remote-vendor mode.
- **API-key quotas & response cache** — enforced, UI-editable quotas, configurable burst caps, and a Redis-backed read-through cache with admin management.
- **Multi-tenant slug uniqueness** rescoped from global to per-site, and multi-replica worker safety.
- **AI feature rollout** behind a provider-agnostic adapter seam, plus a content authorization seam and a uniform single-item content-route contract.

## [0.4.0] — _Mid development_

- **Backend HTTP layer consolidated on Axum**, unifying extraction, error handling, and routing behind a single app and a thin handler layer.
- **Material 3 admin redesign** ("expressive") with dashboard statistics, a composable list-page design system, and a global save system replacing autosave.
- **Security defaults hardening** and a monorepo dependency refresh.

## [0.3.0] — _Early-to-mid development_

- **Portfolio module** — projects, CV entries, and skills with localizations, media, and links.
- **Web-component Sections library** (`@forjacms/sections`, Stencil) plus the expanded `@forjacms/client` SDK and server-side locale filtering.
- **Observability foundation** — request-scoped tracing, structured JSON logs, and access logging.
- **SEO, RBAC depth, and user moderation**, navigation redesign, draft preview, focal-point media, and content Trash/restore.

## [0.2.0] — _Early development_

- **Multi-site content management** — blogs, pages, legal documents, navigation menus, taxonomy, and media, with i18n, scheduled publishing, RSS feeds, and URL redirects.
- **React admin dashboard** with MUI, a markdown/block editor, a drag-and-drop menu builder, a command palette, and a language switcher.
- **Webhooks** (HMAC-signed, retried, tracked), in-app notifications, audit logging, and API-key + Clerk JWT authentication.
- **ActivityPub federation** groundwork for syndicating published content.

## [0.1.0] — _Project foundation_

- Initial Rust backend over PostgreSQL (SQLx migrations) and Redis, with role-based access control, OpenAPI/Swagger documentation, and Redis-backed rate limiting.
- S3-compatible and local media storage with image processing.
- The first Astro-based reference template.
- Docker and Docker Compose for local development, and the initial CI pipeline.

[Unreleased]: https://github.com/dominikdorfstetter/forja/compare/v2.0.1...HEAD
[2.0.1]: https://github.com/dominikdorfstetter/forja/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/dominikdorfstetter/forja/releases/tag/v2.0.0
