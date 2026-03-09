# Forja Development Scripts

Helper scripts for managing the local development environment. Run from the repo root.

> Full documentation: **[dominikdorfstetter.github.io/forja](https://dominikdorfstetter.github.io/forja/)**

## Scripts

| Script | Description |
|--------|-------------|
| `dev-start.sh` | Start Docker infrastructure (PostgreSQL, Redis, pgAdmin) |
| `dev-stop.sh` | Stop containers (keeps volumes) |
| `dev-status.sh` | Show status of all development services |
| `dev-seed.sh` | Run migrations and seed the development database |
| `dev-build.sh` | Build admin dashboard and/or backend |
| `dev-test.sh` | Run all tests and linting |
| `dev-clean.sh` | Remove build artifacts (optionally Docker volumes) |
| `dev-logs.sh` | View Docker service logs |
| `forja-init.sh` | Production environment initializer (generates `.env` with secure secrets) |

## Usage

```bash
./scripts/dev-start.sh    # Start infra
./scripts/dev-seed.sh     # Migrate + seed
./scripts/dev-status.sh   # Check everything is running
```

All scripts source `_common.sh` for shared utilities and error handling.
