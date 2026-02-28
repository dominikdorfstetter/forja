---
title: Backend Architecture
sidebar_position: 2
description: Rust backend architecture, directory structure, and request lifecycle.
---

# Backend Architecture

The OpenYapper backend is a REST API built with **Rust**, using the **Rocket 0.5** web framework. It communicates with PostgreSQL via **SQLx** (compile-time checked queries) and uses **utoipa** for OpenAPI specification generation.

## Directory Structure

```
backend/src/
├── main.rs              # Rocket launch, DB pool, Redis, CORS fairing
├── lib.rs               # Crate root, AppState definition
├── openapi.rs           # utoipa OpenAPI doc registration
├── config/
│   ├── mod.rs
│   ├── settings.rs      # Settings struct, env var loading
│   ├── database.rs      # DatabaseConfig (pool size, timeouts)
│   ├── security.rs      # SecurityConfig (rate limits, CORS, Clerk keys)
│   └── storage.rs       # StorageConfig (local vs S3 provider)
├── dto/                 # Data Transfer Objects (request/response schemas)
│   ├── mod.rs
│   ├── blog.rs
│   ├── page.rs
│   ├── media.rs
│   └── ...              # One file per domain
├── errors/
│   ├── mod.rs
│   └── api_error.rs     # ApiError enum + RFC 7807 ProblemDetails
├── guards/
│   ├── mod.rs
│   ├── auth_guard.rs    # AuthenticatedKey request guard (API key + Clerk JWT)
│   └── site_guard.rs    # Site resolution guard
├── handlers/
│   ├── mod.rs           # routes() function that mounts all handler groups
│   ├── blog.rs
│   ├── page.rs
│   ├── media.rs
│   ├── dashboard.rs     # Serves the admin SPA
│   ├── system.rs        # Health check, version info
│   └── ...              # One file per domain
├── middleware/
│   ├── mod.rs
│   └── rate_limit.rs    # Redis-backed rate limiter
├── models/
│   ├── mod.rs
│   ├── blog.rs
│   ├── page.rs
│   ├── api_key.rs       # API key validation, permission enum
│   └── ...              # One file per domain
├── services/
│   ├── mod.rs
│   ├── storage.rs       # StorageBackend trait (LocalStorage, S3Storage)
│   ├── clerk_service.rs # Clerk user management API client
│   ├── image_service.rs # Image resizing for media variants
│   ├── audit_service.rs # Audit log recording
│   ├── webhook_service.rs
│   ├── notification_service.rs
│   ├── content_service.rs
│   ├── bulk_content_service.rs
│   └── workflow_service.rs
└── utils/               # Shared utility functions
```

## Application State

The `AppState` struct is managed by Rocket and injected into every handler:

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

Handlers are Rocket route functions annotated with `#[get]`, `#[post]`, `#[put]`, `#[delete]` macros. Each handler also carries a `#[utoipa::path]` macro for OpenAPI documentation.

```rust
#[utoipa::path(
    get,
    path = "/sites/{site_id}/blogs",
    responses(
        (status = 200, description = "List of blogs", body = Vec<BlogResponse>),
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/blogs?<params..>")]
pub async fn list_blogs(
    state: &State<AppState>,
    auth: AuthenticatedKey,
    site_id: Uuid,
    params: BlogQueryParams,
) -> Result<Json<Vec<BlogResponse>>, ApiError> {
    // ...
}
```

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
  "type": "https://openyapper.dev/errors/not_found",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "Blog with id '550e8400' not found",
  "code": "NOT_FOUND"
}
```

The `ApiError` type implements Rocket's `Responder` trait, so handlers return `Result<Json<T>, ApiError>` and errors are automatically serialized.

## OpenAPI Documentation

All endpoints are documented using utoipa macros. The `openapi.rs` file registers all paths and schemas into a single `ApiDoc` struct:

```rust
#[derive(OpenApi)]
#[openapi(
    paths(
        handlers::blog::list_blogs,
        handlers::blog::get_blog,
        // ... all handler functions
    ),
    components(schemas(
        BlogResponse,
        CreateBlogRequest,
        // ... all DTOs
    ))
)]
pub struct ApiDoc;
```

Swagger UI is mounted at `/api-docs` and serves the interactive API explorer.

## Module Registration

Adding a new domain to the backend requires changes in several places:

1. **Model** -- Create `models/new_thing.rs`, add to `models/mod.rs`
2. **DTO** -- Create `dto/new_thing.rs`, add to `dto/mod.rs`
3. **Handler** -- Create `handlers/new_thing.rs`, add routes to `handlers/mod.rs`
4. **OpenAPI** -- Register paths and schemas in `openapi.rs`

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
