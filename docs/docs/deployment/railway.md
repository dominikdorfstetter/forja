---
sidebar_position: 2
---

# Railway Deployment

This guide walks you through deploying Forja to [Railway](https://railway.app/) -- a platform that auto-detects Dockerfiles and provides managed PostgreSQL and Redis as addons.

## Prerequisites

- A [Railway account](https://railway.app/) (free tier available)
- [Railway CLI](https://docs.railway.app/guides/cli) installed:

```bash
npm i -g @railway/cli
railway login
```

## 1. Create a Railway Project

From the root of your Forja checkout:

```bash
railway init
```

Choose **"Empty Project"** when prompted. This creates a new project on Railway linked to your local directory.

## 2. Add PostgreSQL and Redis

In the [Railway dashboard](https://railway.app/dashboard), open your project and click **"+ New"** to add services:

1. **PostgreSQL** -- click "Database" then "PostgreSQL"
2. **Redis** -- click "Database" then "Redis"

Railway provisions both instantly and exposes connection strings as environment variables.

## 3. Create Required Database Extensions

Railway's managed PostgreSQL does not run Docker entrypoint scripts, so the extensions must be created manually. Connect to your Railway Postgres instance:

```bash
railway connect postgres
```

Then run:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

These are required by Forja's migrations. Without them, the application will fail to start.

## 4. Set Environment Variables

In the Railway dashboard, select your **app service** (not the database services) and go to **Variables**. Add the following:

### Required

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Railway variable reference -- auto-resolves |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` | Railway variable reference -- auto-resolves |
| `APP__ENVIRONMENT` | `production` | |
| `APP__HOST` | `0.0.0.0` | Required for Railway to route traffic |
| `APP__PORT` | `8000` | Must match `EXPOSE` in Dockerfile |
| `PORT` | `8000` | Railway uses this to detect the listening port |
| `PUBLIC_URL` | `https://<your-domain>` | Public origin (with scheme). Used to build absolute media URLs and the dashboard CSP. Set it to your generated Railway domain or custom domain from step 6. |
| `ENCRYPTION_KEY` | output of `openssl rand -base64 32` | Base64 32-byte AES-256-GCM key for encrypting AI provider API keys at rest. The production boot guard refuses the built-in dev fallback, so set this before enabling any AI provider. |

### Optional -- CORS

| Variable | Value | Notes |
|----------|-------|-------|
| `CORS_ALLOWED_ORIGINS` | `https://yourdomain.com` | Comma-separated origins. Empty (default) denies all cross-origin browser calls. `*` is refused at startup in production. |

### Optional -- Clerk Authentication

| Variable | Value | Notes |
|----------|-------|-------|
| `CLERK_SECRET_KEY` | `sk_live_...` | From your Clerk dashboard, API Keys |
| `CLERK_PUBLISHABLE_KEY` | `pk_live_...` | From your Clerk dashboard, API Keys |
| `CLERK_EXPECTED_AUDIENCE` | your JWT template audience | **Required in production when Clerk is enabled** — the boot guard refuses to start without it |
| `CLERK_EXPECTED_ISSUER` | `https://clerk.your-app.com` | **Required in production when Clerk is enabled** — the boot guard refuses to start without it. Same host as in `CLERK_JWKS_URL`. |
| `SYSTEM_ADMIN_CLERK_IDS` | `user_...` | Comma-separated Clerk user IDs for system admins |

:::caution
If you set `CLERK_SECRET_KEY` with `APP__ENVIRONMENT=production` but omit `CLERK_EXPECTED_AUDIENCE` or `CLERK_EXPECTED_ISSUER`, the deploy will not boot. See [Environment Variables → Clerk](./environment-variables#authentication----clerk) for details and how to derive the issuer value.
:::

### Optional -- S3 Storage

By default, uploads are stored on the local filesystem (ephemeral on Railway). For persistent media, use S3-compatible storage:

| Variable | Value | Notes |
|----------|-------|-------|
| `STORAGE_PROVIDER` | `s3` | Switch from `local` (default) to S3 |
| `STORAGE_S3_BUCKET` | `my-bucket` | S3 bucket name |
| `STORAGE_S3_REGION` | `us-east-1` | AWS region |
| `STORAGE_S3_PREFIX` | `media/` | Optional key prefix |
| `STORAGE_S3_ENDPOINT` | `https://...` | For non-AWS S3 (MinIO, R2, Spaces) |

AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) are read from the standard SDK chain.

### Optional -- TLS

Railway handles TLS termination at the edge, so you typically do **not** need to set `TLS_CERT_PATH` / `TLS_KEY_PATH`. Only set these if you have a specific reason to terminate TLS at the application level.

### Optional -- Database Pool

| Variable | Value | Notes |
|----------|-------|-------|
| `APP__DATABASE__MAX_CONNECTIONS` | `20` | Max Postgres pool size |
| `APP__DATABASE__MIN_CONNECTIONS` | `2` | Min Postgres pool size |

### Scaling horizontally (replicas > 1)

The API service is safe to run on multiple Railway replicas: every long-running background worker (publish scheduler, webhook delivery, anomaly detection, site export, retention cleanups, …) wraps its tick body in a per-worker Postgres advisory lock, so each cron fires on exactly one replica per tick. If the leader replica dies, Postgres releases the held locks when its connections close, and another replica picks the work up on the next tick — no coordinator service required. See [Architecture → Backend → Background Services](../architecture/backend.md#background-services) for details. No environment variables to set; the behavior is automatic.

## 5. Deploy

```bash
railway up
```

Railway detects the `Dockerfile`, builds the multi-stage image, and deploys. The first build takes approximately 10 minutes (Rust compilation). Subsequent builds are faster due to Docker layer caching.

Migrations run automatically on startup -- no manual step is needed.

## 6. Expose the Service

In the Railway dashboard, go to your app service, then **Settings**, then **Networking** and click **"Generate Domain"** to get a public `*.up.railway.app` URL. You can also add a custom domain.

## 7. Verify

Once deployed, check these endpoints:

| URL | Expected |
|-----|----------|
| `https://<your-domain>/health` | JSON health status (Postgres + Redis) |
| `https://<your-domain>/api-docs` | Swagger UI |
| `https://<your-domain>/dashboard` | Admin dashboard |

## 8. First-Time Setup

### Option A: Clerk Authentication (Recommended)

If you configured Clerk variables in step 4:

1. Visit `https://<your-domain>/dashboard`
2. Sign in with your Clerk account
3. The first user listed in `SYSTEM_ADMIN_CLERK_IDS` automatically gets Master permissions
4. Create API keys for external integrations through the admin UI

### Option B: API Key Authentication

The supported way to create API keys is through the admin dashboard (**API Keys** page) or the `/api/v1/auth/keys` endpoint — both require an existing authenticated identity (Clerk user or a master API key). If you skipped Clerk entirely, you can bootstrap the very first master key with SQL. Connect to the database:

```bash
railway connect postgres
```

Two schema rules matter here: `api_keys.site_id` is `NOT NULL` (every key is scoped to a site), and the backend looks keys up by prefix, so the plaintext **must** follow the `dk_<id>_<secret>` format with `key_prefix` set to `dk_<id>`.

```sql
-- 1. A site must exist first (api_keys.site_id is NOT NULL).
--    Skip this if you already created one; note its id instead.
INSERT INTO sites (name, slug)
VALUES ('My Site', 'my-site')
ON CONFLICT (slug) DO NOTHING;

-- 2. Choose your key. Format is mandatory: dk_<id>_<secret>
--    where <id> is 8 characters. Example plaintext:
--      dk_bootstrp_<paste-a-long-random-secret>
--    Generate the secret locally: openssl rand -hex 32

-- 3. Insert the master key, scoped to the site.
--    Enum values are lowercase ('master', 'active').
--    hash_version defaults to 1 (SHA-256); the backend transparently
--    re-hashes the key with Argon2 on first successful use.
INSERT INTO api_keys (name, key_hash, key_prefix, permission, status, site_id)
SELECT
  'Initial Master Key',
  encode(sha256('dk_bootstrp_your-random-secret-here'::bytea), 'hex'),
  'dk_bootstrp',
  'master',
  'active',
  id
FROM sites
WHERE slug = 'my-site';
```

Then authenticate with the full plaintext (`dk_bootstrp_your-random-secret-here`) in the `X-API-Key` header. The plaintext is never stored — keep it safe.

:::caution
The manual SQL approach is intended only for bootstrapping. Once you have access, create proper keys through the admin dashboard and revoke the bootstrap key.
:::

## 9. Optional: Seed Demo Content

To populate the CMS with sample content for testing, connect to the database and run the seed SQL:

```bash
railway connect postgres < backend/scripts/dev_init.sql
```

The seed file is located at `backend/scripts/dev_init.sql` in the repository.

## Zero-Downtime & Health

The repository ships a `railway.toml` that wires deploys for zero downtime:

| Setting | Value | Effect |
|---------|-------|--------|
| `healthcheckPath` | `/health` | Railway only routes traffic to a replica once Postgres and Redis report healthy |
| `overlapSeconds` | `30` | The old deploy keeps serving for 30 s while the new one comes up |
| `drainingSeconds` | `30` | In-flight requests get 30 s to finish before the old replica is stopped |
| `restartPolicyType` | `ON_FAILURE` (max 10 retries) | Crashed replicas restart automatically |

The backend cooperates: on `SIGTERM` it stops accepting new connections and drains in-flight requests gracefully with a ~25 s grace period (deliberately below Railway's 30 s draining window). No extra configuration is needed — but if you fork `railway.toml`, keep the health check, overlap, and draining settings, or deploys will drop requests.

## Backups

Railway's managed PostgreSQL supports scheduled backups from the dashboard (service → **Backups**) — enable them for production. For manual dump/restore procedures (`pg_dump` / `pg_restore`), see the [Docker guide's backup section](./docker#backup-and-restore); the same commands work against `railway connect postgres`.

## Troubleshooting

### Build Fails with Out-of-Memory (OOM)

The Dockerfile uses `CARGO_PROFILE_RELEASE_LTO=thin` and `CARGO_PROFILE_RELEASE_CODEGEN_UNITS=4` to reduce memory usage during compilation. If builds still OOM on Railway's free tier, try upgrading to a plan with more memory, or push a pre-built image instead:

```bash
docker build -t forja .
# Push to a container registry and deploy from there
```

### "Extension Does Not Exist" Errors on Startup

You missed step 3. Connect to Postgres and create the required extensions:

```bash
railway connect postgres
```

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

### CORS Errors in the Browser

Set `CORS_ALLOWED_ORIGINS` to your frontend's origin (e.g., `https://myblog.com`). Use `*` only for development.

### Admin Dashboard Shows Blank Page

Ensure the build completed successfully -- the admin dashboard is compiled as static files during the Docker build (stage 2) and served at `/dashboard`. Check Railway build logs for Node.js errors.

### Redis Connection Refused

Verify `REDIS_URL` is set correctly. If using Railway's variable references (`${{Redis.REDIS_URL}}`), ensure the Redis service is in the same project and linked.
