# backend/src/models — Domain models + business logic

SQLx-backed models (`sqlx::FromRow`) plus the business logic that operates on them.
Handlers delegate here; this layer decides *what* happens, the repos handle the
raw data access.

## Conventions

- Business rules (publish lifecycle, validation beyond shape, permission checks
  that aren't middleware) live here, not in handlers.
- Use the [`repos/`](../repos/AGENTS.md) layer for data access where one exists,
  rather than scattering ad-hoc SQL.
- Respect the soft-delete model — list/read queries filter `is_deleted = FALSE`.
- See `CONTEXT.md` (repo root) for the domain vocabulary these models implement.
