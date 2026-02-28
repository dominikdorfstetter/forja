---
sidebar_position: 1
---

# Prerequisites

Before setting up OpenYapper, make sure the following tools are installed on your development machine.

## Required

### Rust 1.75+

The backend is written in Rust and requires version **1.75 or later** (the 2021 edition). Install via [rustup](https://rustup.rs/):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Verify your installation:

```bash
rustc --version   # should print 1.75.0 or higher
cargo --version
```

### Node.js 18+

The admin dashboard and frontend templates require Node.js **18 or later**. We recommend using [nvm](https://github.com/nvm-sh/nvm) to manage versions:

```bash
# Install nvm (if you don't have it)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash

# Install and use Node 18+
nvm install 20
nvm use 20
```

Verify:

```bash
node --version   # should print v18.x.x or higher
npm --version
```

### Docker & Docker Compose

OpenYapper uses Docker to run PostgreSQL, Redis, and pgAdmin during development. Install [Docker Desktop](https://docs.docker.com/get-docker/) (which includes Docker Compose).

Verify:

```bash
docker --version
docker compose version
```

### SQLx CLI

The backend uses [SQLx](https://github.com/launchbadge/sqlx) for database migrations. Install the CLI tool:

```bash
cargo install sqlx-cli --no-default-features --features rustls,postgres
```

Verify:

```bash
sqlx --version
```

### psql (PostgreSQL Client)

The seed script uses `psql` to load development data. It ships with any PostgreSQL installation:

- **macOS (Homebrew):** `brew install libpq && brew link --force libpq`
- **Ubuntu/Debian:** `sudo apt install postgresql-client`
- **Arch:** `sudo pacman -S postgresql-libs`

Verify:

```bash
psql --version
```

## Optional

### Clerk Account

The admin dashboard uses [Clerk](https://clerk.com) for user authentication. You will need a free Clerk account to enable login in the admin UI.

1. Sign up at [clerk.com](https://clerk.com).
2. Create an application.
3. Copy your **Publishable Key** (`pk_test_...`) and **Secret Key** (`sk_test_...`).
4. You will add these to your `.env` during the [Configuration](./configuration) step.

:::tip
Clerk is optional for API-only usage. You can interact with the backend using API keys (`X-API-Key` header) without any Clerk setup.
:::

### pgAdmin (built-in)

A pgAdmin instance is included in the Docker Compose stack and available at [localhost:5050](http://localhost:5050) after starting Docker. Default credentials:

| Field | Value |
|-------|-------|
| Email | `admin@openyapper.dev` |
| Password | `admin` |

## Summary

| Tool | Version | Install |
|------|---------|---------|
| Rust | 1.75+ | `rustup` |
| Node.js | 18+ | `nvm` or [nodejs.org](https://nodejs.org) |
| Docker | Latest | [docker.com](https://docs.docker.com/get-docker/) |
| SQLx CLI | Latest | `cargo install sqlx-cli` |
| psql | Any | System package manager |
| Clerk | -- | [clerk.com](https://clerk.com) (optional) |

Once everything is installed, proceed to [Installation](./installation).
