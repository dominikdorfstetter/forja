---
sidebar_position: 4
---

# Configuration

Forja is configured through environment variables defined in `backend/.env`. This page covers the handful of variables you need for local development. The complete, canonical reference of **every** supported variable lives at [Deployment → Environment Variables](../deployment/environment-variables.md).

## Quick Start

Copy the example file and edit it:

```bash
cd backend
cp .env.example .env
```

The defaults are tuned for local development with the Docker Compose stack. For production deployments, work through the [Environment Variables reference](../deployment/environment-variables.md) instead — several variables are required in production that development silently defaults.

## Core Variables for Local Development

| Variable | Default | Description |
|----------|---------|-------------|
| `APP__ENVIRONMENT` | `development` | Runtime environment. Set to `production` for production deployments — this enables the production boot guards. |
| `APP__HOST` | `0.0.0.0` | IP address the server binds to. |
| `APP__PORT` | `8000` | Port the API server listens on. |
| `APP__LOG_LEVEL` | `info` | Log verbosity. One of: `trace`, `debug`, `info`, `warn`, `error`. Bump to `debug` while developing if you want more detail. |
| `DATABASE_URL` | `postgres://forja:forja@localhost:5432/forja` | PostgreSQL connection string. Matches the Docker Compose dev stack out of the box. |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis connection URL, used for rate limiting and caching. |
| `CORS_ALLOWED_ORIGINS` | (empty) | Comma-separated list of allowed origins. Empty means deny all cross-origin browser calls — add your local dev servers (see example below). |

### Redis and rate limiting behavior

Rate limiting fails **closed** by default (`RATE_LIMIT_FAIL_MODE=closed`): if Redis is unavailable, rate-limited requests are rejected rather than silently unthrottled. In `APP__ENVIRONMENT=production`, the boot guard goes further and **refuses to start** when Redis is unreachable and the mode is `closed`. Development and other non-production environments boot with a warning so local work without Redis stays possible. See the [Redis & Rate Limiting reference](../deployment/environment-variables.md#redis--rate-limiting) for the full behavior, including `TRUST_PROXY_HEADERS` when running behind a reverse proxy.

## Clerk Authentication (optional for local dev)

[Clerk](https://clerk.com) provides user authentication for the admin dashboard. For local development you only need the two keys; API-key-only usage needs neither.

```env
CLERK_SECRET_KEY=sk_test_abc123...
CLERK_PUBLISHABLE_KEY=pk_test_xyz789...
SYSTEM_ADMIN_CLERK_IDS=user_2abc123
```

:::info
The backend supports dual authentication. Every API request can be authenticated with either:
- **API Key:** `X-API-Key: dk_...` header
- **Clerk JWT:** `Authorization: Bearer <token>` header

In production, Clerk additionally requires `CLERK_EXPECTED_AUDIENCE` and `CLERK_EXPECTED_ISSUER` — see the [Clerk reference](../deployment/environment-variables.md#authentication----clerk).
:::

## Admin Frontend Variables

The admin dashboard (Vite) uses its own environment variables, prefixed with `VITE_`:

| Variable | Description |
|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key for the React frontend. Same value as `CLERK_PUBLISHABLE_KEY`. |
| `VITE_API_BASE_URL` | Backend API base URL. Defaults to `/api/v1` (proxied by Vite in development). |

Create an `.env` file in the `admin/` directory if you need to override these values:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xyz789...
```

## Full Example

A complete `backend/.env` suitable for local development:

```env
# Application
APP__ENVIRONMENT=development
APP__HOST=0.0.0.0
APP__PORT=8000
APP__LOG_LEVEL=info

# Database
DATABASE_URL=postgres://forja:forja@localhost:5432/forja

# Redis & Rate Limiting
REDIS_URL=redis://127.0.0.1:6379

# CORS — comma-separated list of allowed origins (deny-all when empty)
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8080

# Clerk (uncomment and fill in your values)
# CLERK_SECRET_KEY=sk_test_...
# CLERK_PUBLISHABLE_KEY=pk_test_...
# SYSTEM_ADMIN_CLERK_IDS=user_...

# Storage (local filesystem is the default)
STORAGE_PROVIDER=local
```

## Complete Reference

Everything else — S3 storage, encryption keys, security tuning, preview templates, webhooks, TLS, imprint, demo mode, and the production-required variables — is documented in one place:

**→ [Deployment → Environment Variables](../deployment/environment-variables.md)** (canonical reference)

## Next Steps

- [Architecture Overview](../architecture/overview) -- understand how the backend, admin, and frontend fit together.
- [API Reference](../api/overview) -- explore the REST API.
- [Admin Guide](../admin-guide/overview) -- manage content through the dashboard.
