---
sidebar_position: 7
---

# CI/CD Pipeline

OpenYapper uses GitHub Actions for continuous integration. The pipeline runs on every push to `main` and on every pull request targeting `main`.

## Pipeline Overview

The CI configuration lives at `.github/workflows/ci.yml` and defines two parallel jobs:

```
┌─────────────────────────────────────────┐
│              CI Pipeline                │
├─────────────────┬───────────────────────┤
│  Backend (Rust) │    Admin (React)      │
│                 │                       │
│  1. Checkout    │  1. Checkout          │
│  2. Rust setup  │  2. Node.js 20 setup  │
│  3. Cache deps  │  3. npm install       │
│  4. Format check│  4. Type check        │
│  5. Clippy lint │  5. ESLint            │
│  6. Init DB     │  6. Tests             │
│  7. Unit tests  │                       │
│  8. Integ tests │                       │
└─────────────────┴───────────────────────┘
```

Both jobs run in parallel. The pipeline passes only when both jobs succeed.

## Backend Job

The backend job runs on `ubuntu-latest` with a PostgreSQL 16 service container.

### Service Container

A PostgreSQL 16 Alpine container starts automatically with health checks:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_USER: openyapper
      POSTGRES_PASSWORD: openyapper
      POSTGRES_DB: openyapper
    options: >-
      --health-cmd "pg_isready -U openyapper"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
    ports:
      - 5432:5432
```

### Steps

1. **Checkout** -- Uses `actions/checkout@v4`.

2. **Install Rust toolchain** -- Uses `dtolnay/rust-toolchain@stable` with `rustfmt` and `clippy` components.

3. **Cache cargo registry and build** -- Uses `actions/cache@v4` to cache `~/.cargo/registry`, `~/.cargo/git`, and `backend/target`. The cache key is based on `Cargo.lock`.

4. **Check formatting** -- `cargo fmt --check` fails the build if any file is not properly formatted.

5. **Lint with Clippy** -- `cargo clippy -- -D warnings` treats all warnings as errors.

6. **Initialize databases** -- Creates the required PostgreSQL extensions on both the main and test databases:
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "citext";
   CREATE EXTENSION IF NOT EXISTS "pg_trgm";
   ```
   Also creates a separate `openyapper_test` database for integration tests.

7. **Run unit tests** -- `cargo test --lib` runs all unit tests (no database required).

8. **Run integration tests** -- `cargo test --test integration_tests` runs tests against the test database using `TEST_DATABASE_URL`.

### Environment Variables

```yaml
env:
  DATABASE_URL: postgres://openyapper:openyapper@localhost:5432/openyapper
  TEST_DATABASE_URL: postgres://openyapper:openyapper@localhost:5432/openyapper_test
```

## Admin Job

The admin job runs on `ubuntu-latest` with Node.js 20.

### Steps

1. **Checkout** -- Uses `actions/checkout@v4`.

2. **Setup Node.js** -- Uses `actions/setup-node@v4` with Node.js 20.

3. **Install dependencies** -- `npm install` in the `admin/` directory.

4. **Type check** -- `npm run typecheck` runs the TypeScript compiler in check mode.

5. **Lint** -- `npm run lint` runs ESLint.

6. **Run tests** -- `npm test` runs the Vitest test suite.

## Caching Strategy

The backend job caches three directories:

| Path | Purpose |
|------|---------|
| `~/.cargo/registry` | Downloaded crate sources |
| `~/.cargo/git` | Git-based dependencies |
| `backend/target` | Compiled artifacts |

The cache key is `${{ runner.os }}-cargo-${{ hashFiles('backend/Cargo.lock') }}`, so the cache is invalidated whenever dependencies change. A restore key (`${{ runner.os }}-cargo-`) provides a fallback to the most recent cache.

## Triggers

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

The pipeline runs on:

- Every push to `main` (direct pushes and merged pull requests).
- Every pull request targeting `main` (opened, synchronized, reopened).

## Adding New Checks

To add a new CI step, edit `.github/workflows/ci.yml`. For example, to add a security audit:

```yaml
- name: Security audit
  run: cargo audit
```

Or to add an admin build check:

```yaml
- name: Build admin
  run: npm run build
```

## Running CI Checks Locally

Use the `dev-test.sh` script to run the same checks locally before pushing:

```bash
# Run all checks (matches CI)
./scripts/dev-test.sh

# Include integration tests (requires running database)
./scripts/dev-test.sh --integration
```
