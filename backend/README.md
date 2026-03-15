# Forja API

Multi-site CMS REST API built with Rust and Rocket.

> Full documentation: **[forja-docs.dorfstetter.at](https://forja-docs.dorfstetter.at)**

## Tech Stack

- **Framework**: [Rocket](https://rocket.rs/) 0.5
- **Database**: PostgreSQL 16 with [SQLx](https://github.com/launchbadge/sqlx)
- **Cache / Rate Limiting**: [Redis](https://redis.io/) 7
- **Async Runtime**: Tokio
- **Documentation**: Utoipa (OpenAPI / Swagger UI)
- **Toolchain**: Rust 1.93+

## Features

- Multi-site/tenant architecture
- Content versioning and history
- Internationalization (i18n) support
- Media library with variants (local and S3 storage)
- AI content generation (configurable LLM providers)
- ActivityPub federation (Fediverse syndication, followers, comments, blocklists)
- Privacy-first analytics
- Audit logging
- Webhooks with HMAC-SHA256 signing and retry logic
- Rate limiting (per API key and per IP)
- Dual authentication (API key and Clerk JWT)
- OpenAPI documentation

## Getting Started

### Prerequisites

- Rust 1.93+ (install via [rustup](https://rustup.rs/))
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

## Authentication

Forja supports dual authentication. Every protected endpoint accepts either method.

- **API Key**: `X-API-Key` header with permission levels Master > Admin > Write > Read
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

## Project Structure

```
backend/
├── src/
│   ├── main.rs          # Entry point
│   ├── config/          # Configuration
│   ├── models/          # Database models
│   ├── handlers/        # Route handlers
│   ├── services/        # Business logic
│   ├── guards/          # Auth & request guards
│   ├── middleware/       # Rate limiting
│   ├── dto/             # Request/response DTOs
│   ├── errors/          # Error handling
│   └── openapi.rs       # Swagger config
├── migrations/          # SQL migrations
├── scripts/             # Dev seed scripts
└── .env.example         # Environment template
```

See the [Architecture overview](https://forja-docs.dorfstetter.at/architecture/overview) and [API reference](https://forja-docs.dorfstetter.at/api/overview) for detailed documentation.

## License

AGPL-3.0-or-later
