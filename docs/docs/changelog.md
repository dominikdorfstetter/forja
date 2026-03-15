---
sidebar_position: 100
---

# Changelog

This page tracks the release history of Forja. For the most up-to-date changelog, see the [CHANGELOG.md](https://github.com/dominikdorfstetter/forja/blob/main/CHANGELOG.md) file in the repository.

## v1.0.7

### Added

- **Welcome page** -- branded landing page for unauthenticated visitors with Forja logo, tagline, feature carousel, and Sign In / Register buttons
  - Auto-scrolling horizontal carousel showcasing 8 platform features
  - Full i18n support across all 8 languages (EN, DE, FR, ES, IT, PT, NL, PL)
  - Language selector for switching locale before login
  - Creator credit, EU badge, version number, GitHub and Docs links in footer
  - Uses Clerk hosted redirect (CSP-safe) instead of embedded sign-in components

### Fixed

- **CSP blocking Clerk on custom FAPI domains** -- Content-Security-Policy for `/dashboard` now dynamically includes the Clerk Frontend API domain extracted from `CLERK_PUBLISHABLE_KEY`. Custom Clerk domains (e.g. `clerk.dorfstetter.at`) no longer cause blank pages. Optional `CLERK_FAPI_DOMAIN` env var for explicit override.
- **Docker tag immutability conflict** -- removed `major.minor` Docker tag from CI to avoid push conflicts on patch releases

### Changed

- Root route (`GET /`) now redirects to `/dashboard` instead of returning API version string
- `ENCRYPTION_KEY` and `CLERK_FAPI_DOMAIN` documented in `.env.example`
- App version injected at build time via Vite `define` from `package.json`

---

## v1.0.6

### Added

- **ActivityPub Federation** -- full Fediverse integration for blog syndication (#45)
  - WebFinger discovery, Actor profile, Inbox/Outbox protocol endpoints
  - HTTP Signature creation and verification (RSA-SHA256 + Ed25519)
  - 6-layer security pipeline on inbound activities (rate limiting, block checks, signature verification, payload validation, content sanitization)
  - SSRF protection on all outbound HTTP requests
  - Background delivery worker with PostgreSQL queue (Redis-ready with circuit breaker failover)
  - Blog posts syndicated as ActivityPub Article objects with auto-hashtags from tags
  - Direct posting (Notes) with scheduling support
  - Outbound Create, Update, Delete activity flows
  - Publish scheduler (60s interval) auto-federates scheduled content and blog posts
  - Follow/Unfollow handling with auto-accept
  - Inbound likes, boosts, and comments with configurable moderation (queue all / auto-approve / followers only)
  - Federation events pushed to notification system
  - Engagement counters (likes/boosts) on blog detail page
  - Social feed dashboard with Twitter/X-style timeline showing rich post content
  - Quick Post composer with inline edit/delete and scheduling
  - Profile editing (bio, avatar via media picker)
  - Featured/pinned posts (ActivityPub featured collection, max 3)
  - Mastodon-style post preview on blog detail page
  - Followers, comments, activity log management pages
  - Actor blocklist (site-wide) and instance blocklist (sysadmin-only) with CSV import
  - Instance health dashboard with delivery stats per remote server
  - Federation module toggle in Settings > Modules
  - Custom RBAC (federation publish permission separate from content editing)
  - Full i18n support (EN, DE, ES, FR, IT, NL, PL, PT)
  - Encrypted keypairs at rest (AES-256-GCM)
  - Complete documentation: admin guide, API endpoint reference (26 endpoints), OpenAPI spec

### Changed

- `ENCRYPTION_KEY` env var now accepted alongside legacy `AI_ENCRYPTION_KEY` (backward-compatible)
- Site context API now includes `federation` module flag
- Site settings DTO includes `module_federation_enabled`

---

## v1.1.0

### Backend

- **Similar blogs endpoint** -- new `GET /sites/{site_id}/blogs/{id}/similar?limit` endpoint that returns related posts ranked by taxonomy overlap (shared tags, categories, primary category match, and same author).
- **Similar pages** -- `find_similar_pages()` model method for page similarity scoring.
- **Unique slug generation** -- `ContentService::generate_unique_slug()` for creating conflict-free slugs when cloning content.

### Admin Dashboard

- **Blog creation wizard** -- replaced the single-dialog blog form with a step-by-step wizard (slug, metadata, settings).
- **Content template wizard** -- new guided wizard for creating content templates.
- **Dashboard widgets** -- attention panel (items needing review), content status chart, and recent activity feed on the home page.
- **Editorial workflow improvements** -- approve and restore actions, review comment dialog enhancements.
- **Command palette enhancements** -- additional quick actions in Cmd+K.
- **New shared components** -- ApproveDialog, CopyableId, PageTypeChip, RestoreDialog.
- **PWA support** -- web app manifest and app icons for installable dashboard experience.
- **Extended i18n** -- new translation keys across all 8 supported locales (de, en, es, fr, it, nl, pl, pt).

### Astro Blog Template

- **Dark mode** -- system preference detection, manual toggle in the nav bar, and localStorage persistence. All colors adapt via CSS custom properties.
- **Similar blogs section** -- "Continue Reading" section on blog detail pages showing up to 3 related posts from the similarity API.
- **Footer redesign** -- 3-column layout with brand, navigation links, and social icons.
- **UI refinements** -- sticky nav with backdrop blur, card hover animations, responsive excerpt clamping, improved typography and spacing.
- **Category archive pages** -- blog listing filtered by category slug at `/blog/category/{slug}`.

---

## v1.0.0 -- Initial Release

The first public release of Forja, a complete multi-site CMS built with Rust and React.

### Backend

- **Multi-site CMS** -- manage multiple independent websites from a single installation.
- **Internationalization (i18n)** -- localized content fields and navigation titles with full locale management.
- **Role-Based Access Control (RBAC)** -- four permission levels (Master > Admin > Write > Read) with site-level membership roles.
- **Dual authentication** -- supports both API key (`X-API-Key` header) and Clerk JWT (`Authorization: Bearer`) authentication.
- **Rate limiting** -- Redis-backed request rate limiting to protect against abuse.
- **OpenAPI documentation** -- auto-generated Swagger UI at `/api-docs` via utoipa, covering all API endpoints.
- **Audit logging** -- tracks who changed what and when, with queryable audit log endpoints.
- **Content scheduling** -- publish and unpublish blog posts and pages on a schedule.
- **Webhooks** -- event-driven webhook delivery system with retry logic and delivery logs.
- **Notifications** -- in-app notification system for admin users.
- **RSS feeds** -- auto-generated RSS 2.0 feeds for site blog content.
- **URL redirects** -- 301/302 redirect management per site with active/inactive toggle.
- **Media management** -- upload, serve, and organize media files with folder support and image processing.
- **Image processing** -- server-side image resizing and optimization.
- **TLS support** -- native HTTPS via Rocket's rustls integration (`TLS_CERT_PATH` / `TLS_KEY_PATH`).
- **Health check** -- `/health` endpoint reporting PostgreSQL and Redis connection status.
- **SQLx migrations** -- automatic database schema management on application startup.
- **Content types** -- blog posts, static pages, CV entries, legal documents, documents, and content templates.
- **Navigation system** -- hierarchical navigation menus with drag-and-drop ordering and localized titles.
- **Taxonomy** -- tags and categories with i18n support.
- **Social links** -- per-site social media link management.
- **S3 storage** -- optional S3-compatible storage (AWS S3, MinIO, Cloudflare R2, DigitalOcean Spaces).

### Admin Dashboard

- **Full Material UI interface** -- responsive admin dashboard built with React, Vite, and MUI.
- **Clerk authentication** -- sign in with Clerk, with role-based UI visibility.
- **Drag-and-drop navigation** -- visual navigation tree editor with reordering.
- **Markdown editor** -- rich text editing for blog posts and page content.
- **Media library** -- upload, browse, and manage media files with folder organization.
- **Webhook management** -- create, test, and monitor webhook subscriptions with delivery logs.
- **API key management** -- create and manage API keys with different permission levels.
- **Audit log viewer** -- browse and filter the audit trail.
- **Command palette** -- keyboard shortcut (Cmd/Ctrl+K) for quick navigation.
- **Internationalization** -- admin UI language selection.
- **Theme support** -- light and dark mode.
- **Setup checklist** -- guided first-time setup wizard for new installations.
- **Site management** -- create and configure multiple sites.
- **Content editors** -- dedicated editors for blogs, pages, documents, CV entries, and legal pages.
- **Taxonomy management** -- create and assign tags and categories.
- **Redirect management** -- create and manage URL redirects per site.
- **Notification center** -- view and manage in-app notifications.
- **Member management** -- invite and manage site members with role assignment.
- **Settings pages** -- per-site settings configuration including locale and preview URLs.

### Infrastructure

- **Docker** -- multi-stage Dockerfile producing a minimal production image.
- **Docker Compose** -- `docker-compose.dev.yaml` for local development with PostgreSQL, Redis, and pgAdmin.
- **GitHub Actions CI** -- automated pipeline with formatting, linting, unit tests, and integration tests for both backend and admin.
- **Railway deployment guide** -- step-by-step deployment instructions for Railway.
- **Developer scripts** -- helper scripts for starting, stopping, testing, building, seeding, and cleaning the development environment.

### Templates

- **Astro blog template** -- server-rendered blog and portfolio site built with Astro 5, including pages for blog posts, CV, legal documents, and RSS feeds.
