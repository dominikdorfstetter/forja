---
sidebar_position: 2
---

# Installation

This guide walks you through cloning the repository, starting the infrastructure, and installing dependencies.

## 1. Clone the Repository

```bash
git clone https://github.com/dominikdorfstetter/openyapper.git
cd openyapper
```

## 2. Start Docker Services

OpenYapper ships with a `docker-compose.dev.yaml` that runs PostgreSQL 16, Redis 7, and pgAdmin:

```bash
docker compose -f docker-compose.dev.yaml up -d
```

This creates three containers:

| Container | Service | Port |
|-----------|---------|------|
| `openyapper-db` | PostgreSQL 16 | `5432` |
| `openyapper-redis` | Redis 7 | `6379` |
| `openyapper-pgadmin` | pgAdmin 4 | `5050` |

Verify they are running:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

:::tip
You can also use the dev script, which waits for health checks automatically:
```bash
./scripts/dev-start.sh
```
:::

## 3. Configure the Backend

Copy the example environment file and adjust values as needed:

```bash
cd backend
cp .env.example .env
```

The defaults work out of the box with the Docker services. The most important variable is already set:

```env
DATABASE_URL=postgres://openyapper:openyapper@localhost:5432/openyapper
```

If you have a Clerk account, add your keys now (see [Configuration](./configuration) for the full variable reference):

```env
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_JWKS_URL=https://your-clerk-domain.clerk.accounts.dev/.well-known/jwks.json
SYSTEM_ADMIN_CLERK_IDS=user_...
```

Return to the project root:

```bash
cd ..
```

## 4. Install Admin Dependencies

```bash
cd admin
npm install
cd ..
```

## 5. Quick Start with Dev Scripts

OpenYapper includes convenience scripts in the `scripts/` directory. The most common one starts everything at once:

```bash
# Start Docker infra + backend + admin in one command
./scripts/dev-start.sh --all
```

Other options:

```bash
./scripts/dev-start.sh              # Docker infra only
./scripts/dev-start.sh --backend    # Infra + Rust backend
./scripts/dev-start.sh --admin      # Infra + admin dashboard
```

### Available Dev Scripts

| Script | Purpose |
|--------|---------|
| `./scripts/dev-start.sh` | Start development environment |
| `./scripts/dev-stop.sh` | Stop all Docker services |
| `./scripts/dev-seed.sh` | Run migrations and seed the database |
| `./scripts/dev-build.sh` | Build backend and admin for production |
| `./scripts/dev-test.sh` | Run test suites |
| `./scripts/dev-clean.sh` | Remove containers, volumes, and build artifacts |
| `./scripts/dev-logs.sh` | Tail Docker container logs |
| `./scripts/dev-status.sh` | Show status of all services |

## Project Structure

After cloning, your directory should look like this:

```
openyapper/
├── admin/                 # React admin dashboard (Vite + MUI)
├── backend/               # Rust API server (Rocket 0.5 + SQLx)
│   ├── migrations/        # SQLx database migrations
│   ├── scripts/           # Backend-specific scripts (seed, init)
│   ├── src/               # Rust source code
│   └── .env.example       # Environment variable template
├── templates/
│   └── astro-blog/        # Astro frontend template
├── website/               # Docusaurus documentation site
├── scripts/               # Top-level dev scripts
└── docker-compose.dev.yaml
```

## Next Steps

Continue to [First Run](./first-run) to run migrations, seed the database, and verify your setup.
