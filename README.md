# <img src="admin/public/icons/forja-icon.svg" width="32" height="32" alt="Forja logo"> Forja

*Forja (Spanish: forge) — an open-source multi-site CMS where you forge your content. Like a blacksmith shapes raw metal
into something useful, Forja lets you shape, manage, and deliver content across multiple sites from a single powerful backend.*

**Author:** Dominik Dorfstetter
**License:** AGPL-3.0-or-later

> Full documentation: **[dominikdorfstetter.github.io/forja](https://dominikdorfstetter.github.io/forja/)**

## Architecture

| Component              | Stack                                    | Directory               |
|------------------------|------------------------------------------|-------------------------|
| **Backend API**        | Rust (Rocket 0.5) · SQLx · PostgreSQL    | [`backend/`](backend/)  |
| **Admin Dashboard**    | React 19 · MUI v7 · Vite · Clerk Auth   | [`admin/`](admin/)      |
| **Frontend Templates** | Astro 5 (SSR)                            | [`templates/`](templates/astro-blog/) |
| **Shared Libraries**   | `@forja/analytics` (TypeScript)          | [`libs/`](libs/)        |
| **Docs**               | Docusaurus                               | [`docs/`](docs/)        |

### Key Features

- Multi-site / multi-tenant content management
- Internationalization (i18n) with per-locale content (8 locales)
- Blog posts, pages, CV entries, legal documents, navigation, media library
- Rich block editor (Tiptap) with slash commands, tables, code highlighting, and image picker
- AI Content Assist — generate blog drafts, SEO metadata, excerpts, and translations via configurable LLM providers
- Privacy-first analytics — pageview tracking without cookies or PII (GDPR-friendly by design)
- Role-based access control (Master > Admin > Write > Read)
- Dual authentication: API keys and Clerk JWT
- Redis-backed rate limiting
- OpenAPI documentation (Swagger UI at `/api-docs`)
- Audit logging, webhooks with HMAC-SHA256 signing, content scheduling

## Quickstart

### Prerequisites

- **Rust** 1.93+ — install via [rustup](https://rustup.rs/)
- **Node.js** 18+ — install via [nvm](https://github.com/nvm-sh/nvm) or [nodejs.org](https://nodejs.org/)
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

Dashboard: `http://localhost:5173` (proxied to backend). No `.env` needed — config is fetched from the backend.

> See the [Getting Started guide](https://dominikdorfstetter.github.io/forja/getting-started) for full setup instructions including Clerk configuration.

## Docker

```bash
docker pull dominikdorfstetter/forja
```

See the [Docker deployment guide](https://dominikdorfstetter.github.io/forja/deployment/docker) for full configuration.

## Project Structure

| Directory | Description | README |
|-----------|-------------|--------|
| [`backend/`](backend/) | Rust API — Rocket + SQLx + PostgreSQL | [backend/README.md](backend/README.md) |
| [`admin/`](admin/) | React admin dashboard — Vite + MUI v7 | [admin/README.md](admin/README.md) |
| [`templates/`](templates/) | Frontend templates — Astro 5 SSR | [templates/astro-blog/README.md](templates/astro-blog/README.md) |
| [`libs/`](libs/) | Shared libraries — `@forja/analytics` | [libs/README.md](libs/README.md) |
| [`scripts/`](scripts/) | Development helper scripts | [scripts/README.md](scripts/README.md) |
| [`docs/`](docs/) | Docusaurus documentation site | — |
| [`deploy/`](deploy/) | Deployment configurations (Fly.io) | — |

## Development

```bash
# Backend
cd backend && cargo run              # Start API server
cd backend && cargo test             # Run tests

# Admin
cd admin && npm run dev              # Start dev server
cd admin && npm test                 # Run tests
cd admin && npm run typecheck        # Type check

# Docs (local preview)
cd docs && npm install && npm start
```

## Contributing

1. Create a feature branch from `main`
2. Ensure `cargo fmt`, `cargo clippy`, and `cargo test` pass for backend changes
3. Ensure `npm run typecheck` and `npm run lint` pass for admin changes
4. Submit a pull request
