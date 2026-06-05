---
sidebar_position: 3
---

# Environment Variables

Complete reference of all environment variables used by Forja. Variables are grouped by category.

## Core Application

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `APP__ENVIRONMENT` | `development` | Yes (production) | Set to the literal string `production` for production deployments. The string is case-sensitive — `prod` / `Production` will leave production-only boot guards disabled. |
| `APP__HOST` | `0.0.0.0` | No | Bind address. Set to `127.0.0.1` to bind loopback only. |
| `APP__PORT` | `8000` | No | Application port |
| `APP__LOG_LEVEL` | `info` | No | tracing-subscriber filter: `error`, `warn`, `info`, `debug`, `trace` |
| `APP__ENABLE_TRACING` | `true` | No | Toggle structured tracing output |
| `PUBLIC_URL` | `http://localhost:8000` | Yes (production) | Public origin used to build absolute media URLs and the dashboard CSP. Must include scheme. |
| `PORT` | -- | No | Some platforms (Railway) use this to detect the listening port. Forja itself reads `APP__PORT`; set both to the same value when deploying to platforms that probe `PORT`. |

## Database (PostgreSQL)

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | -- | **Yes** | PostgreSQL connection string, e.g., `postgres://user:pass@host:5432/dbname` |
| `APP__DATABASE__MAX_CONNECTIONS` | `20` | No | Maximum number of connections in the pool |
| `APP__DATABASE__MIN_CONNECTIONS` | `2` | No | Minimum number of connections in the pool |

## Redis & Rate Limiting

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `REDIS_URL` | -- | **Yes** | Redis connection string, e.g., `redis://host:6379` |
| `RATE_LIMIT_FAIL_MODE` | `closed` | No | Behavior when Redis is unavailable: `closed` rejects with 429 (security, default), `open` allows requests (availability). In `APP__ENVIRONMENT=production` the service refuses to start when Redis is unreachable and the mode is `closed`. |
| `RATE_LIMIT_BURST_PER_SECOND` | `100` | No | Per-API-key burst ceiling (requests/second), enforced independently of each key's calendar quotas. Raise it for sites whose static builds fan out into highly-parallel request storms. Values ≤ 0 are ignored (default applies). |
| `RESPONSE_CACHE_TTL_SECS` | `60` | No | Time-to-live (seconds) for the server-side response cache of public reads. Acts as a backstop behind explicit invalidation on content writes; lower it for fresher reads, raise it to absorb more build/crawl load. Caching is disabled entirely when `REDIS_URL` is unset. See [Cache](../admin-guide/cache.md). |
| `TRUST_PROXY_HEADERS` | `false` | No | Trust `X-Forwarded-For` and `X-Real-IP` headers for real client IP extraction. **Enable only behind a trusted reverse proxy.** |

:::caution Rate Limiting Behind a Reverse Proxy
If your Forja instance runs behind a reverse proxy (nginx, Caddy, HAProxy) on the same host, **you must set `TRUST_PROXY_HEADERS=true`**. Otherwise all requests appear to come from `127.0.0.1` and bypass IP-based rate limiting entirely.

When enabled, Forja reads the client IP from `X-Forwarded-For` (first entry) or `X-Real-IP` headers. Make sure your proxy sets these headers and strips any client-provided values to prevent spoofing.
:::

:::tip Fail-Closed vs Fail-Open
- **`closed`** (default): If Redis goes down, all rate-limited requests are rejected with HTTP 429. This prioritizes security — no requests can bypass rate limiting. In `production` the service refuses to start if Redis is unreachable; other environments boot with degraded availability and a warning log.
- **`open`**: If Redis goes down, rate limits are bypassed and requests are allowed through. This prioritizes API availability at the cost of silently unthrottling every endpoint until Redis recovers. Choose this only if you have an independent rate-limiting layer (edge CDN, reverse proxy) or accept the unthrottled window.

The previous default was `open`; switching to `closed` closes a silent bypass where a Redis outage would let unlimited traffic through for the duration of the outage.
:::

## Audit Log

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `APP__AUDIT__RETENTION_DAYS` | `365` | No | System-wide default retention period for audit logs (in days). Per-site overrides via `audit_log_retention_days` in site settings take precedence. |

## CORS

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `CORS_ALLOWED_ORIGINS` | _empty_ | No (yes, if you have a cross-origin admin SPA or consumer site) | Comma-separated list of allowed origins, e.g. `https://admin.example.com,https://blog.example.com`. Empty means deny all cross-origin browser calls. Setting `*` in `APP__ENVIRONMENT=production` refuses to start — the wildcard is a dev-only affordance. |

:::caution CORS in production
Set `CORS_ALLOWED_ORIGINS` to the exact origins your admin dashboard and any consumer-site frontends use. The previous default was `*` (reflect any origin), which weakened CORS as a defense-in-depth boundary for authenticated routes. Fresh installs now default to empty (deny all) and production rejects the wildcard at startup.
:::

## Authentication -- Clerk

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `CLERK_SECRET_KEY` | -- | No | Clerk secret key (`sk_live_...` or `sk_test_...`) |
| `CLERK_PUBLISHABLE_KEY` | -- | No | Clerk publishable key (`pk_live_...` or `pk_test_...`). Also used to auto-derive the FAPI domain and the expected issuer. |
| `CLERK_JWKS_URL` | -- | No | Clerk JWKS endpoint URL. Auto-derived from secret key if not set. |
| `CLERK_FAPI_DOMAIN` | -- | No | Override for the Clerk Frontend API domain used in CSP and issuer derivation. Normally auto-extracted from `CLERK_PUBLISHABLE_KEY`. |
| `CLERK_EXPECTED_AUDIENCE` | -- | **Yes** (production with Clerk) | Expected `aud` claim on incoming Clerk JWTs. Set this to the audience configured in your Clerk JWT template. Without it, tokens signed by keys in your JWKS are accepted regardless of which Clerk app or template minted them. |
| `CLERK_EXPECTED_ISSUER` | -- | **Yes** (production with Clerk) | Expected `iss` claim on incoming Clerk JWTs, e.g. `https://clerk.your-app.com`. The boot guard requires this to be set explicitly in production — it does **not** currently auto-derive from `CLERK_PUBLISHABLE_KEY` / `CLERK_FAPI_DOMAIN` (a follow-up to the v1.4.0 cutover will restore that fallback; for now, set it explicitly). The value is `https://<your-clerk-fapi-domain>` — the same host that appears in `CLERK_JWKS_URL`. |
| `SYSTEM_ADMIN_CLERK_IDS` | -- | No | Comma-separated Clerk user IDs that receive Master permissions |

:::caution Clerk JWT pinning in production
When `CLERK_SECRET_KEY` is set and `APP__ENVIRONMENT=production`, the service refuses to start unless **both** `CLERK_EXPECTED_AUDIENCE` and `CLERK_EXPECTED_ISSUER` are set explicitly. Without pinning, any token signed by keys in the configured JWKS authenticates — including tokens minted for an unrelated Clerk app that happens to share a JWKS endpoint. Non-production environments emit a warning and continue.

The `iss` value is `https://<your-clerk-fapi-domain>` — typically the same host that appears in `CLERK_JWKS_URL`. You can decode it from your publishable key locally:

```bash
echo "${CLERK_PUBLISHABLE_KEY#pk_*_}" | base64 -d
# → "clerk.your-app.com$"  (drop trailing "$" → use as host in CLERK_EXPECTED_ISSUER)
```
:::

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

## Application-Level Encryption

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `ENCRYPTION_KEY` | dev-only fallback | **Yes** (production) | Base64-encoded 32-byte AES-256-GCM key used to encrypt AI provider API keys at rest. Generate with: `openssl rand -base64 32`. Falls back to a built-in dev key when unset; production refuses this fallback. `AI_ENCRYPTION_KEY` is accepted as a legacy alias. |

## Document Encryption

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `DOCUMENT_ENCRYPTION_KEY` | -- | No | Base64-encoded 32-byte key for wrapping document encryption keys. Enables admin recovery of password-protected documents. Generate with: `openssl rand -base64 32` |
| `DOCUMENT_ENCRYPTION_KEY_OLD` | -- | No | Previous encryption key, used during key rotation. Documents encrypted with this key are lazily re-wrapped on next access. |

:::tip Key Rotation
To rotate the document encryption key:
1. Set `DOCUMENT_ENCRYPTION_KEY_OLD` to the current key value
2. Set `DOCUMENT_ENCRYPTION_KEY` to the new key
3. Deploy — documents are lazily re-wrapped on access
4. After all documents have been accessed, remove `DOCUMENT_ENCRYPTION_KEY_OLD`

User downloads are never affected by key rotation — files are encrypted with the user's password, not the server key. The server key only enables admin recovery.
:::

## TLS

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `TLS_CERT_PATH` | -- | No | Path to TLS certificate file (PEM format) |
| `TLS_KEY_PATH` | -- | No | Path to TLS private key file (PEM format) |

:::tip
If you deploy behind a reverse proxy or a platform like Railway that handles TLS termination at the edge, you do not need to set these variables.
:::

## Demo Mode

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `DEMO_MODE` | `false` | No | When `true`, auto-seeds a demo site on startup and auto-joins newly registered Clerk users to it. Intended for hosted demos; never enable in production. |

## Imprint (Impressum)

Operator legal details served at runtime by `GET /api/v1/imprint` and shown on the signed-out Welcome page. Required for any publicly reachable instance under EU law. The required trio (`IMPRINT_OPERATOR_NAME`, `IMPRINT_ADDRESS`, `IMPRINT_EMAIL`) must all be set for the imprint to be considered configured and the footer Imprint link to appear; otherwise the endpoint returns `{ "configured": false }` and the link stays hidden. Never commit real operator details — set these per deployment only.

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `IMPRINT_OPERATOR_NAME` | -- | For imprint | Legal name of the operator |
| `IMPRINT_ADDRESS` | -- | For imprint | Postal address |
| `IMPRINT_EMAIL` | -- | For imprint | Contact email |
| `IMPRINT_PHONE` | -- | No | Contact phone |
| `IMPRINT_VAT` | -- | No | VAT / UID number |
| `IMPRINT_REGISTER` | -- | No | Commercial register / Firmenbuch entry |
| `IMPRINT_RESPONSIBLE` | -- | No | Person responsible for content |

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
APP__HOST=0.0.0.0
APP__PORT=8000
APP__LOG_LEVEL=info
APP__ENABLE_TRACING=true
PUBLIC_URL=http://localhost:8000

# Database
DATABASE_URL=postgres://forja:forja@localhost:5432/forja

# Redis & Rate Limiting
REDIS_URL=redis://localhost:6379
# RATE_LIMIT_FAIL_MODE=closed     # "closed" (default) or "open"

# Audit log retention (default: 365 days, per-site overrides in site settings)
# APP__AUDIT__RETENTION_DAYS=365
# TRUST_PROXY_HEADERS=false       # set true behind a reverse proxy

# CORS — deny-all by default; list your admin SPA + any consumer site origins.
# Wildcard ("*") is refused in production; keep it scoped to dev.
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Clerk (optional, but all four lines together are required in production)
# CLERK_SECRET_KEY=sk_test_...
# CLERK_PUBLISHABLE_KEY=pk_test_...
# CLERK_EXPECTED_AUDIENCE=my-forja-app
# CLERK_EXPECTED_ISSUER=https://clerk.your-app.com   # required in production
# SYSTEM_ADMIN_CLERK_IDS=user_...

# Storage (default: local)
# STORAGE_PROVIDER=s3
# STORAGE_S3_BUCKET=my-bucket
# STORAGE_S3_REGION=us-east-1
# STORAGE_S3_PREFIX=media/

# Application-level encryption (required in production)
# Generate with: openssl rand -base64 32
# ENCRYPTION_KEY=

# Document encryption (enables admin recovery for password-protected docs)
# Generate with: openssl rand -base64 32
# DOCUMENT_ENCRYPTION_KEY=
# DOCUMENT_ENCRYPTION_KEY_OLD=     # set during key rotation

# TLS (optional, not needed behind a reverse proxy)
# TLS_CERT_PATH=/path/to/cert.pem
# TLS_KEY_PATH=/path/to/key.pem

# Demo mode (auto-seed demo site, auto-join new users) — never enable in production
# DEMO_MODE=false

# Imprint / Impressum — operator legal details (required trio: NAME + ADDRESS + EMAIL)
# IMPRINT_OPERATOR_NAME=Acme GmbH
# IMPRINT_ADDRESS=Hauptstraße 1, 1010 Wien, Austria
# IMPRINT_EMAIL=legal@acme.example
# IMPRINT_PHONE=+43 1 2345678
# IMPRINT_VAT=ATU12345678
# IMPRINT_REGISTER=FN 123456a, Handelsgericht Wien
# IMPRINT_RESPONSIBLE=Jane Doe
```
