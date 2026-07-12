---
sidebar_position: 1
---

# Project Structure

Forja is organized as a monorepo with clearly separated concerns. This page describes the top-level layout and the purpose of each directory.

## Top-Level Layout

```
forja/
├── backend/                # Rust API server (Axum 0.8 + SQLx)
├── admin/                  # React admin dashboard (Vite + MUI)
├── templates/              # Frontend templates that consume the API
│   └── astro-blog/         # Astro SSR blog/portfolio template
├── libs/                   # Shared TypeScript libraries (@forja/analytics, etc.)
├── e2e/                    # End-to-end tests (Cucumber + Playwright)
├── scripts/                # Developer helper scripts
├── docs/                   # Docusaurus documentation site
├── .github/
│   └── workflows/
│       └── ci.yml          # GitHub Actions CI pipeline
├── docker-compose.dev.yaml # Local development infrastructure
├── Dockerfile              # Multi-stage production build
└── README.md
```

## Backend (`backend/`)

The Rust backend is the core of Forja. It serves the JSON API, the admin dashboard static files, and handles all business logic.

```
backend/
├── src/
│   ├── main.rs             # tokio::main → boot guards → router build
│   │                       # → axum::serve / axum_server::bind_rustls
│   ├── lib.rs              # Library re-exports
│   ├── axum_app/
│   │   ├── mod.rs          # Router assembly + AxumApiDoc
│   │   ├── handlers/       # Route handlers, one file per domain
│   │   │   ├── blog.rs     # Each handler annotated with #[utoipa::path]
│   │   │   ├── redirect.rs
│   │   │   └── ...
│   │   ├── middleware/     # Tower layers (CORS, security headers,
│   │   │                   #   request-id, rate-limit headers,
│   │   │                   #   public rate-limit, usage tracking)
│   │   ├── extractors.rs   # FromRequestParts impls (auth, ModuleGuard,
│   │   │                   #   CurrentSite, ClientIp, UserAgent)
│   │   ├── openapi_split.rs # Splits the OpenAPI doc into consumer + admin
│   │   └── workers.rs      # Background-worker spawn aggregator
│   ├── models/             # Database models (sqlx::FromRow structs)
│   │   ├── mod.rs          # Module declarations and re-exports
│   │   ├── blog.rs         # Blog post model
│   │   ├── site.rs         # Site model
│   │   └── ...
│   ├── dto/                # Data Transfer Objects (request/response types)
│   │   ├── mod.rs
│   │   ├── blog.rs         # Blog DTOs with Validate + ToSchema
│   │   └── ...
│   ├── guards/             # Auth-key wrapper types + ModuleGuard markers
│   │                       #   (the Axum extractors live in
│   │                       #   axum_app/extractors.rs)
│   ├── services/           # External integrations + background workers
│   │                       #   (storage, clerk_service, image_service,
│   │                       #    audit_service, webhook_*, publish_scheduler,
│   │                       #    audit_cleanup, trash_cleanup, …)
│   ├── utils/              # Shared utilities (pagination, validation, etc.)
│   └── errors/             # ApiError + RFC 7807 ProblemDetails
│       │                   #   (impl IntoResponse for ApiError)
│       ├── mod.rs
│       ├── api_error.rs
│       └── codes.rs
├── migrations/             # SQLx database migrations
│   ├── 20240101000000_extensions_and_enums.sql
│   ├── 20240101000001_core_infrastructure.sql
│   └── ...
├── scripts/
│   └── init-extensions.sql # PostgreSQL extension setup for Docker
├── static/
│   └── dashboard/          # Admin build output (populated at build time)
├── Cargo.toml
└── Cargo.lock
```

### Key Conventions

- **Models** live in `src/models/` and derive `sqlx::FromRow`. Each model has async methods for database operations (`find_all`, `find_by_id`, `create`, `update`, `delete`).
- **DTOs** live in `src/dto/` and derive `Validate` (from the `validator` crate) and `utoipa::ToSchema` for OpenAPI generation.
- **Handlers** live in `src/axum_app/handlers/` and use `#[utoipa::path(...)]` macros for auto-generated Swagger documentation. Each handler module exposes a `pub fn router() -> OpenApiRouter<AppState>` that's merged into the API v1 router.
- Every new module must be registered in two places: its own `mod.rs` file (model + DTO) and `axum_app/handlers/mod.rs` where the new sub-router is merged into `api_v1_router()`. Per-handler paths are picked up automatically by `utoipa_axum::routes!`.

## Admin (`admin/`)

The React admin dashboard is a single-page application built with Vite and Material UI.

```
admin/
├── src/
│   ├── App.tsx             # Root component with routing
│   ├── main.tsx            # Entry point
│   ├── components/         # Reusable UI components
│   ├── pages/              # Page-level components (one per route)
│   ├── services/
│   │   └── api.ts          # Axios-based API service layer
│   ├── types/
│   │   └── api.ts          # TypeScript types mirroring backend DTOs
│   ├── hooks/              # Custom React hooks (React Query wrappers)
│   ├── store/              # React context providers
│   └── utils/              # Shared utility functions
├── public/                 # Static assets
├── vite.config.ts          # Vite configuration (proxy to backend in dev)
├── tsconfig.json
├── package.json
└── package-lock.json
```

### Key Conventions

- Types in `src/types/api.ts` mirror the backend DTOs to maintain type safety across the stack.
- API calls go through `src/services/api.ts`, which uses Axios with interceptors for authentication.
- React Query is used for server state management; react-hook-form + zod for form handling and validation.

## Templates (`templates/`)

Frontend templates are standalone projects that consume the Forja API. They are designed to be cloned and customized.

```
templates/
└── astro-blog/             # Astro 7 SSR blog/portfolio template
    ├── src/
    │   ├── lib/api.ts      # API client
    │   ├── layouts/        # Astro layouts
    │   ├── components/     # Astro components
    │   ├── pages/          # Astro pages (file-based routing)
    │   └── styles/         # CSS with custom properties
    ├── astro.config.mjs
    ├── start-preview.sh    # Helper script for previewing a specific site
    └── package.json
```

## Scripts (`scripts/`)

Developer utility scripts for common tasks:

| Script | Purpose |
|--------|---------|
| `dev-start.sh` | Start the development environment (Docker services + backend + admin) |
| `dev-stop.sh` | Stop the development environment |
| `dev-build.sh` | Build backend and/or admin for production |
| `dev-test.sh` | Run tests and linting (backend and/or admin) |
| `dev-seed.sh` | Seed the database with demo content |
| `dev-clean.sh` | Clean build artifacts and Docker volumes |
| `dev-logs.sh` | View logs for Docker services |
| `dev-status.sh` | Show status of all development services |
| `_common.sh` | Shared shell functions used by other scripts |

All scripts accept `--help` for usage information.

## Infrastructure Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage production build (admin + backend + runtime) |
| `docker-compose.dev.yaml` | Local development services (Postgres, Redis, pgAdmin) |
| `.github/workflows/ci.yml` | GitHub Actions CI pipeline |

## Docs (`docs/`)

The Docusaurus documentation site you are currently reading. Contains all user-facing and developer-facing documentation.

```
docs/
├── docs/                   # Documentation markdown files
├── src/                    # Custom Docusaurus pages and components
├── static/                 # Static assets (images, etc.)
├── sidebars.ts             # Sidebar navigation configuration
├── docusaurus.config.ts    # Docusaurus configuration
└── package.json
```
