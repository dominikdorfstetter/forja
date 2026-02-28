---
sidebar_position: 3
---

# Environment Variables

Complete reference of all environment variables used by OpenYapper. Variables are grouped by category.

## Core Application

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `APP__ENVIRONMENT` | `development` | Yes (production) | Set to `production` for production deployments |
| `APP__HOST` | `127.0.0.1` | Yes (production) | Bind address. Use `0.0.0.0` in containers. |
| `APP__PORT` | `8000` | No | Application port |

## Rocket Framework

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `ROCKET_ADDRESS` | `127.0.0.1` | Yes (production) | Rocket bind address. Use `0.0.0.0` in containers. |
| `ROCKET_PORT` | `8000` | No | Rocket listen port |
| `ROCKET_LOG_LEVEL` | `normal` | No | Log level: `off`, `critical`, `normal`, `debug` |
| `PORT` | -- | No | Some platforms (Railway) use this to detect the listening port |

## Database (PostgreSQL)

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | -- | **Yes** | PostgreSQL connection string, e.g., `postgres://user:pass@host:5432/dbname` |
| `APP__DATABASE__MAX_CONNECTIONS` | `10` | No | Maximum number of connections in the pool |
| `APP__DATABASE__MIN_CONNECTIONS` | `1` | No | Minimum number of connections in the pool |

## Redis

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `REDIS_URL` | -- | **Yes** | Redis connection string, e.g., `redis://host:6379` |

## CORS

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `APP__CORS_ORIGINS` | `*` | No | Comma-separated list of allowed origins. Use specific origins in production. |

## Authentication -- Clerk

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `CLERK_SECRET_KEY` | -- | No | Clerk secret key (`sk_live_...` or `sk_test_...`) |
| `CLERK_PUBLISHABLE_KEY` | -- | No | Clerk publishable key (`pk_live_...` or `pk_test_...`) |
| `CLERK_JWKS_URL` | -- | No | Clerk JWKS endpoint URL. Auto-derived from secret key if not set. |
| `SYSTEM_ADMIN_CLERK_IDS` | -- | No | Comma-separated Clerk user IDs that receive Master permissions |

## Storage

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `STORAGE_PROVIDER` | `local` | No | Storage backend: `local` or `s3` |
| `STORAGE_S3_BUCKET` | -- | If S3 | S3 bucket name |
| `STORAGE_S3_REGION` | -- | If S3 | AWS region (e.g., `us-east-1`) |
| `STORAGE_S3_PREFIX` | -- | No | Key prefix for all uploads (e.g., `media/`) |
| `STORAGE_S3_ENDPOINT` | -- | No | Custom S3 endpoint for non-AWS providers (MinIO, R2, Spaces) |
| `AWS_ACCESS_KEY_ID` | -- | If S3 | AWS access key (standard SDK chain) |
| `AWS_SECRET_ACCESS_KEY` | -- | If S3 | AWS secret key (standard SDK chain) |

## TLS

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `TLS_CERT_PATH` | -- | No | Path to TLS certificate file (PEM format) |
| `TLS_KEY_PATH` | -- | No | Path to TLS private key file (PEM format) |

:::tip
If you deploy behind a reverse proxy or a platform like Railway that handles TLS termination at the edge, you do not need to set these variables.
:::

## Test Database

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `TEST_DATABASE_URL` | -- | For integration tests | PostgreSQL connection string for the test database |

## Admin Dashboard (Vite Build)

These variables are used at build time when compiling the React admin dashboard.

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | -- | No | Clerk publishable key for the admin SPA |

## Frontend Templates

These variables are used by frontend templates (e.g., the Astro blog template) to connect to the backend API.

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `CMS_API_URL` | -- | Yes (for templates) | Backend API base URL, e.g., `http://localhost:8000/api/v1` |
| `CMS_API_KEY` | -- | Yes (for templates) | API key with at least Read permission |
| `CMS_SITE_ID` | -- | Yes (for templates) | UUID of the site to display |

## Example `.env` File

```bash
# Core
APP__ENVIRONMENT=development
APP__HOST=127.0.0.1
APP__PORT=8000

# Database
DATABASE_URL=postgres://openyapper:openyapper@localhost:5432/openyapper

# Redis
REDIS_URL=redis://localhost:6379

# CORS (development)
APP__CORS_ORIGINS=*

# Rocket
ROCKET_ADDRESS=127.0.0.1
ROCKET_PORT=8000
ROCKET_LOG_LEVEL=normal

# Clerk (optional)
# CLERK_SECRET_KEY=sk_test_...
# CLERK_PUBLISHABLE_KEY=pk_test_...
# SYSTEM_ADMIN_CLERK_IDS=user_...

# Storage (default: local)
# STORAGE_PROVIDER=s3
# STORAGE_S3_BUCKET=my-bucket
# STORAGE_S3_REGION=us-east-1

# TLS (optional, not needed behind a reverse proxy)
# TLS_CERT_PATH=/path/to/cert.pem
# TLS_KEY_PATH=/path/to/key.pem
```
