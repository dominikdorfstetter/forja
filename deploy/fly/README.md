# Deploying Forja to Fly.io

## Prerequisites

- A [Fly.io account](https://fly.io/)
- [flyctl CLI](https://fly.io/docs/flyctl/install/) installed and authenticated:

```bash
fly auth login
```

## 1. Create the App

```bash
fly apps create forja
```

Replace `forja` with your preferred app name. Update `app` in `fly.toml` to match.

## 2. Create PostgreSQL

```bash
fly postgres create --name forja-db --region fra
fly postgres attach forja-db --app forja
```

This sets `DATABASE_URL` automatically. Connect and create the required extensions:

```bash
fly postgres connect -a forja-db
```

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
\q
```

## 3. Create Redis

```bash
fly redis create --name forja-redis --region fra
```

Note the `REDIS_URL` from the output, then set it as a secret:

```bash
fly secrets set REDIS_URL="redis://..."
```

## 4. Create the Upload Volume

```bash
fly volumes create forja_uploads --region fra --size 1
```

## 5. Set Secrets

```bash
fly secrets set \
  APP__CORS_ORIGINS="https://forja.fly.dev" \
  CLERK_SECRET_KEY="sk_live_..." \
  CLERK_PUBLISHABLE_KEY="pk_live_..." \
  SYSTEM_ADMIN_CLERK_IDS="user_..."
```

Clerk variables are optional. Without them, use API key authentication.

## 6. Deploy

From the repository root:

```bash
fly deploy --config deploy/fly/fly.toml
```

The first deploy takes ~10 minutes (Rust compilation). Subsequent deploys are faster with Docker layer caching.

## 7. Verify

```bash
fly status
curl https://forja.fly.dev/health
```

Open the admin dashboard at `https://forja.fly.dev/dashboard`.

## Scaling

```bash
# Add more machines
fly scale count 2

# Increase memory
fly scale vm shared-cpu-1x --memory 2048
```

## Logs

```bash
fly logs
```

## Troubleshooting

### Build Fails with OOM

The Dockerfile uses `CARGO_PROFILE_RELEASE_LTO=thin` to reduce memory. If builds still OOM, use a remote builder:

```bash
fly deploy --remote-only --config deploy/fly/fly.toml
```

### Extension Errors on Startup

Connect to Postgres and create the extensions (step 2 above).

### Redis Connection Refused

Verify `REDIS_URL` is set correctly:

```bash
fly secrets list
```
