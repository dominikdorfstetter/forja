# backend/src/repos — Repository layer

Data-access abstractions over SQLx — one repo per entity (`blog_repo`, `cv_repo`,
`project_repo`, `page_repo`, `legal_repo`, …). Repos own the SQL; models/handlers
call them. `content_query.rs` provides shared query-builder helpers (filtering,
soft-delete handling, pagination).

## Conventions

- Keep SQL here, out of handlers. Expose intention-revealing methods
  (`soft_delete`, `find_by_slug`, …), not raw query strings to callers.
- **Soft delete**: `soft_delete` should set `is_deleted` via
  `ContentService::soft_delete_content` for content-spine entities; list/read
  queries must filter `is_deleted = FALSE`.
- If you add a new soft-deletable entity, wire it into the Trash list, count,
  restore, and `trash_cleanup` paths too — otherwise rows orphan (a known gap for
  portfolio/projects/forms/collections).
- Use parameterized queries only — never string-interpolate user input.
