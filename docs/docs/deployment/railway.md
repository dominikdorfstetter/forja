---
sidebar_position: 2
---

# Railway Deployment

This guide walks you through deploying OpenYapper to [Railway](https://railway.app/) -- a platform that auto-detects Dockerfiles and provides managed PostgreSQL and Redis as addons.

## Prerequisites

- A [Railway account](https://railway.app/) (free tier available)
- [Railway CLI](https://docs.railway.app/guides/cli) installed:

```bash
npm i -g @railway/cli
railway login
```

## 1. Create a Railway Project

From the root of your OpenYapper checkout:

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

These are required by OpenYapper's migrations. Without them, the application will fail to start.

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
| `ROCKET_ADDRESS` | `0.0.0.0` | Rocket framework bind address |
| `ROCKET_PORT` | `8000` | |
| `ROCKET_LOG_LEVEL` | `normal` | |
| `PORT` | `8000` | Railway uses this to detect the listening port |

### Optional -- CORS

| Variable | Value | Notes |
|----------|-------|-------|
| `APP__CORS_ORIGINS` | `https://yourdomain.com` | Comma-separated origins. Use `*` for development. |

### Optional -- Clerk Authentication

| Variable | Value | Notes |
|----------|-------|-------|
| `CLERK_SECRET_KEY` | `sk_live_...` | From your Clerk dashboard, API Keys |
| `CLERK_PUBLISHABLE_KEY` | `pk_live_...` | From your Clerk dashboard, API Keys |
| `SYSTEM_ADMIN_CLERK_IDS` | `user_...` | Comma-separated Clerk user IDs for system admins |

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
| `APP__DATABASE__MAX_CONNECTIONS` | `10` | Max Postgres pool size |
| `APP__DATABASE__MIN_CONNECTIONS` | `1` | Min Postgres pool size |

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

Create your first API key by connecting to the database:

```bash
railway connect postgres
```

Then insert a master key:

```sql
INSERT INTO api_keys (id, name, key_hash, key_prefix, permission, status)
VALUES (
  gen_random_uuid(),
  'Initial Master Key',
  encode(sha256('your-secret-key-here'::bytea), 'hex'),
  'dk_master_',
  'Master',
  'Active'
);
```

:::caution
For production, generate a proper key through the admin dashboard once you have initial access via Clerk. The manual SQL approach is intended only for bootstrapping.
:::

## 9. Optional: Seed Demo Content

To populate the CMS with sample content for testing, connect to the database and run the seed SQL:

```bash
railway connect postgres < backend/scripts/dev_init.sql
```

The seed file is located at `backend/scripts/dev_init.sql` in the repository.

## Troubleshooting

### Build Fails with Out-of-Memory (OOM)

The Dockerfile uses `CARGO_PROFILE_RELEASE_LTO=thin` and `CARGO_PROFILE_RELEASE_CODEGEN_UNITS=2` to reduce memory usage during compilation. If builds still OOM on Railway's free tier, try upgrading to a plan with more memory, or push a pre-built image instead:

```bash
docker build -t openyapper .
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

Set `APP__CORS_ORIGINS` to your frontend's origin (e.g., `https://myblog.com`). Use `*` only for development.

### Admin Dashboard Shows Blank Page

Ensure the build completed successfully -- the admin dashboard is compiled as static files during the Docker build (stage 2) and served at `/dashboard`. Check Railway build logs for Node.js errors.

### Redis Connection Refused

Verify `REDIS_URL` is set correctly. If using Railway's variable references (`${{Redis.REDIS_URL}}`), ensure the Redis service is in the same project and linked.
