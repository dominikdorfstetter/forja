# backend/migrations — SQL migrations

Timestamped SQLx migration files (`YYYYMMDDHHMMSS_name.sql`), applied with
`sqlx migrate run`.

## Rules

- **Never edit an existing migration.** Once a file exists it may already be applied
  in production or on teammates' machines. Fix forward with a *new* migration.
- Create with `sqlx migrate add <name>` so the timestamp ordering is correct.
- Review the SQL carefully before committing — migrations are effectively
  irreversible in production.
- After changing the schema, regenerate the SQLx offline cache
  (`cargo sqlx prepare`) so CI compiles without a live database.
- New tables holding personal data should carry the columns the privacy model
  expects (e.g. soft-delete `is_deleted`/`deleted_at`, retention, encryption) —
  match the existing content tables.
