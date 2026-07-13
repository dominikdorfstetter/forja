---
sidebar_position: 100
---

# Changelog

This page tracks the release history of Forja. The canonical changelog lives in
[CHANGELOG.md](https://github.com/dominikdorfstetter/forja/blob/main/CHANGELOG.md)
at the repository root; this page mirrors it.

Forja is a GDPR-first, multi-tenant headless CMS — a Rust (Axum) backend and a
React (MUI Material 3) admin SPA. It matured through a private 1.x series; **2.0.0
is the first release published as open source**, so the public version history
begins at 2.0. The pre-release milestones below condense how the foundation came
together; precise dates start at the first public release.

## 2.1.0 — 2026-07-13

Four features driven by consumer feedback from a live production site: a UI-strings module for localized interface chrome, first-class legal-document references in navigation, a public site-settings read, and completed menu localization.

### Added

- **UI Strings module.** A site-scoped, localized key→value dictionary for interface chrome — the "min read" labels, footer texts, aria-labels, and empty-state copy that used to be hard-coded English in the site template. The admin gains a UI Strings page with per-locale coverage at a glance (missing and outdated filters); editing the default-locale value automatically marks other locales as outdated. Consumers fetch `GET /sites/{id}/strings?locale=` — a flat map with one value per key, resolved through the standard locale fallback chain — or call `forja.strings(locale)` in the SDK. The astro-blog template now renders all of its chrome through this system, shipping translatable defaults for 11 locales, so a site can relabel or translate its entire chrome from the CMS without touching template code. Keys are dot-namespaced and capped at 500 per site.
- **Legal documents are first-class navigation targets.** Navigation items can now reference a legal document directly (`legal_document_id`) instead of embedding a fragile free-text `/legal/{cookie_name}` URL that broke on rename — and, before this release, was broken even without one: admin-created legal documents had no slug at all and were unreachable via `/legal/{slug}`. Legal documents now always carry a canonical per-site slug (auto-derived from the document type, editable until first publish, then locked), existing NULL slugs are backfilled, and existing `/legal/…` links are converted to real references in-migration. The public navigation tree resolves the slug through the version chain, so publishing a new version never breaks footer links; items whose target disappears are hidden publicly and flagged as repairable broken links in the admin.
- **Public site-settings read.** New `GET /sites/{id}/settings/public` returns a deliberately small allowlist — contact email, theme colors, SEO title template and default description — to Read-tier API keys, with `forja.site.getSettings()` in the SDK. The raw settings endpoint (operational configuration: CORS origins, quotas, retention) remains Admin-only.
- **Menu localization, end to end.** Menus always stored per-locale display names, but the admin never wrote them and the SDK never exposed them. The menu dialog now edits display names per locale, `forja.navigation.getMenuWithTree(slug, { locale })` fetches a menu and its tree together with the name resolved for a locale, and the astro-blog footer heading comes from the CMS menu name with a chrome-string fallback.

### Fixed

- **SDK `getCodeInjection()` works with Read keys again.** It called the Admin-only raw settings endpoint and 403'd in production for every Read- and Write-tier key despite documenting Read-tier access; it now uses the Viewer-tier site-context endpoint, which carries the same fields.
- **Navigation and menu edits reach the public API without a publish.** Menu, item, and localization mutations now invalidate the response cache directly; previously only the publish pipeline did, so edits lagged behind by up to the cache TTL.
- **Locale-filtered navigation trees no longer blank missing titles.** Requesting a tree in a locale that lacks a translation for an item now falls back to the site-default title instead of rendering an untitled item.
- **Purging a page no longer errors on navigation items that pointed to it.** The item survives as a repairable broken link instead of violating a database constraint mid-purge.
- **The astro-blog preview flow fetched settings it could never read** (Admin-only endpoint, plus fields that don't exist in the response) — it now reads the public settings shape.
- **SDK navigation types match the wire again**: `localizations`, `updated_at`, `legal_document_id`, and `legal_slug` are typed on menu and tree responses.

## 2.0.7 — 2026-07-12

A follow-up to the 2.0.6 legal-versioning work: legal documents now keep a single live version instead of showing every version as its own row.

### Fixed

- **Legal documents keep one live version at a time.** After 2.0.6, editing and re-publishing a legal document left both the old and new version in the list, each marked "Published", with no way to tell which was actually served or to switch between them. Publishing a version now supersedes (archives) the previously-published version in its chain, so the Legal list collapses to one row per document and exactly one version is ever live. Rolling back is just re-publishing an older version — it becomes live and the newer one is superseded; nothing is lost either way. The list shows a `v{n}` badge on documents that have history, and the version panel marks the live version and explains how to roll back.

## 2.0.6 — 2026-07-12

GDPR data-subject-request tooling for operators, a rebuilt legal-document versioning flow, and two admin bug fixes.

### Added

- **Self-service and operator DSR tooling (GDPR Art. 17 & 20).** Account deletion now erases every identity-bearing built-in field — media uploads (`uploaded_by`), AI-usage attribution (`actor_id`), and moderation records join the existing content/membership/audit erasure, all in one transaction — so no attributable data survives a deletion. Self-service and the banned-user purge run the same erasure. The data export (`GET /auth/export`) gained `media` and `ai_usage` sections. System admins can now fulfil DSRs on behalf of a user: `GET /admin/users/{id}/export` and `DELETE /admin/users/{id}/account` (sole-owner-guarded, master/system-admin only), surfaced as "Export data (GDPR)" and "Delete account (GDPR)" actions on System → Users. Every DSR action — self and on-behalf, export and delete — writes an audit row (Art. 30).

### Fixed

- **Legal document versioning works end-to-end.** Creating a new version no longer produces an orphan: the version keeps the document's identity (cookie name) instead of a `_copy` rename, and the public by-slug resolver now returns the currently-published version of a chain — so publishing a new version supersedes the old one at the same URL while the old version is preserved. Editing a published legal document is now safe: the backend rejects in-place edits of published documents (`LEGAL_PUBLISHED_IMMUTABLE`), and the admin transparently forks a new draft version on edit, so the published record is never silently overwritten.
- **Assets → Documents no longer crashes to the error boundary.** A document detail arriving without a localizations array threw during render (`Cannot read properties of undefined`) and blanked the entire page; a single non-conforming document now degrades to a filename fallback instead. The same guard was applied to the document edit dialog.
- **Create Project wizard no longer dead-ends on the last step.** Clicking Create with an invalid field (most reproducibly, a non-Latin title that slugifies to an empty slug) silently did nothing; the wizard now renders an editable slug field, validates per step, and jumps back to the step that owns the first invalid field so the error is visible.

## 2.0.5 — 2026-07-12

Completes the 2.0.4 release. The 2.0.4 publish was interrupted: `@forjacms/sections` failed its pre-publish test gate, and the `v2.0.4` tag was consumed by the immutable-releases protection while re-targeting the release, so it cannot be reissued. `@forjacms/client` and `@forjacms/analytics` 2.0.4 reached npm; 2.0.5 is the first complete release of the 2.0.4 changes across all packages.

### Fixed

- **`@forjacms/sections` test suite under Vite 8.1.** Vite 8.1 stopped inheriting the root `oxc` transformer config into Vitest sub-projects, so Stencil's classic `h` JSX factory was no longer applied and every spec render failed ("The tag name provided (undefined) is not a valid name") — which blocked the package from publishing. The classic-JSX config is now set per project in `vitest.config.ts`; remove once `@stencil/vitest` applies it per project upstream.

## 2.0.4 — 2026-07-12

A bug-fix release for the Legal Documents admin list, with matching client-SDK support for the new list filters and a broad dependency refresh under the hood.

### Fixed

- **Legal document status filters, the Active/Archived tabs, and Archive now actually work.** The legal list endpoint ignored status filters entirely and the admin silently dropped them, so the status chips and tabs were decorative and archiving a document appeared to do nothing (the change persisted but stayed visible). The endpoint now supports `status`, `exclude_status`, and `exclude_document_type` — filtering the rows and the pagination count identically — and the documents table gained a Status column so changes are visible. CookieConsent documents are excluded server-side instead of being stripped client-side after pagination, which also fixes the off-by-one pagination totals ("1–4 of 4" while showing 3 rows).

### Added

- **`@forjacms/client`: legal list filters.** `forja.legal.list()` now accepts `status`, `excludeStatus`, and `excludeDocumentType`, and the legal list response type carries the document's `status`, `slug`, `version`, and publish window, matching what the API returns.

### Changed

- **Dependency refresh.** Backend on Rust 1.97 + edition 2024 and sqlx 0.9; monorepo npm packages batch-bumped (react-router 8, tower-http 0.7 on the backend, react-doctor 0.7.6); the Astro blog template migrated to Astro 7 with `@astrojs/node` 11 (Node ≥ 22.12). All audits clean.

## 2.0.3 — 2026-06-14

A bug-fix release clearing the admin-UI backlog: density-aware tables, the global save-bar migration, and the last read-only enforcement gaps for viewer/guest roles.

### Fixed

- **Compact density now applies to every table.** The four drag-to-reorder tables (Portfolio CV + Projects, Navigation, Social Links) ignored Preferences → Density and stayed at a fixed height; they now track the toggle like every other table. Rows also grow to fit tall cell content — the Members inline role editor and the Sites name+slug and storage columns — instead of clipping it on Compact.
- **A single Save control per content page.** Blog, page, and legal detail pages rendered two Save buttons firing the same save; the editor-toolbar duplicates are removed and the floating global save bar is now the one Save, with stable end-to-end hooks. Collection type and entry forms join the same global save system (unsaved-changes navigation guard + change count), and a dead, unrouted legal-detail page was deleted.

### Security

- **Read-only (viewer/guest) roles can no longer reach write actions that bypassed the UI guard.** Drag-to-reorder on media and document cards, and the Trash restore action, were ungated; all now require write permission. A viewer-walk end-to-end check asserts that no write controls are reachable across the content pages, complementing the existing API-side RBAC.

## 2.0.2 — 2026-06-14

Hotfix for a login regression introduced in 2.0.1.

### Fixed

- **Authenticated requests were rejected after login, locking everyone out of the dashboard.** The jsonwebtoken 9→10 upgrade in 2.0.1 changed JWT header parsing: v10 deserialises unknown header parameters into a flattened `extras: HashMap<String, String>` and rejects any non-string value. Clerk session tokens carry an integer custom header field, so `decode_header` failed for every real token and every `/api/v1/auth/*` call returned `401`. Pinned jsonwebtoken to 9.x (which ignores unknown header fields) and added a regression test, so a future bump cannot silently break login again.

## 2.0.1 — 2026-06-14

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

## 2.0.0 — 2026-06-05

The first open-source release of Forja: a multi-tenant, GDPR-first headless CMS with a
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

## Development history

_The 0.x milestones below condense the early build-out; development then continued
through a private 1.x series before the 2.0.0 open-source release. Exact dates were
not preserved; phasing is relative._

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

- **Backend HTTP layer consolidated on Axum**, unifying extraction, error
  handling, and routing.
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
