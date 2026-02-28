---
sidebar_position: 6
---

# Coding Standards

This page documents the coding standards and style conventions enforced across the OpenYapper codebase. These checks run automatically in CI and should be verified locally before pushing.

## Backend (Rust)

### Formatting

All Rust code must be formatted with `cargo fmt`. The CI pipeline runs `cargo fmt --check` and fails if any file is not formatted.

```bash
# Check formatting (dry run)
cargo fmt --check

# Apply formatting
cargo fmt
```

The default `rustfmt` configuration is used. No custom `.rustfmt.toml` overrides are applied.

### Linting

Clippy is the standard Rust linter. All warnings are treated as errors in CI:

```bash
cargo clippy -- -D warnings
```

This catches common mistakes, performance issues, and non-idiomatic patterns. Fix all clippy warnings before pushing.

### Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Structs | PascalCase | `BlogPost`, `CreateBookmarkRequest` |
| Enum variants | PascalCase | `ApiKeyPermission::Master` |
| Functions | snake_case | `find_all_for_site()` |
| Variables | snake_case | `site_id`, `per_page` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_PAGE_SIZE` |
| Modules | snake_case | `navigation_menu` |
| Files | snake_case | `blog.rs`, `api_key.rs` |

### Code Organization

- **Models** (`src/models/`): One file per database table. Struct derives `sqlx::FromRow`. All database queries live as `impl` methods on the model.
- **DTOs** (`src/dto/`): One file per domain. Request types derive `Validate` + `ToSchema`. Response types derive `Serialize` + `ToSchema`.
- **Handlers** (`src/handlers/`): One file per domain. Each handler has a `#[utoipa::path(...)]` macro and a `pub fn routes() -> Vec<Route>` function.
- **Static patterns**: Use `lazy_static!` for compiled regex patterns, not `once_cell`.

### Documentation

Public functions and structs should have doc comments (`///`). Module-level docs use `//!`:

```rust
//! Blog post model
//!
//! Handles CRUD operations for blog posts.

/// Find a blog post by its slug within a site.
///
/// Returns `None` if no post matches the slug.
pub async fn find_by_slug(pool: &PgPool, site_id: Uuid, slug: &str) -> Result<Option<Self>, ApiError> {
    // ...
}
```

### Error Handling

- Return `Result<T, ApiError>` from all handler functions.
- Use the `?` operator for error propagation.
- Avoid `.unwrap()` in production code. Use `.expect("reason")` only when the condition is provably safe.

## Admin (React / TypeScript)

### TypeScript Strict Mode

TypeScript strict mode is enabled in `tsconfig.json`. This enforces:

- `strictNullChecks` -- no implicit `null` or `undefined`.
- `noImplicitAny` -- every variable must have a type.
- `strictFunctionTypes` -- function parameters are checked correctly.

### Linting

ESLint is configured for the admin project with recommended rules:

```bash
cd admin
npm run lint
```

### Type Checking

Run the TypeScript compiler in type-check-only mode:

```bash
cd admin
npm run typecheck
```

### Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `BookmarkList`, `SiteSelector` |
| Hooks | camelCase with `use` prefix | `useBookmarks`, `useSiteContext` |
| Interfaces/Types | PascalCase | `Bookmark`, `CreateBookmarkRequest` |
| Functions | camelCase | `fetchBookmarks`, `handleSubmit` |
| Files (components) | PascalCase | `BookmarksPage.tsx` |
| Files (utilities) | camelCase | `formatDate.ts` |
| CSS classes | camelCase (MUI `sx` prop) | `sx={{ marginBottom: 2 }}` |

### Component Patterns

- Use function components with hooks (no class components).
- Use React Query for server state management.
- Use react-hook-form + zod for forms and validation.
- Use Material UI components for UI consistency.
- Keep page components in `src/pages/` and reusable components in `src/components/`.

### API Types

Types in `src/types/api.ts` must mirror the backend DTOs. When a backend DTO changes, update the corresponding TypeScript interface immediately.

## Pre-Push Checklist

Before pushing code, run the full test suite locally:

```bash
./scripts/dev-test.sh
```

This runs all formatting checks, linting, type checking, and tests for both the backend and admin. The script exits with a non-zero code if any check fails.
