---
sidebar_position: 4
---

# Configuration

Forja is configured through environment variables defined in `backend/.env`. This page documents every supported variable, its default value, and what it controls.

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
| `DATABASE_URL` | `postgres://forja:forja@localhost:5432/forja` | PostgreSQL connection string. Format: `postgres://user:password@host:port/database`. |
| `APP__DATABASE__MAX_CONNECTIONS` | `20` | Maximum number of connections in the SQLx connection pool. Increase for high-traffic deployments. |
| `APP__DATABASE__MIN_CONNECTIONS` | `2` | Minimum idle connections kept open in the pool. |
| `APP__DATABASE__CONNECT_TIMEOUT_SECONDS` | `5` | Maximum time (in seconds) to wait when acquiring a new connection. |
| `APP__DATABASE__IDLE_TIMEOUT_SECONDS` | `600` | Time (in seconds) before an idle connection is closed and removed from the pool. |

**Example:**

```env
DATABASE_URL=postgres://forja:forja@localhost:5432/forja
APP__DATABASE__MAX_CONNECTIONS=20
APP__DATABASE__MIN_CONNECTIONS=2
APP__DATABASE__CONNECT_TIMEOUT_SECONDS=5
APP__DATABASE__IDLE_TIMEOUT_SECONDS=600
```

### Redis & Rate Limiting

Redis is used for rate limiting. If Redis is unavailable at startup, the backend starts with rate limiting disabled. During operation, the fail mode controls behavior (see below). In production with `fail_mode=closed`, the service refuses to start when Redis cannot be reached.

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis connection URL. Supports `redis://` and `rediss://` (TLS) schemes. |
| `RATE_LIMIT_FAIL_MODE` | `closed` | Behavior when Redis is unavailable during operation: `open` allows requests through, `closed` rejects with 429. |
| `TRUST_PROXY_HEADERS` | `false` | Trust `X-Forwarded-For` / `X-Real-IP` headers for client IP. **Set to `true` when behind a reverse proxy.** |

### CORS

Cross-Origin Resource Sharing settings for the API.

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ALLOWED_ORIGINS` | (empty) | Comma-separated list of allowed origins. Add your admin and frontend domains here. Empty means no origins allowed. |

**Example for production:**

```env
CORS_ALLOWED_ORIGINS=https://admin.yourdomain.com,https://yourdomain.com
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

The Clerk JWT is validated against the JWKS endpoint, and the user's Clerk role is mapped to an Forja permission level.
:::

### Security & Encryption

Encryption keys used for document-level encryption and AI provider credential encryption.

| Variable | Default | Description |
|----------|---------|-------------|
| `ENCRYPTION_KEY` | -- | Base64-encoded 32-byte key for encrypting AI provider credentials. Falls back to `AI_ENCRYPTION_KEY`. In debug builds, a built-in dev key is used if unset. |
| `DOCUMENT_ENCRYPTION_KEY` | -- | Envelope encryption key for private documents. Optional -- documents are stored unencrypted if not set. |
| `DOCUMENT_ENCRYPTION_KEY_OLD` | -- | Previous document encryption key, used during key rotation. Documents encrypted with the old key are lazily re-wrapped on access. |

### Permission Cache

| Variable | Default | Description |
|----------|---------|-------------|
| `PERMISSION_CACHE_TTL_SECS` | `300` | TTL (in seconds) for cached permission lookups in Redis. Default is 5 minutes. |

### Clerk (additional)

These extend the Clerk section above.

| Variable | Default | Description |
|----------|---------|-------------|
| `CLERK_FAPI_DOMAIN` | Auto-detected from publishable key | Clerk Frontend API domain, used in CSP headers. Only set this if auto-detection from the publishable key does not work for your setup. |

### Preview Service

| Variable | Default | Description |
|----------|---------|-------------|
| `APP__PREVIEW__BUILT_IN_TEMPLATES` | -- | Comma-separated name/url pairs for built-in preview templates. Format: `Name1&#124;URL1,Name2&#124;URL2`. |

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
STORAGE_S3_BUCKET=my-forja-media
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
In most production setups, TLS is handled by a reverse proxy (nginx, Caddy, or a cloud load balancer). Only set these variables if you want the backend to terminate TLS directly via `axum-server` + `rustls`.
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

Below is a complete `backend/.env` file suitable for local development:

```env
# Application
APP__ENVIRONMENT=development
APP__HOST=0.0.0.0
APP__PORT=8000
APP__LOG_LEVEL=debug
APP__ENABLE_TRACING=true

# Database
DATABASE_URL=postgres://forja:forja@localhost:5432/forja
APP__DATABASE__MAX_CONNECTIONS=20
APP__DATABASE__MIN_CONNECTIONS=2
APP__DATABASE__CONNECT_TIMEOUT_SECONDS=5
APP__DATABASE__IDLE_TIMEOUT_SECONDS=600

# CORS — comma-separated list of allowed origins (deny-all when empty)
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8080

# Redis & Rate Limiting
REDIS_URL=redis://127.0.0.1:6379
# RATE_LIMIT_FAIL_MODE=closed     # "closed" (default) or "open"
# TRUST_PROXY_HEADERS=false       # set true behind a reverse proxy

# Clerk (uncomment and fill in your values)
# CLERK_SECRET_KEY=sk_test_...
# CLERK_PUBLISHABLE_KEY=pk_test_...
# SYSTEM_ADMIN_CLERK_IDS=user_...
# CLERK_JWKS_URL=https://your-domain.clerk.accounts.dev/.well-known/jwks.json
# CLERK_FAPI_DOMAIN=                    # auto-detected if unset

# Security & Encryption (optional)
# ENCRYPTION_KEY=                       # base64 32-byte key for AI credentials
# DOCUMENT_ENCRYPTION_KEY=              # envelope encryption key for documents
# DOCUMENT_ENCRYPTION_KEY_OLD=          # previous key for rotation
# PERMISSION_CACHE_TTL_SECS=300         # Redis permission cache TTL

# Preview Service (optional)
# APP__PREVIEW__BUILT_IN_TEMPLATES=Blog|http://preview:4321

# Storage
STORAGE_PROVIDER=local
STORAGE_LOCAL_UPLOAD_DIR=./uploads
STORAGE_LOCAL_BASE_URL=/uploads
```

## Next Steps

- [Architecture Overview](../architecture/overview) -- understand how the backend, admin, and frontend fit together.
- [API Reference](../api/overview) -- explore the REST API.
- [Admin Guide](../admin-guide/overview) -- manage content through the dashboard.
