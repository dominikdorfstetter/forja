# =============================================================================
# OpenYapper — Multi-stage Production Build
# =============================================================================
# Builds the admin dashboard (React) and backend API (Rust) into a single image.
#
# Usage:
#   docker build -t openyapper .
#   docker run -p 8000:8000 --env-file backend/.env openyapper
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build admin dashboard
# ---------------------------------------------------------------------------
FROM node:20-alpine AS admin-build

WORKDIR /app/admin
COPY admin/package.json admin/package-lock.json* ./
RUN npm ci --ignore-scripts
COPY admin/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: Build Rust backend
# ---------------------------------------------------------------------------
FROM rust:1.82-bookworm AS backend-build

# Reduce memory usage during compilation
ENV CARGO_PROFILE_RELEASE_LTO=thin
ENV CARGO_PROFILE_RELEASE_CODEGEN_UNITS=2

WORKDIR /app/backend
COPY backend/Cargo.toml backend/Cargo.lock* ./
COPY backend/src/ src/
COPY backend/migrations/ migrations/

# Copy admin build output into the expected location
COPY --from=admin-build /app/backend/static/dashboard/ static/dashboard/

RUN cargo build --release

# ---------------------------------------------------------------------------
# Stage 3: Runtime
# ---------------------------------------------------------------------------
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libssl3 libpq5 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=backend-build /app/backend/target/release/openyapper ./openyapper
COPY --from=backend-build /app/backend/static/ ./static/
COPY --from=backend-build /app/backend/migrations/ ./migrations/

ENV ROCKET_ADDRESS=0.0.0.0
ENV ROCKET_PORT=8000
EXPOSE 8000

CMD ["./openyapper"]
