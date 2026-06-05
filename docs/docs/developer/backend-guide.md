---
sidebar_position: 2
---

# Backend Development Guide

This guide explains how to add new features to the Forja Rust backend. It covers the standard pattern for creating a new model, DTO, and handler, and how to register everything so it appears in the API and Swagger documentation.

## Architecture Overview

Every API resource follows a three-layer pattern:

1. **Model** (`src/models/`) -- Database representation and queries using SQLx.
2. **DTO** (`src/dto/`) -- Request and response types with validation and OpenAPI schemas.
3. **Handler** (`src/axum_app/handlers/`) -- Route handlers that wire together models, DTOs, and business logic.

## Step 1: Create the Model

Create a new file in `backend/src/models/`. The model struct derives `sqlx::FromRow` for automatic database mapping.

```rust
// backend/src/models/bookmark.rs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;

/// Bookmark model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Bookmark {
    pub id: Uuid,
    pub site_id: Uuid,
    pub title: String,
    pub url: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Bookmark {
    /// Find all bookmarks for a site (paginated)
    pub async fn find_all_for_site(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, ApiError> {
        let rows = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, title, url, description, created_at, updated_at
            FROM bookmarks
            WHERE site_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(site_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok(rows)
    }

    /// Find a single bookmark by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Self>, ApiError> {
        let row = sqlx::query_as::<_, Self>(
            "SELECT * FROM bookmarks WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        Ok(row)
    }

    /// Create a new bookmark
    pub async fn create(
        pool: &PgPool,
        site_id: Uuid,
        title: &str,
        url: &str,
        description: Option<&str>,
    ) -> Result<Self, ApiError> {
        let row = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO bookmarks (id, site_id, title, url, description)
            VALUES (gen_random_uuid(), $1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(site_id)
        .bind(title)
        .bind(url)
        .bind(description)
        .fetch_one(pool)
        .await?;

        Ok(row)
    }
}
```

Register the module in `backend/src/models/mod.rs`:

```rust
pub mod bookmark;
```

## Step 2: Create the DTOs

Create a new file in `backend/src/dto/`. DTOs derive `Validate` for request validation and `ToSchema` for OpenAPI generation.

```rust
// backend/src/dto/bookmark.rs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::models::bookmark::Bookmark;
use crate::utils::pagination::Paginated;

/// Request to create a bookmark
#[derive(Debug, Clone, Deserialize, Validate, ToSchema)]
#[schema(description = "Create a bookmark")]
pub struct CreateBookmarkRequest {
    #[schema(example = "Rust Book")]
    #[validate(length(min = 1, max = 255, message = "Title must be between 1 and 255 characters"))]
    pub title: String,

    #[schema(example = "https://doc.rust-lang.org/book/")]
    #[validate(url(message = "Must be a valid URL"))]
    pub url: String,

    #[schema(example = "The official Rust programming language book")]
    #[validate(length(max = 500, message = "Description cannot exceed 500 characters"))]
    pub description: Option<String>,
}

/// Response for a single bookmark
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct BookmarkResponse {
    pub id: Uuid,
    pub site_id: Uuid,
    pub title: String,
    pub url: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Bookmark> for BookmarkResponse {
    fn from(b: Bookmark) -> Self {
        Self {
            id: b.id,
            site_id: b.site_id,
            title: b.title,
            url: b.url,
            description: b.description,
            created_at: b.created_at,
            updated_at: b.updated_at,
        }
    }
}

/// Paginated bookmark list
pub type PaginatedBookmarks = Paginated<BookmarkResponse>;
```

Register the module in `backend/src/dto/mod.rs`:

```rust
pub mod bookmark;
```

## Step 3: Create the Handler

Create a new file in `backend/src/axum_app/handlers/`. Handlers use `#[utoipa::path(...)]` macros for Swagger documentation; the `utoipa_axum::routes!` macro wires the same path string into the runtime router.

```rust
// backend/src/axum_app/handlers/bookmark.rs

use axum::extract::{Path, Query, State};
use axum::Json;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;
use validator::Validate;

use crate::dto::bookmark::{
    BookmarkResponse, CreateBookmarkRequest, PaginatedBookmarks,
};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::models::bookmark::Bookmark;
use crate::utils::pagination::PaginationParams;
use crate::AppState;

/// List bookmarks for a site
#[utoipa::path(
    get,
    path = "/sites/{site_id}/bookmarks",
    tag = "Bookmarks",
    operation_id = "list_bookmarks",
    description = "List all bookmarks for a site (paginated)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("per_page" = Option<i64>, Query, description = "Items per page (default 10, max 100)")
    ),
    responses(
        (status = 200, description = "Paginated bookmark list", body = PaginatedBookmarks),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
    ),
    security(("api_key" = []))
)]
pub async fn list_bookmarks(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(pagination): Query<PaginationQuery>,
    _auth: ReadKey,
) -> Result<Json<PaginatedBookmarks>, ApiError> {
    let params = PaginationParams::new(pagination.page, pagination.per_page);
    let (limit, offset) = params.limit_offset();

    let bookmarks = Bookmark::find_all_for_site(&state.db, site_id, limit, offset).await?;
    let total = Bookmark::count_for_site(&state.db, site_id).await?;
    let items: Vec<BookmarkResponse> = bookmarks.into_iter().map(BookmarkResponse::from).collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

/// Collect all bookmark routes into an OpenAPI-aware sub-router.
pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(list_bookmarks))
}
```

## Step 4: Register Everything

Two files need to be updated:

### 4a. `backend/src/axum_app/handlers/mod.rs`

Add the module declaration and merge the new sub-router into the API v1 router:

```rust
pub mod bookmark;

pub fn api_v1_router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        // ... existing merges ...
        .merge(bookmark::router())
}
```

### 4b. `backend/src/axum_app/mod.rs`

If your handlers introduce new shared schemas (response/request DTOs that other modules also reference), register them in `AxumApiDoc`:

```rust
#[derive(OpenApi)]
#[openapi(
    components(schemas(
        // ... existing schemas ...
        BookmarkResponse,
        PaginatedBookmarks,
    )),
    tags(
        // ... existing tags ...
        (name = "Bookmarks", description = "Bookmark management")
    )
)]
pub struct AxumApiDoc;
```

Per-handler `#[utoipa::path]` annotations are picked up automatically by `routes!`, so you no longer need to list paths individually.

### 4c. `backend/src/models/mod.rs` and `backend/src/dto/mod.rs`

Add `pub mod bookmark;` to both files (already done in steps 1 and 2).

## Auth Guards

Forja provides four auth guard types corresponding to the permission levels:

| Guard | Permission Level | Use Case |
|-------|-----------------|----------|
| `ReadKey` | Read or higher | Listing and fetching resources |
| `WriteKey` | Write or higher | Creating and updating resources |
| `AdminKey` | Admin or higher | Managing site settings |
| `MasterKey` | Master only | System-level operations (API keys, etc.) |

Use the appropriate guard as a parameter in your handler function:

```rust
pub async fn list_items(_auth: ReadKey) -> ... { }
pub async fn create_item(_auth: WriteKey) -> ... { }
pub async fn delete_item(_auth: AdminKey) -> ... { }
pub async fn manage_keys(_auth: MasterKey) -> ... { }
```

## Validation

DTOs use the `validator` crate for request validation. Common validators:

```rust
#[validate(length(min = 1, max = 255))]
pub title: String,

#[validate(url)]
pub url: String,

#[validate(email)]
pub email: String,

#[validate(range(min = 1, max = 100))]
pub per_page: i64,

#[validate(custom(function = "validate_slug"))]
pub slug: String,
```

Call `.validate()` on the DTO in your handler before processing:

```rust
let body = body.into_inner();
body.validate().map_err(ApiError::validation)?;
```

## Error Handling

All handlers return `Result<T, ApiError>`. The `ApiError` type automatically converts to RFC 7807 Problem Details JSON responses. Common error constructors:

```rust
ApiError::not_found("Bookmark not found")
ApiError::forbidden("You do not have permission to access this resource")
ApiError::validation(validation_errors)
```

## Step 5: Create the Database Migration

Before the model can query anything, the table must exist. Create a migration:

```bash
cd backend
sqlx migrate add create_bookmarks
```

This creates a new `.sql` file in `backend/migrations/`. Write the migration SQL:

```sql
-- backend/migrations/20240101000049_create_bookmarks.sql

CREATE TABLE bookmarks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    url         TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for site-scoped queries (every content table needs this)
CREATE INDEX idx_bookmarks_site_id ON bookmarks(site_id);

-- Auto-update the updated_at column on modification
CREATE TRIGGER set_bookmarks_updated_at
    BEFORE UPDATE ON bookmarks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

Key conventions:
- **UUID primary keys** via `gen_random_uuid()`.
- **`site_id` foreign key** with `ON DELETE CASCADE` -- deleting a site removes all its content.
- **`updated_at` trigger** -- reuses the shared `update_updated_at_column()` function.
- Migrations are forward-only -- there are no down migrations.

The model also needs a count method for pagination:

```rust
impl Bookmark {
    pub async fn count_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let row = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM bookmarks WHERE site_id = $1",
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;

        Ok(row)
    }
}
```

## Audit Logging

Forja provides a fire-and-forget audit service. Audit logging never fails the request -- errors are logged but swallowed. Add audit calls in your handler after successful writes:

```rust
use crate::services::audit_service;
use crate::models::audit::AuditAction;

// After a successful create:
audit_service::log_action(
    &state.db,
    Some(site_id),
    auth.user_id(),       // Option<Uuid> from the auth guard
    AuditAction::Create,
    "bookmark",           // entity type string
    bookmark.id,          // entity UUID
    None,                 // optional JSON metadata
).await;
```

Webhook dispatch follows the same pattern:

```rust
use crate::services::webhook_service;

webhook_service::dispatch(
    &state.db,
    site_id,
    "bookmark.created",   // event type string
    bookmark.id,
    &serde_json::to_value(&response)?,
).await;
```

Both are fire-and-forget -- they log errors internally but never cause the handler to return an error to the client.

## Error Handling

All handlers return `Result<T, ApiError>`. The `ApiError` type converts to RFC 7807 Problem Details JSON. Beyond the basic constructors, you can attach domain-specific error codes:

```rust
use crate::errors::{ApiError, codes};

// Basic errors
ApiError::not_found("Bookmark not found")
ApiError::forbidden("You do not have permission to access this resource")
ApiError::validation(validation_errors)
ApiError::bad_request("Invalid URL format")
ApiError::conflict("A bookmark with this URL already exists")

// With domain-specific error codes
ApiError::not_found("Bookmark not found").with_code(codes::RESOURCE_NOT_FOUND)
```

Database constraint violations are automatically converted to appropriate API errors by the `From<sqlx::Error>` implementation.

## Testing

### Unit Tests

Add unit tests in a `#[cfg(test)]` block at the bottom of your model or handler file:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bookmark_response_from_model() {
        let bookmark = Bookmark {
            id: Uuid::new_v4(),
            site_id: Uuid::new_v4(),
            title: "Test".to_string(),
            url: "https://example.com".to_string(),
            description: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let response = BookmarkResponse::from(bookmark.clone());
        assert_eq!(response.title, bookmark.title);
        assert_eq!(response.url, bookmark.url);
    }
}
```

Run unit tests:

```bash
cd backend && cargo test --lib
```

### API Tests

Integration-style API tests live in `backend/tests/`. They test error response formats, validation, and serialization without requiring a running database:

```rust
// backend/tests/bookmark_tests.rs

#[test]
fn test_bookmark_not_found_returns_problem_details() {
    let error = ApiError::not_found("Bookmark not found");
    let details = error.to_problem_details();

    assert_eq!(details.status, 404);
    assert_eq!(details.title, "Resource Not Found");
    assert!(details.detail.unwrap().contains("Bookmark"));
}
```

Run all tests:

```bash
cd backend && cargo test
```

## Running the Backend

```bash
cd backend
cargo run
```

The API is available at `http://localhost:8000/api/v1` and Swagger UI at `http://localhost:8000/api-docs`.
