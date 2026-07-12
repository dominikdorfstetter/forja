---
sidebar_position: 7
---

# CI/CD Pipeline

Forja uses GitHub Actions for continuous integration. The pipeline runs on every push to `main` and on every pull request targeting `main`.

## Pipeline Overview

The CI configuration lives at `.github/workflows/ci.yml` and defines two parallel jobs. A separate security scan workflow (`.github/workflows/security-scan.yml`) runs vulnerability scanning -- see [Security Scanning](#security-scanning) below.

```
┌─────────────────────────────────────────┐
│              CI Pipeline                │
├─────────────────┬───────────────────────┤
│  Backend (Rust) │    Admin (React)      │
│                 │                       │
│  1. Checkout    │  1. Checkout          │
│  2. Rust setup  │  2. Node.js 24 setup  │
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
      POSTGRES_USER: forja
      POSTGRES_PASSWORD: forja
      POSTGRES_DB: forja
    options: >-
      --health-cmd "pg_isready -U forja"
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
   Also creates a separate `forja_test` database for integration tests.

7. **Run unit tests** -- `cargo test --lib` runs all unit tests (no database required).

8. **Run integration tests** -- `cargo test --test integration_tests` runs tests against the test database using `TEST_DATABASE_URL`.

### Environment Variables

```yaml
env:
  DATABASE_URL: postgres://forja:forja@localhost:5432/forja
  TEST_DATABASE_URL: postgres://forja:forja@localhost:5432/forja_test
```

## Admin Job

The admin job runs on `ubuntu-latest` with Node.js 24.

### Steps

1. **Checkout** -- Uses `actions/checkout@v4`.

2. **Setup Node.js** -- Uses `actions/setup-node@v4` with Node.js 24.

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

To add a new CI step, edit `.github/workflows/ci.yml`. For example, to add an admin build check:

```yaml
- name: Build admin
  run: npm run build
```

For security-related checks, add them to `.github/workflows/security-scan.yml` instead.

## Security Scanning

A separate workflow (`.github/workflows/security-scan.yml`) runs automated vulnerability scanning across the full stack. It triggers on pushes to `main`, pull requests, and on a weekly schedule (Mondays at 06:00 UTC).

```
┌──────────────────────────────────────────────────┐
│            Security Scan Pipeline                │
├────────────────┬────────────────┬────────────────┤
│  cargo-audit   │   npm audit    │   Trivy        │
│                │                │                │
│  Rust dep CVEs │  Node.js dep   │  Filesystem    │
│  via RustSec   │  CVEs (high+)  │  HIGH+CRITICAL │
│  advisory DB   │  admin/ +      │  full repo     │
│                │  libs/*        │                │
└────────────────┴────────────────┴────────────────┘
```

### cargo-audit

Scans Rust dependencies against the [RustSec Advisory Database](https://rustsec.org/). Runs in the `backend/` directory using the configuration at `backend/.cargo/audit.toml`, which can suppress known advisories with justification.

### npm audit

Runs `npm audit --omit=dev --audit-level=high` in `admin/` and all `libs/` packages. Only production dependencies are checked; dev-only vulnerabilities are excluded.

### Trivy

[Trivy](https://github.com/aquasecurity/trivy) performs a filesystem scan of the entire repository, catching vulnerabilities across languages as well as secrets or misconfigurations. Only HIGH and CRITICAL severity issues with available fixes cause the pipeline to fail.

### Path Filtering

The security scan only runs when relevant files change (e.g., `backend/**`, `admin/**`, `libs/**`, `docs/**`), keeping CI fast for documentation-only PRs.

## React Doctor (PR only)

React Doctor runs as an additional check on pull requests to enforce frontend component health. It checks for unnecessary re-renders, missing memoization, unstable references, and component complexity.

The CI step uses the `millionco/react-doctor@main` GitHub Action and runs only on pull requests targeting `main`. The score must be **100** — any score below is a blocking failure.

**Local equivalent:**

```bash
cd admin && npm run react-doctor:online
```

Run this before submitting a PR if you changed any files in `admin/src/`. See [Quality Gates](./quality-gates) for common fixes and scoring details.

## Running CI Checks Locally

Use the `dev-test.sh` script to run the same checks locally before pushing:

```bash
# Run all checks (matches CI)
./scripts/dev-test.sh

# Include integration tests (requires running database)
./scripts/dev-test.sh --integration
```
