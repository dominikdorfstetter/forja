---
sidebar_position: 2
---

# Backend Development Guide

This guide explains how to add new features to the OpenYapper Rust backend. It covers the standard pattern for creating a new model, DTO, and handler, and how to register everything so it appears in the API and Swagger documentation.

## Architecture Overview

Every API resource follows a three-layer pattern:

1. **Model** (`src/models/`) -- Database representation and queries using SQLx.
2. **DTO** (`src/dto/`) -- Request and response types with validation and OpenAPI schemas.
3. **Handler** (`src/handlers/`) -- Route handlers that wire together models, DTOs, and business logic.

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

Create a new file in `backend/src/handlers/`. Handlers use `#[utoipa::path(...)]` macros for Swagger documentation.

```rust
// backend/src/handlers/bookmark.rs

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
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
#[get("/sites/<site_id>/bookmarks?<page>&<per_page>")]
pub async fn list_bookmarks(
    state: &State<AppState>,
    site_id: Uuid,
    page: Option<i64>,
    per_page: Option<i64>,
    _auth: ReadKey,
) -> Result<Json<PaginatedBookmarks>, ApiError> {
    let params = PaginationParams::new(page, per_page);
    let (limit, offset) = params.limit_offset();

    let bookmarks = Bookmark::find_all_for_site(&state.db, site_id, limit, offset).await?;
    let total = 0i64; // Replace with actual count query
    let items: Vec<BookmarkResponse> = bookmarks.into_iter().map(BookmarkResponse::from).collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

/// Collect all bookmark routes
pub fn routes() -> Vec<Route> {
    routes![list_bookmarks]
}
```

## Step 4: Register Everything

Three files need to be updated:

### 4a. `backend/src/handlers/mod.rs`

Add the module declaration and extend `routes()`:

```rust
pub mod bookmark;

pub fn routes() -> Vec<Route> {
    let mut routes = Vec::new();
    // ... existing routes ...
    routes.extend(bookmark::routes());
    routes
}
```

### 4b. `backend/src/openapi.rs`

Add paths and schemas to the `#[openapi(...)]` attribute:

```rust
#[derive(OpenApi)]
#[openapi(
    // ...
    tags(
        // ... existing tags ...
        (name = "Bookmarks", description = "Bookmark management")
    ),
    paths(
        // ... existing paths ...
        crate::handlers::bookmark::list_bookmarks,
    ),
    // schemas are auto-discovered via ToSchema
)]
pub struct ApiDoc;
```

### 4c. `backend/src/models/mod.rs` and `backend/src/dto/mod.rs`

Add `pub mod bookmark;` to both files (already done in steps 1 and 2).

## Auth Guards

OpenYapper provides four auth guard types corresponding to the permission levels:

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

## Running the Backend

```bash
cd backend
cargo run
```

The API is available at `http://localhost:8000/api/v1` and Swagger UI at `http://localhost:8000/api-docs`.
