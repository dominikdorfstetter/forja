---
sidebar_position: 1
---

# Docker Deployment

OpenYapper ships with a multi-stage Dockerfile that builds both the React admin dashboard and the Rust backend into a single, minimal production image.

## Docker Hub

Pre-built images are published to [Docker Hub](https://hub.docker.com/r/dominikdorfstetter/openyapper) on every push to `main`. Multi-platform images are available for `linux/amd64` and `linux/arm64`.

```bash
docker pull dominikdorfstetter/openyapper
```

Images are tagged with:
- `latest` &mdash; the most recent build from `main`
- Git SHA (e.g. `bf3df6d`) &mdash; for pinning to a specific commit

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 20.10 or later
- [Docker Compose](https://docs.docker.com/compose/install/) v2 (included with Docker Desktop)

## Multi-Stage Build Overview

The Dockerfile uses three stages to keep the final image small:

| Stage | Base Image | Purpose |
|-------|-----------|---------|
| **admin-build** | `node:20-alpine` | Installs npm dependencies and builds the React admin dashboard |
| **backend-build** | `rust:1.93-bookworm` | Compiles the Rust backend in release mode, embedding the admin static files |
| **runtime** | `debian:bookworm-slim` | Minimal runtime with only `ca-certificates`, `libssl3`, and `libpq5` |

The final image contains a single binary (`openyapper`), the compiled admin dashboard static files, and the SQLx migration files.

## Building the Image

From the repository root:

```bash
docker build -t openyapper .
```

The first build takes approximately 10-15 minutes due to Rust compilation. Subsequent builds benefit from Docker layer caching.

### Build Optimizations

The Dockerfile sets two environment variables to reduce memory usage during Rust compilation:

```dockerfile
ENV CARGO_PROFILE_RELEASE_LTO=thin
ENV CARGO_PROFILE_RELEASE_CODEGEN_UNITS=2
```

These settings prevent out-of-memory errors on machines with limited RAM (e.g., 2 GB CI runners or cloud build environments).

## Running with Docker Compose

For production deployments, create a `docker-compose.yaml` that includes the application, PostgreSQL, and Redis:

```yaml
services:
  app:
    image: dominikdorfstetter/openyapper
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgres://openyapper:changeme@postgres:5432/openyapper
      REDIS_URL: redis://redis:6379
      APP__ENVIRONMENT: production
      APP__HOST: 0.0.0.0
      APP__PORT: "8000"
      ROCKET_ADDRESS: 0.0.0.0
      ROCKET_PORT: "8000"
      ROCKET_LOG_LEVEL: normal
      APP__CORS_ORIGINS: "https://yourdomain.com"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: openyapper
      POSTGRES_PASSWORD: changeme
      POSTGRES_DB: openyapper
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backend/scripts/init-extensions.sql:/docker-entrypoint-initdb.d/init-extensions.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U openyapper -d openyapper"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

Start the stack:

```bash
docker compose up -d
```

### Database Extensions

The `init-extensions.sql` script (mounted into the Postgres container) automatically creates the required PostgreSQL extensions on first run:

- `uuid-ossp` -- UUID generation
- `citext` -- case-insensitive text type
- `pg_trgm` -- trigram matching for search

If you are using a managed PostgreSQL service that does not run Docker entrypoint scripts, you must create these extensions manually. See the [Railway guide](./railway) for an example.

## Production Environment Variables

At minimum, set the following variables for a production deployment:

| Variable | Value | Description |
|----------|-------|-------------|
| `DATABASE_URL` | `postgres://user:pass@host:5432/db` | PostgreSQL connection string |
| `REDIS_URL` | `redis://host:6379` | Redis connection string |
| `APP__ENVIRONMENT` | `production` | Enables production behavior |
| `APP__HOST` | `0.0.0.0` | Bind to all interfaces |
| `APP__PORT` | `8000` | Application port |
| `ROCKET_ADDRESS` | `0.0.0.0` | Rocket framework bind address |
| `ROCKET_PORT` | `8000` | Rocket framework port |
| `APP__CORS_ORIGINS` | `https://yourdomain.com` | Allowed CORS origins (comma-separated) |

For the full list of environment variables, see [Environment Variables](./environment-variables).

## Health Checks

The application exposes a health endpoint at `/health` that returns the status of PostgreSQL and Redis connections:

```bash
curl http://localhost:8000/health
```

```json
{
  "status": "healthy",
  "postgres": "connected",
  "redis": "connected"
}
```

Use this endpoint in your Docker health check or load balancer configuration:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 30s
```

## Verifying the Deployment

After starting the container, verify the following endpoints:

| URL | Expected Result |
|-----|----------------|
| `http://localhost:8000/health` | JSON health status |
| `http://localhost:8000/api-docs` | Swagger UI |
| `http://localhost:8000/dashboard` | Admin dashboard |

## Migrations

SQLx database migrations run automatically when the application starts. The migration files are bundled into the Docker image from `backend/migrations/`. No manual migration step is required.

## Updating

To update a running deployment using the Docker Hub image:

```bash
docker pull dominikdorfstetter/openyapper
docker compose up -d
```

Or if building from source:

```bash
git pull
docker build -t openyapper .
docker compose up -d
```

Migrations are applied automatically on startup, so schema changes are handled without manual intervention.
