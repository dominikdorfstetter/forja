# =============================================================================
# Forja — Multi-stage Production Build (with cargo-chef dependency caching)
# =============================================================================
# Builds the admin dashboard (React) and backend API (Rust) into a single image.
#
# The cargo-chef pattern separates dependency compilation into its own Docker
# layer. Dependencies are only rebuilt when Cargo.toml/Cargo.lock change,
# not on every source code edit. This cuts rebuild time from ~60 min to ~5 min.
#
# Usage:
#   docker build -t forja .
#   docker run -p 8000:8000 --env-file backend/.env forja
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build admin dashboard
# ---------------------------------------------------------------------------
FROM node:24-alpine AS admin-build

WORKDIR /app/admin
COPY admin/package.json admin/package-lock.json* ./
RUN npm ci --ignore-scripts
COPY admin/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: cargo-chef — prepare dependency recipe
# ---------------------------------------------------------------------------
FROM rust:1.97-bookworm AS chef
RUN cargo install cargo-chef
WORKDIR /app/backend

# ---------------------------------------------------------------------------
# Stage 3: cargo-chef — plan (only depends on Cargo.toml + Cargo.lock)
# ---------------------------------------------------------------------------
FROM chef AS planner
COPY backend/Cargo.toml backend/Cargo.lock* ./
COPY backend/src/ src/
COPY backend/macros/ macros/
RUN cargo chef prepare --recipe-path recipe.json

# ---------------------------------------------------------------------------
# Stage 4: cargo-chef — cook dependencies (cached until Cargo.lock changes)
# ---------------------------------------------------------------------------
FROM chef AS deps

# Faster compilation settings for Docker builds
ENV CARGO_PROFILE_RELEASE_LTO=thin
ENV CARGO_PROFILE_RELEASE_CODEGEN_UNITS=4

COPY --from=planner /app/backend/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

# ---------------------------------------------------------------------------
# Stage 5: Build Rust backend (only recompiles source code, deps are cached)
# ---------------------------------------------------------------------------
FROM deps AS backend-build

# Faster compilation settings for Docker builds
ENV CARGO_PROFILE_RELEASE_LTO=thin
ENV CARGO_PROFILE_RELEASE_CODEGEN_UNITS=4

COPY backend/Cargo.toml backend/Cargo.lock* ./
COPY backend/src/ src/
COPY backend/macros/ macros/
COPY backend/scripts/ scripts/
COPY backend/resources/ resources/
COPY backend/migrations/ migrations/

# Copy admin build output into the expected location
COPY --from=admin-build /app/backend/static/dashboard/ static/dashboard/

RUN cargo build --release

# ---------------------------------------------------------------------------
# Stage 6: Runtime
# ---------------------------------------------------------------------------
# Debian 13 "trixie" (current stable as of 2026; bookworm entered LTS/oldstable
# 2026-06-10). Fewer outstanding CVEs than bookworm-slim. NOTE: trixie completed
# the 64-bit time_t transition, so libssl3 → libssl3t64 (libpq5 kept its name).
# `apt-get upgrade` patches the base layer's pre-installed packages, which is
# where most image-scanner CVE findings originate.
FROM debian:trixie-slim

RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    ca-certificates libssl3t64 libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 appuser

WORKDIR /app

COPY --from=backend-build /app/backend/target/release/forja ./forja
COPY --from=backend-build /app/backend/static/ ./static/
COPY --from=backend-build /app/backend/migrations/ ./migrations/

RUN mkdir -p /data/uploads && chown -R appuser:appuser /app /data

USER appuser

ENV APP__HOST=0.0.0.0
ENV APP__PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["./forja"]
