---
sidebar_position: 4
---

# Testing

Forja has separate test suites for the backend (Rust) and admin dashboard (React). This guide covers how to run each suite and the available testing options.

## Quick Reference

| Command | What It Tests |
|---------|--------------|
| `./scripts/dev-test.sh` | Everything (backend + admin, lint + tests) |
| `./scripts/dev-test.sh --backend` | Backend only |
| `./scripts/dev-test.sh --admin` | Admin only |
| `./scripts/dev-test.sh --integration` | Include backend integration tests |
| `./scripts/dev-test.sh --coverage` | Generate coverage reports |
| `cd e2e && ./scripts/run-e2e.sh` | E2E tests (Cucumber + Playwright) |
| `cd e2e && npm test -- --tags "@auth"` | E2E tests by tag |

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

## E2E Tests (Cucumber + Playwright)

End-to-end tests live in `e2e/` and use [Cucumber](https://cucumber.io/) (Gherkin BDD) with [Playwright](https://playwright.dev/) for browser automation. They test the full application stack — backend, admin dashboard, and real Clerk authentication — across all 7 user roles.

### Setup

```bash
cd e2e
npm install
npx playwright install chromium
cp .env.example .env
# Edit .env with your Clerk development instance credentials
```

### Running E2E Tests

```bash
# Start test infrastructure (Postgres on :5433, Redis on :6380)
./scripts/setup-test-db.sh

# Start backend and admin dev server (in separate terminals)
cd backend && DATABASE_URL=postgres://forja:forja@localhost:5433/forja_test cargo run
cd admin && npm run dev

# Run all tests
npm test

# Run by tag
npm test -- --tags "@auth"
npm test -- --tags "@content and not @multilingual"

# Run a single feature file
npx cucumber-js features/auth/login.feature

# Run with visible browser (non-headless)
E2E_HEADLESS=false npm test

# Or use the convenience script (checks all services first)
./scripts/run-e2e.sh
```

### Feature Areas

| Tag | Feature | Scenarios |
|-----|---------|-----------|
| `@auth` | Login, profile, account deletion | 9 |
| `@sites` | Site CRUD, settings, deletion | 8 |
| `@members` | Invite, roles, removal, ownership | 14 |
| `@content` | Blogs, pages, documents, multilingual | 17 |
| `@api-keys` | API key management with permission caps | 8 |
| `@media` | Upload, folders, file management | 6 |
| `@webhooks` | Webhook CRUD and delivery logs | 5 |
| `@navigation` | Site navigation management | 4 |
| `@redirects` | URL redirect management | 3 |
| `@analytics` | Analytics dashboard | 3 |
| `@activity` | Activity log and notifications | 4 |
| `@social-links` | Social media links | 1 |
| `@system-admin` | System admin privileges | 3 |
| `@ui` | Empty states, pagination, filtering | 5 |

### Documentation Screenshots

E2E tests can capture screenshots for Docusaurus documentation using the step:

```gherkin
And I take a screenshot "sites/site-created"
```

Screenshots are saved to `docs/screenshots/` organized by feature area.

### Writing E2E Tests

1. Create or edit a `.feature` file in `e2e/features/<domain>/`
2. Use existing step definitions from `e2e/step-definitions/common/`
3. Add domain-specific steps in `e2e/step-definitions/<domain>.steps.ts`
4. Use `data-testid` attributes in admin components for reliable element selection
5. Run `npm run test:dry` to verify parsing before running

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

## Test Quality Standards

### Real-Life Scenarios

Tests model real-life user scenarios, not implementation internals.

- Name tests as user stories: `'admin can ban a user and sees confirmation'` — not `'calls mockBanUser with correct args'`.
- Prefer `userEvent` over `fireEvent` — simulate real interaction sequences (click, type, tab) rather than raw DOM events.
- Never assert on internal state or mock call counts as the primary assertion — assert on what the user sees or what the API receives.
- Structure test files by user journey, not by component method names.

```typescript
// Good — describes what the user experiences
it('editor can create a webhook and sees success message', ...);
it('viewer cannot see the delete button', ...);
it('shows validation error when URL exceeds 2048 characters', ...);

// Bad — describes implementation internals
it('calls apiService.createWebhook with correct params', ...);
it('sets isLoading to true', ...);
it('renders component without errors', ...);
```

### Validation Coverage

For every validated field, test the boundaries. This is mandatory, not optional.

| Scenario | Example |
|----------|---------|
| Valid input | `'https://example.com/hook'` — form submits |
| Empty / missing | `''` — required error shown |
| Boundary max | String of exactly `maxLength` characters — accepted |
| Over boundary | String of `maxLength + 1` — error shown |
| Wrong format | `'not-a-url'` — format error shown |

### Accessibility in Tests

Use semantic queries — if a test can't find an element by role or label, the element isn't accessible.

| Priority | Query | Use when |
|----------|-------|----------|
| 1st | `getByRole('button', { name: '...' })` | Interactive elements |
| 2nd | `getByLabelText('...')` | Form fields, tooltips |
| 3rd | `getByText('...')` | Static content |
| Last | `getByTestId('...')` | Fallback only |

Test keyboard navigation for custom widgets:

```typescript
it('dialog can be closed with Escape key', async () => {
  await userEvent.click(openButton);
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
```

Test focus management:

```typescript
it('focuses the first input when dialog opens', async () => {
  await userEvent.click(openButton);
  await waitFor(() => {
    expect(screen.getByLabelText(t('webhooks.form.url'))).toHaveFocus();
  });
});
```

### React Doctor

React Doctor analyzes component health: unnecessary re-renders, missing memoization, unstable references, and component complexity. The score must be **100** before any PR is submitted.

```bash
cd admin && npm run react-doctor:online
```

A score below 100 is a blocking failure. See [Quality Gates](./quality-gates) for common fixes.
```
