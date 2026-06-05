---
title: Backend Architecture
sidebar_position: 2
description: Rust backend architecture, directory structure, and request lifecycle.
---

# Backend Architecture

The Forja backend is a REST API built with **Rust**, using the **Axum 0.8** web framework on top of **`axum-server`** (with optional `rustls` TLS). It communicates with PostgreSQL via **SQLx** (compile-time checked queries) and uses **utoipa** + **utoipa-axum** for OpenAPI specification generation.

## Directory Structure

```
backend/src/
├── main.rs              # tokio::main → boot guards → router build
│                        # → axum::serve / axum_server::bind_rustls
├── lib.rs               # Library re-exports
├── axum_app/
│   ├── mod.rs           # Router assembly + AxumApiDoc
│   ├── handlers/        # Axum route handlers (thin — delegate to models)
│   ├── middleware/      # Tower layers (security headers, CORS,
│   │                    #   request-id, rate-limit, public rate-limit,
│   │                    #   usage tracking)
│   ├── extractors.rs    # FromRequestParts impls (auth, ModuleGuard,
│   │                    #   CurrentSite, ClientIp, UserAgent)
│   ├── openapi_split.rs # Splits the OpenAPI doc into consumer + admin
│   └── workers.rs       # Background-worker spawn aggregator
├── config/
│   ├── mod.rs
│   ├── settings.rs      # Settings struct, env-var loading (config crate)
│   └── security.rs      # SecurityConfig + boot-guard validators
│                        #   (CORS wildcard, rate-limit fail mode,
│                        #    Clerk JWT pinning)
├── dto/                 # Data Transfer Objects (request/response schemas)
├── errors/              # ApiError enum + RFC 7807 ProblemDetails
│                        #   (impl IntoResponse for ApiError)
├── guards/              # Auth-key wrapper types (AuthenticatedKey,
│                        #   ReadKey, WriteKey, AdminKey, MasterKey)
│                        #   and ModuleGuard markers — the Axum
│                        #   extractors live in axum_app/extractors.rs
├── middleware/          # Cross-stack helpers (rate-limit atomics,
│                        #   usage-tracking context, CORS resolution)
├── models/              # Business logic + SQLx queries
├── services/            # External integrations + background workers
│                        #   (storage, clerk_service, image_service,
│                        #    audit_service, webhook_*, publish_scheduler,
│                        #    audit_cleanup, trash_cleanup,
│                        #    usage_aggregation, anomaly_detection,
│                        #    demo_mode)
└── utils/               # Shared utility functions
```

## Application State

The `AppState` struct is held in an `axum::extract::State<AppState>` and injected into every handler that asks for it:

```rust
pub struct AppState {
    pub db: PgPool,                                      // PostgreSQL connection pool
    pub settings: Settings,                              // Loaded configuration
    pub redis: Option<redis::aio::ConnectionManager>,    // Rate limiting (optional)
    pub clerk_service: Option<Arc<ClerkService>>,        // Clerk user management
    pub storage: Arc<dyn StorageBackend>,                // Media file storage
}
```

## Handler-Service-Model Pattern

Requests flow through three layers:

### Handlers (`handlers/`)

Handlers are plain Axum async functions. Each one is annotated with a `#[utoipa::path]` macro that drives both the OpenAPI doc and (via `utoipa_axum::routes!`) the route registration:

```rust
#[utoipa::path(
    get,
    path = "/sites/{site_id}/blogs",
    responses(
        (status = 200, description = "List of blogs", body = Vec<BlogResponse>),
    ),
    security(("api_key" = []))
)]
pub async fn list_blogs(
    State(state): State<AppState>,
    auth: AuthenticatedKey,
    Path(site_id): Path<Uuid>,
    Query(params): Query<BlogQueryParams>,
) -> Result<Json<Vec<BlogResponse>>, ApiError> {
    // ...
}
```

The extractor order is part of the function signature: state, auth, path params, query params, body. Each is a `FromRequestParts` (state, auth, path, query) or `FromRequest` (JSON body) impl that runs before the handler body executes.

Handlers are responsible for:
- Extracting and validating request parameters
- Checking authorization (via `auth.require_site_role()` or `auth.ensure_site_access()`)
- Calling the model or service layer
- Mapping results to response DTOs

### Services (`services/`)

Services contain business logic that spans multiple models or involves external systems. Not every handler needs a service -- simple CRUD operations go directly to the model.

Examples of service-layer concerns:
- `storage.rs` -- abstracting local vs S3 file operations
- `clerk_service.rs` -- calling the Clerk API for user management
- `webhook_service.rs` -- delivering webhook events to registered URLs
- `image_service.rs` -- generating thumbnail and resized variants

### Models (`models/`)

Models are structs derived with `sqlx::FromRow` that map directly to database tables. Each model file contains async methods for database operations:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Blog {
    pub id: Uuid,
    pub site_id: Uuid,
    pub slug: String,
    pub status: ContentStatus,
    pub author_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Blog {
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> { ... }
    pub async fn list_for_site(pool: &PgPool, site_id: Uuid) -> Result<Vec<Self>, ApiError> { ... }
    pub async fn create(pool: &PgPool, dto: &CreateBlogDto) -> Result<Self, ApiError> { ... }
}
```

## DTOs

DTOs (Data Transfer Objects) define the shape of request and response bodies. They use `validator::Validate` for input validation and `utoipa::ToSchema` for OpenAPI schema generation:

```rust
#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateBlogRequest {
    #[validate(length(min = 1, max = 200))]
    pub slug: String,
    #[validate(length(min = 1, max = 500))]
    pub title: String,
    pub locale: String,
}
```

## Error Handling

All errors are returned as RFC 7807 Problem Details responses via the `ApiError` enum:

```rust
pub enum ApiError {
    NotFound(String),
    BadRequest(String),
    Validation(String),
    Unauthorized(String),
    Forbidden(String),
    Conflict(String),
    Database(String),
    Internal(String),
    ServiceUnavailable(String),
    RateLimited(String),
}
```

Each variant maps to an HTTP status code and produces a JSON response:

```json
{
  "type": "https://forja.dev/errors/not_found",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "Blog with id '550e8400' not found",
  "code": "NOT_FOUND"
}
```

The `ApiError` type implements Axum's `IntoResponse` trait, so handlers return `Result<Json<T>, ApiError>` and errors are automatically serialized into RFC 7807 ProblemDetails JSON.

## OpenAPI Documentation

All endpoints are documented using utoipa macros. The `axum_app/mod.rs` file declares an `AxumApiDoc` struct that registers shared schemas; per-handler `#[utoipa::path]` annotations are picked up automatically by the `utoipa_axum::routes!` macro when each module's `router()` is merged into the main `OpenApiRouter`.

```rust
#[derive(OpenApi)]
#[openapi(
    components(schemas(
        BlogResponse,
        CreateBlogRequest,
        // ... shared DTOs
    )),
    tags(/* domain tags */)
)]
pub struct AxumApiDoc;
```

The doc is then split (`axum_app/openapi_split.rs`) into a public **consumer** doc served at `/api-docs/consumer/` and a full **admin** doc at `/api-docs/admin/`. The split keeps admin-only endpoints out of the public Swagger surface.

## Module Registration

Adding a new domain to the backend requires changes in several places:

1. **Model** -- Create `models/new_thing.rs`, add to `models/mod.rs`
2. **DTO** -- Create `dto/new_thing.rs`, add to `dto/mod.rs`
3. **Handler** -- Create `axum_app/handlers/new_thing.rs` with handler functions + `pub fn router() -> OpenApiRouter<AppState>`. Merge that router into `axum_app::handlers::api_v1_router()` (or the root router for unauth public endpoints).
4. **OpenAPI schemas** -- Register any newly introduced response/request schemas in `AxumApiDoc` (`axum_app/mod.rs`); per-handler paths are picked up automatically by `utoipa_axum::routes!`.

## Configuration

Settings are loaded from environment variables with the `APP__` prefix (double underscore as separator). Common overrides like `DATABASE_URL`, `REDIS_URL`, and `CLERK_SECRET_KEY` are mapped directly:

| Environment Variable | Purpose | Default |
|---------------------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URL` | Redis connection for rate limiting | `redis://127.0.0.1:6379` |
| `CLERK_SECRET_KEY` | Clerk API secret for JWT validation | (disabled) |
| `CLERK_JWKS_URL` | JWKS endpoint for JWT key discovery | (derived from Clerk) |
| `STORAGE_PROVIDER` | `local` or `s3` | `local` |
| `APP__PORT` | Server port | `8000` |
| `APP__HOST` | Bind address | `0.0.0.0` |

## Background Services

The backend spawns long-running background workers when the server starts. They are launched together by `axum_app::workers::spawn_all(state)` (called once during boot), each running as an independent Tokio task for the lifetime of the process. The currently spawned workers are: `publish_scheduler`, `audit_cleanup`, `trash_cleanup`, `forms_retention_cleanup`, `usage_aggregation`, `anomaly_detection`, `demo_mode`, `site_export_worker`, `webhook_retry_worker`, and `webhook_flush_worker`.

### Multi-replica safety (single-leader convention)

Because `spawn_all` runs once **per process**, scaling the API past one replica would otherwise run every worker loop N times concurrently — wasted DB cycles for idempotent workers, and a real risk of duplicate emissions (webhook deliveries, scheduled publishes, anomaly alerts, site exports) for the non-idempotent ones.

Every worker wraps its tick body in `services::worker_lock::run_if_leader(pool, name, body)`. The helper:

1. Acquires a dedicated connection from the pool.
2. Runs `SELECT pg_try_advisory_lock(hashtext($name)::bigint)`.
3. If the lock is granted, executes the body, then releases the lock on the same connection.
4. If not, logs `skipped: leader held by another replica` at debug and returns — the next tick re-tries.

Locks are **session-scoped**: when the leader replica dies, its pool connections close, Postgres releases the held locks, and any surviving replica picks them up on its next tick. No coordinator service, no leader-election layer. Different worker names hash to different lock slots, so unrelated workers do not block each other.

When adding a new worker, follow the convention documented in `axum_app/workers.rs`: wrap the tick body in `worker_lock::run_if_leader(&pool, "<stable_name>", || …)` and pick a stable string identifier.

### Publish Scheduler

The publish scheduler enables timed content publishing. It runs on a **60-second polling interval**, checking for content whose `publish_start` timestamp has passed but whose status has not yet been set to Published.

- Spawned on server startup via `services::publish_scheduler::spawn(state)`
- Polls the database every 60 seconds for publishable content
- Auto-publishes content by setting its status to `Published`
- Supports regular content types (blogs, pages)
- Runs as a Tokio background task for the lifetime of the server
