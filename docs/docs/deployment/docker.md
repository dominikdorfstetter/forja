---
sidebar_position: 1
---

# Docker Deployment

Forja ships with a multi-stage Dockerfile that builds both the React admin dashboard and the Rust backend into a single, minimal production image.

## Quick Start

The fastest way to run Forja in production:

```bash
# 1. Generate a .env with secure random secrets
./scripts/forja-init.sh

# 2. Start everything
docker compose -f docker-compose.prod.yml up -d
```

This starts PostgreSQL, Redis, and Forja with health checks, persistent volumes, and auto-configured database extensions. No source code checkout required beyond the compose file and init script.

## Docker Hub

Pre-built images are published to [Docker Hub](https://hub.docker.com/r/dominikdorfstetter/forja) on every push to `main`. Multi-platform images are available for `linux/amd64` and `linux/arm64`.

```bash
docker pull dominikdorfstetter/forja
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

The final image contains a single binary (`forja`), the compiled admin dashboard static files, and the SQLx migration files.

## Building the Image

From the repository root:

```bash
docker build -t forja .
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

### Production Compose (recommended)

The repository includes `docker-compose.prod.yml`, a standalone compose file that uses the pre-built Docker Hub image. It does not require the source code -- just the compose file and a `.env`:

```bash
# Generate .env with secure random secrets
./scripts/forja-init.sh

# Start all services
docker compose -f docker-compose.prod.yml up -d
```

The production compose auto-constructs `DATABASE_URL` from the PostgreSQL credentials in your `.env`, so you only need to set `POSTGRES_PASSWORD` once.

### Source Build Compose

If you prefer to build from source, the default `docker-compose.yml` builds the image locally:

```bash
# Set POSTGRES_PASSWORD in .env or export it
docker compose up -d
```

### Database Extensions

The required PostgreSQL extensions are created automatically on first container start:

- `uuid-ossp` -- UUID generation
- `citext` -- case-insensitive text type
- `pg_trgm` -- trigram matching for search

The production compose embeds the extension SQL inline using Docker Compose `configs`. The source build compose mounts `backend/scripts/init-extensions.sql` instead.

If you are using a managed PostgreSQL service, you must create these extensions manually. See the [Railway guide](./railway) for an example.

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
docker pull dominikdorfstetter/forja
docker compose up -d
```

Or if building from source:

```bash
git pull
docker build -t forja .
docker compose up -d
```

Migrations are applied automatically on startup, so schema changes are handled without manual intervention.

## Backup and Restore

### Database Backup

Create a PostgreSQL dump while the stack is running:

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U forja -d forja --format=custom -f /tmp/forja.dump

docker compose -f docker-compose.prod.yml cp postgres:/tmp/forja.dump ./forja-backup.dump
```

### Database Restore

Restore from a backup file:

```bash
docker compose -f docker-compose.prod.yml cp ./forja-backup.dump postgres:/tmp/forja.dump

docker compose -f docker-compose.prod.yml exec postgres \
  pg_restore -U forja -d forja --clean --if-exists /tmp/forja.dump
```

### Upload Files Backup

The `uploads` volume stores media files. Back it up with:

```bash
docker run --rm \
  -v forja_uploads:/data \
  -v "$(pwd)":/backup \
  alpine tar czf /backup/forja-uploads.tar.gz -C /data .
```

Restore:

```bash
docker run --rm \
  -v forja_uploads:/data \
  -v "$(pwd)":/backup \
  alpine sh -c "cd /data && tar xzf /backup/forja-uploads.tar.gz"
```

### Automated Backups

For scheduled backups, add a cron job on the host:

```bash
# Daily database backup at 2:00 AM, keep last 7 days
0 2 * * * cd /path/to/forja && docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U forja -d forja --format=custom > backups/forja-$(date +\%Y\%m\%d).dump && find backups/ -name "forja-*.dump" -mtime +7 -delete
```
