---
sidebar_position: 4
---

# Configuration

OpenYapper is configured through environment variables defined in `backend/.env`. This page documents every supported variable, its default value, and what it controls.

## Quick Start

Copy the example file and edit it:

```bash
cd backend
cp .env.example .env
```

The defaults are tuned for local development with the Docker Compose stack. For production deployments, review every variable below.

## Environment Variables Reference

### Application

General application settings that control the server behavior.

| Variable | Default | Description |
|----------|---------|-------------|
| `APP__ENVIRONMENT` | `development` | Runtime environment. Set to `production` for production deployments. Affects logging format and debug features. |
| `APP__HOST` | `0.0.0.0` | IP address the server binds to. Use `0.0.0.0` to accept connections on all interfaces. |
| `APP__PORT` | `8000` | Port the API server listens on. |
| `APP__LOG_LEVEL` | `debug` | Log verbosity. One of: `trace`, `debug`, `info`, `warn`, `error`. Use `info` or `warn` in production. |
| `APP__ENABLE_TRACING` | `true` | Enable structured tracing output (JSON-formatted logs with span context). |

### Database

PostgreSQL connection settings. The `DATABASE_URL` is the only required variable -- the pool settings have sensible defaults.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://openyapper:openyapper@localhost:5432/openyapper` | PostgreSQL connection string. Format: `postgres://user:password@host:port/database`. |
| `APP__DATABASE__MAX_CONNECTIONS` | `10` | Maximum number of connections in the SQLx connection pool. Increase for high-traffic deployments. |
| `APP__DATABASE__MIN_CONNECTIONS` | `1` | Minimum idle connections kept open in the pool. |
| `APP__DATABASE__CONNECT_TIMEOUT_SECONDS` | `30` | Maximum time (in seconds) to wait when acquiring a new connection. |
| `APP__DATABASE__IDLE_TIMEOUT_SECONDS` | `600` | Time (in seconds) before an idle connection is closed and removed from the pool. |

**Example:**

```env
DATABASE_URL=postgres://openyapper:openyapper@localhost:5432/openyapper
APP__DATABASE__MAX_CONNECTIONS=10
APP__DATABASE__MIN_CONNECTIONS=1
APP__DATABASE__CONNECT_TIMEOUT_SECONDS=30
APP__DATABASE__IDLE_TIMEOUT_SECONDS=600
```

### Redis

Redis is used for rate limiting. If Redis is unavailable, the backend starts without rate limiting.

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis connection URL. Supports `redis://` and `rediss://` (TLS) schemes. |

### CORS

Cross-Origin Resource Sharing settings for the API.

| Variable | Default | Description |
|----------|---------|-------------|
| `APP__CORS_ORIGINS` | `http://localhost:3000,http://localhost:8080` | Comma-separated list of allowed origins. Add your admin and frontend domains here. |

**Example for production:**

```env
APP__CORS_ORIGINS=https://admin.yourdomain.com,https://yourdomain.com
```

### Clerk Authentication

[Clerk](https://clerk.com) provides user authentication for the admin dashboard. These variables are optional if you only use API key authentication.

| Variable | Default | Description |
|----------|---------|-------------|
| `CLERK_SECRET_KEY` | -- | Your Clerk secret key (`sk_test_...` or `sk_live_...`). Found in Clerk Dashboard > API Keys. |
| `CLERK_PUBLISHABLE_KEY` | -- | Your Clerk publishable key (`pk_test_...` or `pk_live_...`). Used by the admin frontend. |
| `SYSTEM_ADMIN_CLERK_IDS` | -- | Comma-separated Clerk user IDs (`user_...`) that should receive Master-level permissions. |
| `CLERK_JWKS_URL` | -- | URL to your Clerk JWKS endpoint for JWT verification. Format: `https://<your-clerk-domain>.clerk.accounts.dev/.well-known/jwks.json`. |

**Example:**

```env
CLERK_SECRET_KEY=sk_test_abc123...
CLERK_PUBLISHABLE_KEY=pk_test_xyz789...
SYSTEM_ADMIN_CLERK_IDS=user_2abc123,user_2def456
CLERK_JWKS_URL=https://example.clerk.accounts.dev/.well-known/jwks.json
```

:::info
The backend supports dual authentication. Every API request can be authenticated with either:
- **API Key:** `X-API-Key: dk_...` header
- **Clerk JWT:** `Authorization: Bearer <token>` header

The Clerk JWT is validated against the JWKS endpoint, and the user's Clerk role is mapped to an OpenYapper permission level.
:::

### Storage

Media uploads can be stored on the local filesystem or in an S3-compatible object store.

| Variable | Default | Description |
|----------|---------|-------------|
| `STORAGE_PROVIDER` | `local` | Storage backend. Either `local` (filesystem) or `s3` (S3-compatible). |

#### Local Storage

| Variable | Default | Description |
|----------|---------|-------------|
| `STORAGE_LOCAL_UPLOAD_DIR` | `./uploads` | Directory where uploaded files are written. Relative to the backend working directory. |
| `STORAGE_LOCAL_BASE_URL` | `/uploads` | URL prefix for serving uploaded files. |

#### S3 Storage

| Variable | Default | Description |
|----------|---------|-------------|
| `STORAGE_S3_BUCKET` | -- | S3 bucket name. |
| `STORAGE_S3_REGION` | -- | AWS region (e.g., `eu-central-1`). |
| `STORAGE_S3_PREFIX` | `media/` | Key prefix for all uploaded objects. |
| `STORAGE_S3_ENDPOINT` | -- | Custom endpoint URL for S3-compatible services (MinIO, R2, etc.). Leave unset for AWS S3. |

**Example (S3):**

```env
STORAGE_PROVIDER=s3
STORAGE_S3_BUCKET=my-openyapper-media
STORAGE_S3_REGION=eu-central-1
STORAGE_S3_PREFIX=media/
# For MinIO or other S3-compatible services:
# STORAGE_S3_ENDPOINT=http://localhost:9000
```

### TLS / HTTPS

For production deployments with TLS termination at the application level (rather than a reverse proxy).

| Variable | Default | Description |
|----------|---------|-------------|
| `TLS_CERT_PATH` | -- | Path to the TLS certificate file (PEM format). Example: `/etc/letsencrypt/live/yourdomain.com/fullchain.pem`. |
| `TLS_KEY_PATH` | -- | Path to the TLS private key file (PEM format). Example: `/etc/letsencrypt/live/yourdomain.com/privkey.pem`. |

:::tip
In most production setups, TLS is handled by a reverse proxy (nginx, Caddy, or a cloud load balancer). Only set these variables if you want Rocket to terminate TLS directly.
:::

### Rocket

Low-level Rocket framework settings. These are read directly by the Rocket framework, not by OpenYapper application code.

| Variable | Default | Description |
|----------|---------|-------------|
| `ROCKET_ADDRESS` | `0.0.0.0` | Address Rocket binds to. Should match `APP__HOST`. |
| `ROCKET_PORT` | `8000` | Port Rocket listens on. Should match `APP__PORT`. |
| `ROCKET_LOG_LEVEL` | `normal` | Rocket's internal log level. One of: `off`, `critical`, `normal`, `debug`. |

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

Below is a complete `backend/.env` file suitable for local development:

```env
# Application
APP__ENVIRONMENT=development
APP__HOST=0.0.0.0
APP__PORT=8000
APP__LOG_LEVEL=debug
APP__ENABLE_TRACING=true

# Database
DATABASE_URL=postgres://openyapper:openyapper@localhost:5432/openyapper
APP__DATABASE__MAX_CONNECTIONS=10
APP__DATABASE__MIN_CONNECTIONS=1
APP__DATABASE__CONNECT_TIMEOUT_SECONDS=30
APP__DATABASE__IDLE_TIMEOUT_SECONDS=600

# CORS
APP__CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8080

# Redis
REDIS_URL=redis://127.0.0.1:6379

# Clerk (uncomment and fill in your values)
# CLERK_SECRET_KEY=sk_test_...
# CLERK_PUBLISHABLE_KEY=pk_test_...
# SYSTEM_ADMIN_CLERK_IDS=user_...
# CLERK_JWKS_URL=https://your-domain.clerk.accounts.dev/.well-known/jwks.json

# Storage
STORAGE_PROVIDER=local
STORAGE_LOCAL_UPLOAD_DIR=./uploads
STORAGE_LOCAL_BASE_URL=/uploads

# Rocket
ROCKET_ADDRESS=0.0.0.0
ROCKET_PORT=8000
ROCKET_LOG_LEVEL=normal
```

## Next Steps

- [Architecture Overview](../architecture/overview) -- understand how the backend, admin, and frontend fit together.
- [API Reference](../api/overview) -- explore the REST API.
- [Admin Guide](../admin-guide/overview) -- manage content through the dashboard.
