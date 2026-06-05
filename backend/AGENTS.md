# backend — Forja API

Rust REST API (Axum 0.8 + SQLx + PostgreSQL + Redis), built with utoipa for
OpenAPI. This is the system of record for all content and the only writer to the
database. Runs on `:8000`; Swagger UI at `/api-docs`.

## Commands

```bash
cargo run                     # start server (:8000)
cargo test                    # tests (cargo test NAME for one)
cargo clippy -- -D warnings   # lint (warnings are errors)
cargo fmt                     # format
sqlx migrate run              # apply migrations
sqlx migrate add NAME         # new migration (never edit an existing one)
cargo sqlx prepare            # refresh offline query cache for CI
```

## Layering — keep handlers thin

Request flow: **handler → model/repo → DTO**.

| Dir | Role |
|-----|------|
| [`src/axum_app/handlers/`](src/axum_app/handlers/AGENTS.md) | Route handlers; `#[utoipa::path]` + `OpenApiRouter`. No SQL inline. |
| `src/axum_app/middleware/` | Tower layers: security headers, CORS, rate-limit, usage tracking. |
| `src/axum_app/extractors.rs` | `FromRequestParts` impls — auth, `ModuleGuard`, `CurrentSite`. |
| [`src/models/`](src/models/AGENTS.md) | Business logic + SQLx queries. |
| [`src/repos/`](src/repos/AGENTS.md) | Data-access abstractions over SQLx. |
| [`src/services/`](src/services/AGENTS.md) | External integrations + background workers (S3, Clerk, AI, schedulers). |
| [`src/dto/`](src/dto/AGENTS.md) | Request/response DTOs (`Validate` + `ToSchema`). |
| `src/guards/` | Auth-key wrapper types (Read/Write/Admin/Master) + module markers. |
| `src/errors/` | `ApiError` → RFC 7807 ProblemDetails. |
| `src/config/` | Configuration + boot guards. |
| [`migrations/`](migrations/AGENTS.md) | SQL migrations (append-only). |

## Conventions

- **Auth**: Clerk JWT (`Authorization: Bearer`), API key (`X-API-Key`), or preview
  token (`X-Preview-Token`). RBAC hierarchy `Master > Admin > Write > Read`.
- **Validation seam**: extract request bodies as `ValidatedJson<T>` (or
  `ValidatedJson<Vec<T>>`), never raw `Json<T>`. Enforcement is opt-out-with-reason
  (#828): `check-validated-extractor.sh` fails CI on any request body that isn't a
  `ValidatedDto` or exempted in `scripts/validated-extractor-exemptions.txt`.
  Validation failures return 422.
- **OpenAPI**: every handler annotated; schemas registered in `AxumApiDoc`
  (`axum_app/mod.rs`). The admin SDK is generated from this — keep it in sync.
- **Soft-delete**: content delete sets `is_deleted`; the `trash_cleanup` worker
  purges after the retention window. Surfacing in Trash + restore is per-entity.
- **Background workers**: each exposes `spawn(state)`, aggregated in
  `axum_app::workers::spawn_all`.
