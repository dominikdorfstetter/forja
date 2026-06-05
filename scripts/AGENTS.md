# scripts — Dev & release helper scripts

Bash helpers for the local dev environment and releases. Run from the repo root.
All scripts source `_common.sh` for shared utilities and error handling.

| Script | Purpose |
|--------|---------|
| `dev-start.sh` / `dev-stop.sh` / `dev-status.sh` | Manage Docker infra (Postgres, Redis, pgAdmin). |
| `dev-seed.sh` | Run migrations + seed the dev database. |
| `dev-build.sh` | Build admin and/or backend. |
| `dev-test.sh` | Run all tests + linting (the full local gate). |
| `dev-clean.sh` | Remove build artifacts (optionally Docker volumes). |
| `dev-logs.sh` | Tail Docker service logs. |
| `forja-init.sh` | Production env initializer — generates `.env` with secure secrets. |
| `bump-version.sh` | Bump the project version for a release. |
| `check-openapi-drift.sh` | Fail if the committed OpenAPI spec is out of sync with the backend. |

## Conventions

- Keep new scripts idempotent and sourcing `_common.sh`; add a row here when you
  add one.
- `_common.sh` is a library, not an entry point — don't run it directly.
