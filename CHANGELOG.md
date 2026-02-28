# Changelog

## v1.0.1 (Unreleased)

### Infrastructure

- Docker publish now triggers only on version tags (`v*`) instead of every push to main
- Documentation deploy now triggers only on version tags with version displayed in navbar
- CI uses path filtering to skip unrelated jobs (backend skips on admin-only changes and vice versa)
- CI concurrency groups cancel superseded PR runs
- Added `CI Pass` gate job for branch protection compatibility

## v1.0.0 - Initial Release

The first public release of OpenYapper, a multi-site CMS platform with a Rust backend, React admin dashboard, and pluggable frontend templates.

### Backend API (Rust / Rocket)

- Multi-site / multi-tenant content management with full CRUD for blogs, pages, CV entries, legal documents, navigation menus, and media
- Internationalization (i18n) with per-locale content support
- Role-based access control with four permission levels: Master > Admin > Write > Read
- Dual authentication: API keys (`X-API-Key`) and Clerk JWT (`Authorization: Bearer`)
- Redis-backed rate limiting
- OpenAPI / Swagger UI documentation at `/api-docs`
- Audit logging with full change history
- Content scheduling (publish at future date)
- Webhook system with HMAC-SHA256 signing, retry logic, and delivery tracking
- In-app notification system
- RSS 2.0 feed generation for blog posts
- URL redirect management (301/302)
- Media library with local filesystem and S3-compatible storage support
- Image processing (thumbnails, optimization)
- HTTPS/TLS support via Rocket's built-in rustls
- Health check endpoint with storage stats
- SQL migrations via SQLx

### Admin Dashboard (React / Vite)

- Full content management UI built with MUI (Material UI)
- Clerk-based authentication with role enforcement
- Drag-and-drop navigation menu builder
- Markdown editor for blog posts and pages
- Media library with upload, search, and management
- Webhook configuration and delivery log viewer
- API key management
- Audit log viewer
- Command palette (Cmd+K) for quick navigation
- Internationalization (i18n) with language switcher
- Light/dark theme support
- Setup checklist and onboarding flow

### Infrastructure

- Docker support with multi-stage Dockerfile
- Docker Compose for local development (PostgreSQL, Redis, pgAdmin)
- GitHub Actions CI pipeline (backend build/test/lint, admin build/typecheck)
- Railway deployment guide

### Frontend Templates

- Astro-based blog/portfolio template (`templates/astro-blog/`)
