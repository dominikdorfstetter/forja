# Forja API

Multi-site CMS REST API built with Rust and Axum.

> Full documentation: **[forja-docs.dorfstetter.at](https://forja-docs.dorfstetter.at)**

## Tech Stack

- **Framework**: [Axum](https://github.com/tokio-rs/axum) 0.8 (on `axum-server` with `rustls`)
- **Database**: PostgreSQL 16 with [SQLx](https://github.com/launchbadge/sqlx)
- **Cache / Rate Limiting**: [Redis](https://redis.io/) 7
- **Async Runtime**: Tokio
- **Documentation**: Utoipa (OpenAPI / Swagger UI)
- **Toolchain**: Rust 1.97 (pinned via `rust-toolchain.toml`), edition 2024

## Features

- Multi-site/tenant architecture
- Content versioning and history (including legal document versions)
- Portfolio management (CV entries, skills, and projects)
- Internationalization (i18n) support
- Media library with variants (local and S3 storage)
- AI content generation (configurable LLM providers)
- Privacy-first analytics
- Audit logging
- Webhooks with HMAC-SHA256 signing, retry logic, debounce, and delivery analytics
- Rate limiting (per API key and per IP)
- Dual authentication (API key and Clerk JWT)
- OpenAPI documentation

## Getting Started

### Prerequisites

- Rust 1.97 (install via [rustup](https://rustup.rs/) — the version is pinned via `rust-toolchain.toml`, edition 2024)
- PostgreSQL 16+
- Redis 7+
- SQLx CLI: `cargo install sqlx-cli`
- Docker (recommended for running Postgres and Redis locally)

### Setup

1. **Start infrastructure** (from repo root):
   ```bash
   docker compose -f docker-compose.dev.yaml up -d
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your Clerk keys and other settings
   ```

3. **Run migrations and start**:
   ```bash
   sqlx migrate run
   ./scripts/dev_init.sh   # Optional: seed sample data
   cargo run
   ```

API: `http://localhost:8000` · Swagger UI: `http://localhost:8000/api-docs`

See the [Getting Started guide](https://forja-docs.dorfstetter.at/getting-started) for full setup instructions.

## Environment Variables

[`.env.example`](.env.example) is the complete reference for all supported variables. `DATABASE_URL` is the only strictly required one. Production additionally requires `DOCUMENT_ENCRYPTION_KEY` — plus `ENCRYPTION_KEY` if AI features are used, `CLERK_EXPECTED_AUDIENCE`/`CLERK_EXPECTED_ISSUER` if Clerk is enabled, and `REDIS_URL` when `RATE_LIMIT_FAIL_MODE=closed`.

See the [environment variables reference](https://forja-docs.dorfstetter.at/docs/deployment/environment-variables) for full documentation.

## Authentication

Forja supports dual authentication. Every protected endpoint accepts either method.

- **API Key**: `X-API-Key` header with permission levels Master > Admin > Write > Read (maps to site roles Owner > Admin > Editor > Viewer)
- **Clerk JWT**: `Authorization: Bearer <token>` for browser sessions

See the [Authentication guide](https://forja-docs.dorfstetter.at/architecture/authentication) for details.

## Development

```bash
cargo run              # Start API server
cargo test             # Run tests
cargo fmt              # Format code
cargo clippy           # Lint
sqlx migrate run       # Run migrations
sqlx migrate add NAME  # Create new migration
cargo sqlx prepare     # Prepare offline mode for CI
```

### Running tests

Integration tests under `tests/` need a live PostgreSQL 16+ instance (a migration uses `NULLS NOT DISTINCT`, which fails on PG14), reachable via `TEST_DATABASE_URL` (default: `postgres://forja:forja@localhost:5432/forja_test`). The `postgres:16` container from `docker-compose.dev.yaml` works.

## Project Structure

```
backend/
├── src/
│   ├── main.rs          # tokio::main → boot guards → axum::serve / bind_rustls
│   ├── lib.rs           # Library re-exports
│   ├── axum_app/
│   │   ├── mod.rs       # Router assembly + AxumApiDoc
│   │   ├── handlers/    # Route handlers (#[utoipa::path] + OpenApiRouter)
│   │   ├── middleware/  # Tower layers (CORS, security headers, rate-limit, …)
│   │   ├── extractors.rs # FromRequestParts impls (auth, ModuleGuard, CurrentSite)
│   │   ├── openapi_split.rs # Splits the doc into consumer + admin
│   │   └── workers.rs   # Background-worker spawn aggregator
│   ├── config/          # Configuration + boot guards
│   ├── models/          # Database models (sqlx::FromRow + business logic)
│   ├── repos/           # Repository layer — data-access abstractions over SQLx
│   ├── services/        # External integrations (S3, Clerk, AI, workers)
│   ├── guards/          # Auth-key types + ModuleGuard markers
│   ├── middleware/      # Cross-stack helpers (rate-limit atomics, CORS resolution, …)
│   ├── dto/             # Request/response DTOs (Validate + ToSchema)
│   └── errors/          # ApiError + RFC 7807 ProblemDetails
├── migrations/          # SQL migrations
├── scripts/             # Dev seed scripts
└── .env.example         # Environment template
```

See the [Architecture overview](https://forja-docs.dorfstetter.at/architecture/overview) and [API reference](https://forja-docs.dorfstetter.at/api/overview) for detailed documentation.

## License

AGPL-3.0-or-later
