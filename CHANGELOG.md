# Changelog

## v1.0.3

### Astro Blog Template

- **SEO meta tags**: Added `SeoHead` component with OpenGraph, Twitter Cards, JSON-LD structured data, and canonical URLs on all pages (#10)
- **Pagination**: Added `Pagination` component with smart ellipsis navigation; blog listing paginated at `/blog/page/[page]` (#11)
- **Tag & category archives**: Added category archive pages at `/blog/category/[slug]` with pagination; tag pages redirect to categories (#12)
- **Responsive images**: Added `ResponsiveImage` component with `<picture>`, `srcset`, AVIF/WebP variant support (#15)
- **N+1 cover image fix**: Added `fetchMediaBatch()` for parallel batch fetching; `BlogCard` accepts pre-fetched `coverMedia` prop (#17)
- **HTTP cache headers**: Set `Cache-Control` on all SSR pages (300s–3600s browser, longer CDN) (#18)
- **Social links**: Added `SocialLinks` component with 13 platform SVG icons, integrated into Footer (#19)
- **Sitemap**: Added `sitemap.xml.ts` route with blog posts, CMS pages, priorities, and lastmod dates (#20)

### Backend

- Added blog category filter endpoint (`GET /sites/{id}/blogs/category/{slug}`)
- Raised default API key rate limits 10x (100/s, 1000/m, 10000/h, 100000/d) to support SSR workloads
- Added `worker-src 'self' blob:` to dashboard Content-Security-Policy for Clerk workers

### Infrastructure

- Fixed CI workflow permissions: added `pull-requests: read` for `dorny/paths-filter`
- Fixed CodeQL workflow permissions: added `actions: read` for telemetry access

## v1.0.2

### Backend

- Extracted shared ReviewService and BulkContentService to reduce handler duplication (~25% reduction in blog.rs/page.rs)
- Replaced unsafe `.unwrap()` in RSS date parsing with safe `.zip()` chain
- Centralized hardcoded constants (featured limits, RSS limits, webhook timeouts)
- Added composite database index on `audit_logs(site_id, created_at DESC)` for pagination
- Pinned Rust toolchain to 1.93 via `rust-toolchain.toml`
- Resolved CodeQL cleartext-logging findings by internalizing clerk_user_id resolution in ReviewService

### Admin Dashboard

- Reduced CRUD boilerplate with shared `DataTable`, `useCrudMutations`, and `useListPageState` hooks
- Removed all `as any` casts — replaced with proper types (`as const`, `as Resolver<T>`)
- Fixed 14 ESLint warnings (stabilized hook dependencies, ref-guard pattern for form-sync effects)
- Synced frontend `Site` type with backend DTO (added `created_by` field)

### Infrastructure

- Added Docker build test to CI pipeline
- Replaced CodeQL default setup with path-filtered custom workflow (Rust/JS/Actions analyzed independently)
- Added `.nvmrc` pinning Node.js to 20

## v1.0.1

### Infrastructure

- Docker publish now triggers only on version tags (`v*`) instead of every push to main
- Documentation deploy now triggers only on version tags with version displayed in navbar
- CI uses path filtering to skip unrelated jobs (backend skips on admin-only changes and vice versa)
- CI concurrency groups cancel superseded PR runs
- Added `CI Pass` gate job for branch protection compatibility

### Backend

- Health endpoint now returns API version (`version` field from `Cargo.toml`)
- API root endpoint uses compile-time version constant instead of hardcoded string

### Admin Dashboard

- Version chip displayed in dashboard system health section (sourced from backend)
- Version chip displayed in Settings > System Info health alert

## v1.0.0 - Initial Release

The first public release of Forja, a multi-site CMS platform with a Rust backend, React admin dashboard, and pluggable frontend templates.

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
