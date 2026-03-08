# Changelog

## v1.0.5

### Admin Dashboard

- **Site creation wizard** (#48): Added a 4-step site creation wizard with module selection (blog, pages, CV, legal, documents, AI), workflow mode (solo/team), and language configuration. Replaces the basic site form dialog for first-time setup.
- **Onboarding survey** (#49): Added a 3-step onboarding survey (user type + content intents) shown on first login. Answers persist on the user profile and pre-configure wizard defaults. Supports skip (defaults to solo + blog). Full i18n across 8 locales.
- **Adaptive UI** (#73): Dashboard, sidebar, and setup checklist now adapt based on site context — user role, enabled modules, and member count influence what is shown.
- **Solo-to-team transition prompt** (#74): When a site gains multiple contributors, a contextual banner suggests enabling the editorial review workflow.
- **Quick Post dialog** (#70): Added a rapid blog publishing dialog accessible from the dashboard and command palette (Cmd+K → "quick-post").
- **Click-to-edit sections** (#68): Page section summary rows are now clickable to jump directly to editing.

### Backend

- **Site context API** (#71): New `GET /sites/{id}/context` endpoint returns features (workflow, scheduling, versioning, analytics), modules, member count, and suggestions for progressive UI disclosure.
- **AI content generation** (#92): New AI module with configurable provider/model per site. Supports content generation, summarization, and translation via `POST /sites/{id}/ai/generate`.
- **Security fixes** (#63–67): Enforced `authorize_site_action` checks on taxonomy, media, document localization, legal, and blog-document mutation handlers. Fixed `audit_service::log` site_id on affected endpoints.

### Analytics (`@forja/analytics`)

- Bumped to 1.0.5 in sync with the main project.

### Documentation

- Documented AI module, analytics, editor architecture, module system, and version sync policy (#101).

### Infrastructure

- **One-command Docker Compose** (#69): Added `docker-compose.yml` for single-command local deployment with PostgreSQL, Redis, backend, and admin dashboard.

### Testing

- Added missing test coverage for hooks and priority admin pages (#66).

## v1.0.4

### Admin Dashboard

- **Tiptap block editor**: Replaced the Markdown editor (`@uiw/react-md-editor`) with a full block editor built on Tiptap. Supports headings, bold, italic, underline, code blocks with syntax highlighting, tables, task lists, links, and images via the media picker. Storage format remains Markdown via `tiptap-markdown`. (#52)
- **Collapsible right sidebar in blog editor**: Replaced accordion panels with a collapsible right-hand sidebar for blog metadata (status, dates, author, cover image, SEO). Sidebar can be toggled open/closed and persists across sessions. (#53)
- **Lint and test fixes**: Fixed `react/display-name` ESLint error in `useMediaUrl` test; deferred `localStorage` reads in `UserPreferencesContext` to render time to fix jsdom test environment failures; added `localStorage` mock to global test setup.

### Developer Tooling

- **Pre-commit hook**: Added `.githooks/pre-commit` that automatically runs `cargo fmt`, `cargo clippy -- -D warnings`, `npm run lint`, and `npm test` on staged files. Rust checks only run when `.rs` files are staged; frontend checks only run when `admin/` files are staged. (#61)
- **CI fixes**: Applied `cargo fmt` across 8 backend files; suppressed `clippy::too_many_arguments` on Rocket filter handlers and SQL model methods; replaced `.max(1).min(N)` with `.clamp(1, N)` in `list_similar_blogs`. (#61)

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
