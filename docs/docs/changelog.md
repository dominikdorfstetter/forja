---
sidebar_position: 100
---

# Changelog

This page tracks the release history of OpenYapper. For the most up-to-date changelog, see the [CHANGELOG.md](https://github.com/openyapper/openyapper/blob/main/CHANGELOG.md) file in the repository.

## v1.0.0 -- Initial Release

The first public release of OpenYapper, a complete multi-site CMS built with Rust and React.

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
