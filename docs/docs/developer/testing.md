---
sidebar_position: 4
---

# Testing

OpenYapper has separate test suites for the backend (Rust) and admin dashboard (React). This guide covers how to run each suite and the available testing options.

## Quick Reference

| Command | What It Tests |
|---------|--------------|
| `./scripts/dev-test.sh` | Everything (backend + admin, lint + tests) |
| `./scripts/dev-test.sh --backend` | Backend only |
| `./scripts/dev-test.sh --admin` | Admin only |
| `./scripts/dev-test.sh --integration` | Include backend integration tests |
| `./scripts/dev-test.sh --coverage` | Generate coverage reports |

## Backend Tests (Rust)

### Unit Tests

Unit tests live alongside the source code in `backend/src/` and do not require a running database:

```bash
cd backend
cargo test --lib
```

### Integration Tests

Integration tests live in `backend/tests/` and require a running PostgreSQL instance with the test database:

```bash
cd backend
cargo test --test integration_tests
```

Before running integration tests, ensure:

1. PostgreSQL is running (start it with `docker compose -f docker-compose.dev.yaml up -d postgres`).
2. The `TEST_DATABASE_URL` environment variable is set, or the test database is configured in your `.env` file.
3. The required PostgreSQL extensions are installed on the test database:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

### Linting

The CI pipeline enforces formatting and lint checks:

```bash
cd backend

# Check formatting (fails if code is not formatted)
cargo fmt --check

# Fix formatting
cargo fmt

# Run clippy lints (fails on any warning)
cargo clippy -- -D warnings
```

## Admin Tests (React)

### Running Tests

```bash
cd admin
npm test
```

### Type Checking

TypeScript strict mode is enabled. Run the type checker independently:

```bash
cd admin
npm run typecheck
```

### Linting

ESLint is configured for the admin project:

```bash
cd admin
npm run lint
```

### Coverage Reports

Generate coverage reports by passing the `--coverage` flag:

```bash
cd admin
npm test -- --coverage
```

Or use the helper script:

```bash
./scripts/dev-test.sh --admin --coverage
```

## The `dev-test.sh` Script

The `dev-test.sh` script runs all checks in sequence and reports a summary at the end. It is the same set of checks that the CI pipeline runs.

```bash
# Run all checks (backend formatting, clippy, unit tests + admin typecheck, lint, tests)
./scripts/dev-test.sh

# Backend only, including integration tests
./scripts/dev-test.sh --backend --integration

# Admin only with coverage
./scripts/dev-test.sh --admin --coverage
```

The script exits with a non-zero code if any check fails, making it suitable for use in pre-commit hooks or local CI.

### What It Runs

For the backend:

1. `cargo fmt --check` -- formatting
2. `cargo clippy -- -D warnings` -- linting
3. `cargo test --lib` -- unit tests
4. `cargo test --test integration_tests` -- integration tests (only with `--integration` flag)

For the admin:

1. `npm run typecheck` -- TypeScript type checking
2. `npm run lint` -- ESLint
3. `npm test` -- Vitest test suite

## CI Pipeline

The GitHub Actions CI pipeline (`.github/workflows/ci.yml`) runs both test suites on every push to `main` and on every pull request. See [CI/CD](./ci-cd) for details.

## Writing Tests

### Backend Unit Tests

Place unit tests in a `#[cfg(test)]` module at the bottom of the source file:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_slug() {
        assert!(is_valid_slug("hello-world"));
        assert!(!is_valid_slug("Hello World!"));
    }
}
```

### Backend Integration Tests

Integration tests go in `backend/tests/` and use the test database:

```rust
// backend/tests/integration_tests/bookmark_tests.rs

use sqlx::PgPool;

#[sqlx::test]
async fn test_create_bookmark(pool: PgPool) {
    // Test against a real database
}
```

### Admin Tests

Admin tests use Vitest. Place test files next to the component they test with a `.test.tsx` or `.test.ts` extension:

```typescript
// admin/src/pages/BookmarksPage.test.tsx

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BookmarksPage from './BookmarksPage';

describe('BookmarksPage', () => {
  it('renders the page title', () => {
    render(<BookmarksPage />);
    expect(screen.getByText('Bookmarks')).toBeInTheDocument();
  });
});
```
