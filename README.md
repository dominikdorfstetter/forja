# OpenYapper

A multi-site CMS platform with a Rust backend API, React admin dashboard, and pluggable frontend templates.

**Author:** Dominik Dorfstetter
**License:** AGPL-3.0-or-later

## Architecture

| Component              | Stack                                         | Directory               |
|------------------------|-----------------------------------------------|-------------------------|
| **Backend API**        | Rust (Rocket 0.5) + SQLx + PostgreSQL         | `backend/`              |
| **Admin Dashboard**    | React (Vite) + MUI + React Query + Clerk Auth | `admin/`                |
| **Frontend Templates** | Astro, more to come                           | `templates/astro-blog/` |

### Key Features

- Multi-site / multi-tenant content management
- Internationalization (i18n) with per-locale content
- Blog posts, pages, CV entries, legal documents, navigation, media library
- Role-based access control (Master > Admin > Write > Read)
- Dual authentication: API keys (`X-API-Key`) and Clerk JWT (`Authorization: Bearer`)
- Redis-backed rate limiting
- OpenAPI documentation (Swagger UI at `/api-docs`)
- Audit logging with full change history
- Webhooks with HMAC-SHA256 signing, retry logic, and delivery tracking
- Content scheduling (publish at future date)
- Command palette (Cmd+K) for quick navigation in the admin dashboard

## Quickstart Guide

### Prerequisites

- **Rust** 1.75+ &mdash; install via [rustup](https://rustup.rs/)
- **Node.js** 18+ &mdash; install via [nvm](https://github.com/nvm-sh/nvm) or [nodejs.org](https://nodejs.org/)
- **Docker** &mdash; for PostgreSQL and Redis
- **SQLx CLI** &mdash; `cargo install sqlx-cli`

### 1. Clone the repository

```bash
git clone https://github.com/dominikdorfstetter/openyapper.git
cd openyapper
```

### 2. Start infrastructure (PostgreSQL, Redis, pgAdmin)

```bash
docker compose -f docker-compose.dev.yaml up -d
```

This starts:
- **PostgreSQL** on `localhost:5432` (user: `openyapper`, password: `openyapper`, db: `openyapper`)
- **Redis** on `localhost:6379`
- **pgAdmin** on `http://localhost:5050` (login: `admin@openyapper.dev` / `admin`)

PostgreSQL extensions (`uuid-ossp`, `citext`, `pg_trgm`) are created automatically on first start.

### 3. Register with Clerk (Authentication Provider)

OpenYapper uses [Clerk](https://clerk.com/) for identity management in the admin dashboard.

1. Sign up at [clerk.com](https://clerk.com/) and create a new Application
2. From **API Keys**, copy your **Publishable Key** (`pk_test_...`) and **Secret Key** (`sk_test_...`)
3. Find your **JWKS URL** &mdash; usually `https://<your-clerk-instance>.clerk.accounts.dev/.well-known/jwks.json`
4. Note your **Clerk User ID** (`user_...`) &mdash; this will be seeded as the system admin

### 4. Configure and start the Backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your credentials:

```env
DATABASE_URL=postgres://openyapper:openyapper@localhost:5432/openyapper
CLERK_SECRET_KEY=sk_test_your_secret_key_here
CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
CLERK_JWKS_URL=https://your-instance.clerk.accounts.dev/.well-known/jwks.json
SYSTEM_ADMIN_CLERK_IDS=user_your_clerk_user_id
REDIS_URL=redis://127.0.0.1:6379
```

Run migrations, optionally seed data, and start:

```bash
sqlx migrate run

# (Optional) Seed development data with sample content and dev API keys
./scripts/dev_init.sh

cargo run
```

The API will be available at `http://localhost:8000`. Visit `http://localhost:8000/api-docs` for the Swagger UI.

See [`backend/README.md`](backend/README.md) for full backend documentation.

### 5. Start the Admin Dashboard

The admin dashboard fetches its configuration (Clerk publishable key) from the backend at runtime via `GET /api/v1/config`, so no separate `.env` file is needed.

```bash
cd admin
npm install
npm run dev
```

The admin dashboard will be available at `http://localhost:5173` (proxied to the backend).

To build for production serving from the backend:

```bash
npm run build   # outputs to backend/static/dashboard/
```

Then visit `http://localhost:8000/dashboard` when the backend is running.

### 6. (Optional) Frontend Template

See [`templates/astro-blog/README.md`](templates/astro-blog/README.md) for the Astro-based blog/portfolio frontend.

## Project Structure

```
.
├── backend/                # Rust API (Rocket + SQLx)
│   ├── src/
│   │   ├── main.rs         # Entry point
│   │   ├── lib.rs          # Library exports
│   │   ├── config/         # Configuration
│   │   ├── models/         # Database models (sqlx::FromRow)
│   │   ├── handlers/       # Route handlers
│   │   ├── dto/            # Request/response DTOs
│   │   ├── services/       # Business logic (Clerk, etc.)
│   │   ├── guards/         # Auth & request guards
│   │   ├── middleware/     # Rate limiting
│   │   ├── errors/         # RFC 7807 error handling
│   │   └── openapi.rs      # Swagger/OpenAPI config
│   ├── migrations/         # SQL migrations
│   └── scripts/            # Dev init & seed data
├── admin/                  # React Admin Dashboard
│   └── src/
│       ├── components/     # MUI-based UI components
│       ├── services/       # API client (axios)
│       ├── types/          # TypeScript types (mirrors backend DTOs)
│       └── i18n/           # Internationalization
├── templates/              # Frontend templates
│   └── astro-blog/         # Astro-based blog/portfolio site
└── docs/                   # Documentation (deploy guides, etc.)
```

## Available Services

| Service         | URL                            | Description          |
|-----------------|--------------------------------|----------------------|
| Backend API     | http://localhost:8000          | Rust Rocket REST API |
| Swagger UI      | http://localhost:8000/api-docs | Interactive API docs |
| Admin Dashboard | http://localhost:5173          | React admin UI       |
| PostgreSQL      | localhost:5432                 | Database             |
| pgAdmin         | http://localhost:5050          | Database management  |
| Redis           | localhost:6379                 | Rate limiting cache  |

## API Overview

All content endpoints are under `/api/v1` and scoped to a site:

| Resource   | Endpoint                                           |
|------------|----------------------------------------------------|
| Sites      | `GET/POST /api/v1/sites`                           |
| Blogs      | `GET/POST /api/v1/sites/{site_id}/blogs`           |
| Pages      | `GET/POST /api/v1/sites/{site_id}/pages`           |
| CV Entries | `GET/POST /api/v1/sites/{site_id}/cv-entries`      |
| Navigation | `GET/POST /api/v1/sites/{site_id}/navigation`      |
| Media      | `GET/POST /api/v1/sites/{site_id}/media`           |
| Legal      | `GET/POST /api/v1/sites/{site_id}/legal-documents` |
| Taxonomy   | `GET/POST /api/v1/sites/{site_id}/tags`            |
| Webhooks   | `GET/POST /api/v1/sites/{site_id}/webhooks`        |
| Documents  | `GET/POST /api/v1/sites/{site_id}/documents`       |
| Audit Logs | `GET /api/v1/sites/{site_id}/audit-logs`           |

Authentication is via `X-API-Key` header or `Authorization: Bearer <Clerk JWT>`.

Full API documentation is available at `/api-docs` when the backend is running.

## Storage

OpenYapper supports **local filesystem** (default) and **S3-compatible object storage** for media uploads. Local storage works out of the box for development; for production, configure S3 via environment variables.

See [`backend/README.md`](backend/README.md) for storage configuration details and environment variables.

## Webhooks

OpenYapper can notify external services when content changes via webhooks. Webhooks are configured per-site in the admin dashboard under **Site > Webhooks**.

- Subscribe to specific events (`blog.created`, `page.updated`, `document.deleted`, etc.) or all events
- Payloads are signed with **HMAC-SHA256** (`X-Webhook-Signature` header)
- Deliveries are retried up to 3 times with exponential backoff
- All delivery attempts are logged and viewable in the admin UI

See [`backend/README.md`](backend/README.md) for payload format and security details.

## HTTPS / TLS

The backend supports HTTPS natively via Rocket's built-in TLS (rustls). Set two environment variables to enable:

```env
TLS_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
TLS_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

When both are set, the server starts with HTTPS. When unset (the default), the server runs plain HTTP. Works with Let's Encrypt, self-signed, or commercially purchased PEM certificates.

## Documentation

Full documentation is available at **[dominikdorfstetter.github.io/openyapper](https://dominikdorfstetter.github.io/openyapper/)**.

The docs cover getting started, architecture, API reference, admin guide, deployment, and developer guides. To run the docs locally:

```bash
cd docs && npm install && npm start
```

## Deploy

Deploy OpenYapper to a cloud platform with managed Postgres and Redis:

- **[Railway](docs/docs/deployment/railway.md)** &mdash; auto-detects Dockerfile, managed addons, free tier available

## Development

```bash
# Backend
cd backend && cargo run            # Start API server
cd backend && cargo test           # Run tests
cd backend && cargo fmt            # Format code
cd backend && cargo clippy         # Lint

# Admin
cd admin && npm run dev            # Start dev server
cd admin && npm run build          # Production build
cd admin && npm run typecheck      # Type check
```

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Ensure `cargo fmt`, `cargo clippy`, and `cargo test` pass for backend changes
4. Ensure `npm run typecheck` and `npm run lint` pass for admin changes
5. Submit a pull request
