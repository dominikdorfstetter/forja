# <img src="admin/public/icons/forja-icon.svg" width="32" height="32" alt="Forja logo"> Forja

*Forja (Spanish: forge) — an open-source multi-site CMS where you forge your content. Like a blacksmith shapes raw metal
into something useful, Forja lets you shape, manage, and deliver content across multiple sites from a single powerful backend.*

**Author:** Dominik Dorfstetter
**License:** AGPL-3.0-or-later

> Full documentation: **[forja-docs.dorfstetter.at](https://forja-docs.dorfstetter.at)**

## Architecture

| Component              | Stack                                                                        | Directory                             |
|------------------------|------------------------------------------------------------------------------|---------------------------------------|
| **Backend API**        | Rust (Axum 0.8) · SQLx · PostgreSQL                                          | [`backend/`](backend/)                |
| **Admin Dashboard**    | React 19 · MUI v9 · Vite · Clerk Auth                                        | [`admin/`](admin/)                    |
| **Frontend Templates** | Astro 5 (SSR)                                                                | [`templates/`](templates/astro-blog/) |
| **Shared Libraries**   | `@forjacms/analytics`, `@forjacms/client`, `@forjacms/sections` (TypeScript) | [`libs/`](libs/)                      |
| **Docs**               | Docusaurus                                                                   | [`docs/`](docs/)                      |

### Key Features

- Multi-site / multi-tenant content management
- Internationalization (i18n) with per-locale content (11 languages including RTL Arabic)
- Blog posts, pages, portfolio (CV entries, skills, and projects), legal documents, navigation, media library
- Rich block editor (Tiptap) with slash commands, tables, code highlighting, and image picker
- AI Content Assist — generate blog drafts, SEO metadata, excerpts, and translations via configurable LLM providers
- Privacy-first analytics — pageview tracking without cookies or PII (GDPR-friendly by design)
- Role-based access control (Owner > Admin > Editor > Author > Reviewer > Viewer) with optional editorial workflow
- WCAG 2.1 Level AA accessibility compliance
- Structured error codes with localized user-facing messages
- Dual authentication: API keys and Clerk JWT
- Redis-backed rate limiting
- OpenAPI documentation (Swagger UI at `/api-docs`)
- Audit logging, webhooks with HMAC-SHA256 signing, debounce, and analytics, content scheduling

## Quickstart

### Prerequisites

- **Rust** 1.97+ — install via [rustup](https://rustup.rs/)
- **Node.js** 24+ — install via [nvm](https://github.com/nvm-sh/nvm) or [nodejs.org](https://nodejs.org/)
- **Docker** — for PostgreSQL and Redis
- **SQLx CLI** — `cargo install sqlx-cli`

### 1. Start infrastructure

```bash
git clone https://github.com/dominikdorfstetter/forja.git
cd forja
docker compose -f docker-compose.dev.yaml up -d
```

This starts PostgreSQL (`localhost:5432`), Redis (`localhost:6379`), and pgAdmin (`http://localhost:5050`).

### 2. Configure and start the backend

```bash
cd backend
cp .env.example .env
# Edit .env — set CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY, SYSTEM_ADMIN_CLERK_IDS
sqlx migrate run
./scripts/dev_init.sh   # Optional: seed sample content
cargo run
```

API: `http://localhost:8000` · Swagger UI: `http://localhost:8000/api-docs`

### 3. Start the admin dashboard

```bash
cd admin
npm install
npm run dev
```

Dashboard: `http://localhost:3000` (proxied to backend). No `.env` needed — config is fetched from the backend.

> See the [Getting Started guide](https://forja-docs.dorfstetter.at/getting-started) for full setup instructions including Clerk configuration.

## Docker

```bash
docker pull dominikdorfstetter/forja
```

See the [Docker deployment guide](https://forja-docs.dorfstetter.at/deployment/docker) for full configuration.

## Project Structure

| Directory                  | Description                                        | README                                                           |
|----------------------------|----------------------------------------------------|------------------------------------------------------------------|
| [`backend/`](backend/)     | Rust API — Axum + SQLx + PostgreSQL                | [backend/README.md](backend/README.md)                           |
| [`admin/`](admin/)         | React admin dashboard — Vite + MUI v9              | [admin/README.md](admin/README.md)                               |
| [`templates/`](templates/) | Frontend templates — Astro 5 SSR                   | [templates/astro-blog/README.md](templates/astro-blog/README.md) |
| [`libs/`](libs/)           | Shared libraries — analytics, client SDK, sections | [libs/README.md](libs/README.md)                                 |
| [`e2e/`](e2e/)             | End-to-end tests — Cucumber + Playwright           | [e2e/README.md](e2e/README.md)                                   |
| [`scripts/`](scripts/)     | Development helper scripts                         | [scripts/README.md](scripts/README.md)                           |
| [`docs/`](docs/)           | Docusaurus documentation site                      | —                                                                |

## Development

```bash
# Backend
cd backend && cargo run              # Start API server
cd backend && cargo test             # Run tests

# Admin
cd admin && npm run dev              # Start dev server
cd admin && npm test                 # Run tests
cd admin && npm run typecheck        # Type check

# E2E Tests (Cucumber + Playwright)
cd e2e && npm install                # Install dependencies
cd e2e && ./scripts/run-e2e.sh       # Run all e2e tests
cd e2e && npm test -- --tags "@auth" # Run by tag

# Docs (local preview)
cd docs && npm install && npm start
```

## Contributing

1. Create a feature branch from `main`
2. Run the full test suite: `./scripts/dev-test.sh`
3. Run React Doctor: `cd admin && npm run react-doctor:online` (score must be 100)
4. Update documentation if adding features or fixing bugs
5. Submit a pull request

See the [Contributing guide](https://forja-docs.dorfstetter.at/developer/contributing) for details.
