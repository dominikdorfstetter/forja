---
sidebar_position: 5
---

# Database Migrations

OpenYapper uses [SQLx](https://github.com/launchbadge/sqlx) for database migrations. Migrations are plain SQL files that run in order to create and modify the database schema.

## Migration Files

Migration files are stored in `backend/migrations/` and follow a naming convention:

```
backend/migrations/
├── 20240101000000_extensions_and_enums.sql
├── 20240101000001_core_infrastructure.sql
├── 20240101000002_media.sql
├── 20240101000003_content.sql
├── 20240101000004_blogs.sql
├── 20240101000005_cv.sql
├── 20240101000006_pages.sql
├── 20240101000007_legal.sql
├── 20240101000008_social_navigation.sql
└── ...
```

The timestamp prefix determines the order in which migrations run. SQLx tracks which migrations have been applied in a `_sqlx_migrations` table.

## Creating a New Migration

Use the SQLx CLI to create a new migration:

```bash
cd backend
sqlx migrate add create_bookmarks
```

This creates a new file like `migrations/20260228120000_create_bookmarks.sql`. Edit it with your SQL:

```sql
-- Create bookmarks table
CREATE TABLE bookmarks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    url         TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for site lookups
CREATE INDEX idx_bookmarks_site_id ON bookmarks(site_id);

-- Updated-at trigger
CREATE TRIGGER set_bookmarks_updated_at
    BEFORE UPDATE ON bookmarks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

## Running Migrations

### Automatic (on Application Start)

Migrations run automatically when the OpenYapper application starts. No manual step is required in production. The application checks the `_sqlx_migrations` table and applies any pending migrations before accepting requests.

### Manual (CLI)

To run migrations manually using the SQLx CLI:

```bash
cd backend
sqlx migrate run
```

This requires the `DATABASE_URL` environment variable to be set.

## Installing the SQLx CLI

If you do not have the SQLx CLI installed:

```bash
cargo install sqlx-cli --no-default-features --features postgres
```

## Reversible Migrations

For reversible migrations, create a separate "down" migration by adding `--reversible` when creating:

```bash
sqlx migrate add --reversible create_bookmarks
```

This creates two files:

- `migrations/<timestamp>_create_bookmarks.up.sql`
- `migrations/<timestamp>_create_bookmarks.down.sql`

Write the rollback SQL in the `.down.sql` file:

```sql
-- Down migration
DROP TABLE IF EXISTS bookmarks;
```

To revert the last migration:

```bash
sqlx migrate revert
```

:::caution
Reversible migrations are useful during development but should be used carefully in production. Dropping tables or columns can cause data loss.
:::

## Test Database

Integration tests use a separate test database to avoid polluting the development database. The test database URL is configured via the `TEST_DATABASE_URL` environment variable.

Ensure the test database has the required PostgreSQL extensions:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

The CI pipeline creates the test database and extensions automatically before running integration tests.

## Best Practices

1. **Never modify an existing migration** that has been applied to any environment. Always create a new migration for schema changes.

2. **Use `IF NOT EXISTS` and `IF EXISTS`** guards where appropriate to make migrations idempotent:

   ```sql
   CREATE TABLE IF NOT EXISTS bookmarks (...);
   CREATE INDEX IF NOT EXISTS idx_bookmarks_site_id ON bookmarks(site_id);
   ```

3. **Include foreign key constraints** to maintain referential integrity:

   ```sql
   site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE
   ```

4. **Add indexes** for columns used in WHERE clauses, JOINs, or ORDER BY:

   ```sql
   CREATE INDEX idx_bookmarks_site_id ON bookmarks(site_id);
   ```

5. **Use the `update_updated_at_column()` trigger** (defined in the base migrations) to auto-update `updated_at` timestamps.

## Required PostgreSQL Extensions

OpenYapper requires three PostgreSQL extensions. These are created by the first migration (`20240101000000_extensions_and_enums.sql`), but on managed PostgreSQL services they may need to be created manually:

| Extension | Purpose |
|-----------|---------|
| `uuid-ossp` | UUID generation functions (`uuid_generate_v4()`) |
| `citext` | Case-insensitive text type for slugs and emails |
| `pg_trgm` | Trigram matching for full-text search |
