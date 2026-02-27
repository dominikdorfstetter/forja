# OpenYapper API

Multi-site CMS REST API built with Rust and Rocket.

## Features

- Multi-site/tenant architecture
- Content versioning and history
- Internationalization (i18n) support
- Media library with variants
- Audit logging
- Rate limiting (per API key and per IP)
- Dual authentication (API key and Clerk JWT)
- OpenAPI documentation

## Tech Stack

- **Framework**: [Rocket](https://rocket.rs/) v0.5
- **Database**: PostgreSQL 16 with [SQLx](https://github.com/launchbadge/sqlx)
- **Cache / Rate Limiting**: [Redis](https://redis.io/) 7
- **Async Runtime**: Tokio
- **Serialization**: Serde
- **Validation**: Validator
- **Documentation**: Utoipa (OpenAPI)

## Project Structure

```
backend/
├── src/
│   ├── main.rs              # Application entry point
│   ├── lib.rs               # Library exports
│   ├── config/              # Configuration management
│   ├── models/              # Database models
│   ├── handlers/            # Route handlers (controllers)
│   ├── services/            # Business logic
│   ├── middleware/          # Request/response middleware
│   ├── guards/              # Rocket request guards
│   ├── dto/                 # Data transfer objects
│   ├── utils/               # Utility functions
│   └── errors/              # Error types and handling
├── migrations/              # SQLx migrations
├── scripts/                 # Development helper scripts
├── tests/                   # Integration tests
├── Cargo.toml               # Dependencies
└── .env.example             # Environment template
```

## Getting Started

### Prerequisites

- Rust 1.75+ (install via [rustup](https://rustup.rs/))
- PostgreSQL 16+
- Redis 7+
- SQLx CLI: `cargo install sqlx-cli`
- Docker (recommended for running Postgres and Redis locally)

### Setup

1. **Start PostgreSQL and Redis** (via Docker Compose from repo root):
   ```bash
   docker compose -f ../docker-compose.dev.yaml up -d
   ```
   This starts PostgreSQL on `localhost:5432`, Redis on `localhost:6379`, and pgAdmin on `http://localhost:5050`. Extensions are created automatically on first start.

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Run migrations**:
   ```bash
   sqlx migrate run
   ```

4. **Seed development data** (optional but recommended):
   ```bash
   # Seed 2 sample sites, blog posts, pages, CV entries, navigation, and more
   ./scripts/dev_init.sh
   ```

   This creates three dev API keys with different permission levels:

   | Key | Permission |
   |-----|-----------|
   | `dk_devmast_00000000000000000000000000000000` | Master |
   | `dk_devwrit_00000000000000000000000000000000` | Write |
   | `dk_devread_00000000000000000000000000000000` | Read |

5. **Start the server**:
   ```bash
   cargo run
   ```

The API will be available at `http://localhost:8000`.

### Admin Dashboard

The React-based admin dashboard can be built and served directly from the backend:

```bash
# Build admin dashboard into backend/static/dashboard/
cd ../admin && npm run build

# Then visit http://localhost:8000/dashboard
```

## Authentication

OpenYapper supports dual authentication mechanisms. Every protected endpoint accepts either method.

### API Key Authentication

Pass the key in the `X-API-Key` header:

```
X-API-Key: dk_devmast_00000000000000000000000000000000
```

API keys have one of four permission levels (highest to lowest): **Master > Admin > Write > Read**. Keys are managed through the admin dashboard or directly via the API.

### Clerk JWT Authentication

For browser-based sessions, the backend validates Clerk-issued JWTs:

```
Authorization: Bearer <Clerk JWT>
```

The Clerk role claim is mapped to the corresponding `ApiKeyPermission` level, and the Clerk `sub` claim is converted to a deterministic UUID v5 for internal user identification.

#### Clerk Environment Variables

| Variable | Description |
|----------|-------------|
| `CLERK_SECRET_KEY` | Clerk secret key for JWT verification and management API calls |
| `CLERK_PUBLISHABLE_KEY` | Served to the admin UI via `GET /api/v1/config` |
| `SYSTEM_ADMIN_CLERK_IDS` | Comma-separated Clerk user IDs granted system admin privileges |

The backend fetches Clerk's JWKS for JWT validation and caches it for 15 minutes.

## Rate Limiting

The API enforces rate limits at two levels, backed by Redis:

- **Per-API-key limits**: Configurable per key through the admin dashboard.
- **Per-IP limits**: Default thresholds of 50 requests/second and 500 requests/minute.

Loopback addresses (`127.0.0.1`, `::1`) are exempt from IP-based rate limits to avoid throttling local development and health checks.

When a rate limit is exceeded the API returns `429 Too Many Requests` with a `Retry-After` header.

## Development

### Running Tests

```bash
cargo test
```

### Code Formatting

```bash
cargo fmt
```

### Linting

```bash
cargo clippy
```

### Database Migrations

Create a new migration:
```bash
sqlx migrate add <migration_name>
```

Run migrations:
```bash
sqlx migrate run
```

Revert last migration:
```bash
sqlx migrate revert
```

### SQLx Offline Mode

For CI/CD without database access:
```bash
cargo sqlx prepare
```

## API Endpoints

### Health Check

```
GET /health
```

### Configuration (public)

```
GET /api/v1/config
```

Returns the Clerk publishable key and other public configuration for the admin UI.

### Sites

```
GET    /api/v1/sites
GET    /api/v1/sites/{id}
POST   /api/v1/sites
PUT    /api/v1/sites/{id}
DELETE /api/v1/sites/{id}
```

### Site-Scoped Resources

All content endpoints are scoped to a site:
```
GET    /api/v1/sites/{site_id}/blogs
GET    /api/v1/sites/{site_id}/pages
GET    /api/v1/sites/{site_id}/cv-entries
...
```

### Query Parameters

| Parameter       | Description                       |
|-----------------|-----------------------------------|
| `page`          | Page number (default: 1)          |
| `page_size`     | Items per page (default: 10)      |
| `locale`        | Filter by locale code             |
| `status`        | Filter by content status          |
| `search`        | Full-text search                  |
| `sort`          | Sort field:direction              |
| `include`       | Eager load relations              |
| `include_global`| Include shared content            |

## Storage

OpenYapper supports two storage backends for media uploads: **local filesystem** (default) and **S3-compatible object storage**.

### Local Storage (default)

Files are stored on disk and served directly by Rocket. No extra configuration is needed for development.

By default, uploads are written to `./uploads` **relative to the working directory where the backend process starts** (typically the `backend/` directory). The directory is created automatically on startup if it does not exist.

To use a different location (e.g. a dedicated volume or an absolute path), set `STORAGE_LOCAL_UPLOAD_DIR`:

| Variable                   | Description                           | Default      |
|----------------------------|---------------------------------------|--------------|
| `STORAGE_PROVIDER`         | Storage backend (`local` or `s3`)     | `local`      |
| `STORAGE_LOCAL_UPLOAD_DIR` | Absolute or relative path for uploaded files | `./uploads`  |
| `STORAGE_LOCAL_BASE_URL`   | URL prefix for serving uploaded files | `/uploads`   |

```env
# Defaults (relative to cwd) -- works out of the box for development
STORAGE_PROVIDER=local
STORAGE_LOCAL_UPLOAD_DIR=./uploads
STORAGE_LOCAL_BASE_URL=/uploads

# Production example: dedicated volume with absolute path
STORAGE_LOCAL_UPLOAD_DIR=/var/lib/openyapper/uploads
STORAGE_LOCAL_BASE_URL=/uploads
```

`STORAGE_LOCAL_BASE_URL` controls the URL path at which Rocket serves the files. It must match the mount point -- changing it also changes the public URLs returned by the API.

### S3 Storage

For production or when you need shared storage across multiple instances, use S3 or any S3-compatible service (AWS S3, MinIO, DigitalOcean Spaces, etc.).

| Variable              | Description                                 | Default       |
|-----------------------|---------------------------------------------|---------------|
| `STORAGE_PROVIDER`    | Set to `s3`                                 | `local`       |
| `STORAGE_S3_BUCKET`   | S3 bucket name                              | required      |
| `STORAGE_S3_REGION`   | AWS region                                  | `us-east-1`   |
| `STORAGE_S3_PREFIX`   | Key prefix for all objects (e.g. `media/`)  | none          |
| `STORAGE_S3_ENDPOINT` | Custom endpoint URL (for MinIO, etc.)       | none (AWS)    |

```env
# AWS S3
STORAGE_PROVIDER=s3
STORAGE_S3_BUCKET=my-cms-media
STORAGE_S3_REGION=eu-central-1

# MinIO (self-hosted S3-compatible)
STORAGE_PROVIDER=s3
STORAGE_S3_BUCKET=openyapper
STORAGE_S3_REGION=us-east-1
STORAGE_S3_ENDPOINT=http://localhost:9000
```

AWS credentials are read from the standard AWS SDK chain (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, instance profile, etc.).

### Storage Health Check

The `GET /health` endpoint includes storage backend status with provider info, latency, and (for local storage) disk usage:

```json
{
  "status": "healthy",
  "services": [ ... ],
  "storage": {
    "name": "storage (local)",
    "status": "up",
    "latency_ms": 0,
    "provider": "local",
    "total_bytes": 499963174912,
    "available_bytes": 123456789012,
    "used_percent": 75.3
  }
}
```

For S3, the response includes the bucket name instead of disk stats.

## Configuration

### Environment Variables

| Variable                    | Description                     | Default          |
|-----------------------------|---------------------------------|------------------|
| `DATABASE_URL`              | PostgreSQL connection URL       | required         |
| `REDIS_URL`                 | Redis connection URL            | `redis://127.0.0.1:6379` |
| `APP__ENVIRONMENT`          | Environment name                | development      |
| `APP__HOST`                 | Server bind address             | 0.0.0.0          |
| `APP__PORT`                 | Server port                     | 8000             |
| `APP__LOG_LEVEL`            | Log level (trace/debug/info)    | info             |
| `APP__DATABASE__MAX_CONNECTIONS` | Max DB pool connections    | 10               |
| `APP__CORS_ORIGINS`         | Allowed CORS origins            | *                |
| `CLERK_SECRET_KEY`          | Clerk secret key                | none             |
| `CLERK_PUBLISHABLE_KEY`     | Clerk publishable key           | none             |
| `SYSTEM_ADMIN_CLERK_IDS`    | Clerk user IDs for system admins| none             |

See also the [Storage](#storage) section for storage-specific variables.

### Rocket Configuration

Rocket uses `Rocket.toml` or environment variables with `ROCKET_` prefix:
```env
ROCKET_ADDRESS=0.0.0.0
ROCKET_PORT=8000
ROCKET_LOG_LEVEL=normal
```

## Architecture

### Request Flow

```
Request -> Middleware -> Guard -> Handler -> Service -> Model -> Database
                                                 |
Response <- Handler <- DTO <---------------------+
```

### Key Components

- **Guards**: Extract site context, authentication
- **Handlers**: HTTP request handlers (thin controllers)
- **Services**: Business logic layer
- **Models**: Database models and queries
- **DTOs**: Request/response data structures

### Multi-Site Resolution

Sites are resolved in order:
1. Path parameter: `/api/v1/sites/{site_id}/...`
2. Header: `X-Site-Domain: example.com`
3. Request origin domain

## Error Handling

All errors return consistent JSON responses:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "details": []
  }
}
```

### HTTP Status Codes

| Code | Meaning                    |
|------|----------------------------|
| 200  | Success                    |
| 201  | Created                    |
| 400  | Bad Request                |
| 401  | Unauthorized               |
| 403  | Forbidden                  |
| 404  | Not Found                  |
| 409  | Conflict                   |
| 422  | Validation Error           |
| 429  | Too Many Requests          |
| 500  | Internal Server Error      |

## Contributing

1. Create a feature branch
2. Write tests for new functionality
3. Ensure `cargo fmt` and `cargo clippy` pass
4. Submit a pull request

## License

MIT
