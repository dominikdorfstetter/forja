#!/usr/bin/env bash
# dev-seed.sh — Run migrations and seed the development database
#
# Usage:
#   ./scripts/dev-seed.sh                # Run migrations + seed
#   ./scripts/dev-seed.sh --migrate-only # Run migrations only
#   ./scripts/dev-seed.sh --seed-only    # Run seed script only

source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

RUN_MIGRATE=true
RUN_SEED=true

show_help() {
  cat <<EOF
${BOLD}dev-seed.sh${NC} — Run migrations and seed the development database

${BOLD}Usage:${NC}
  ./scripts/dev-seed.sh [options]

${BOLD}Options:${NC}
  --migrate-only   Run only database migrations
  --seed-only      Run only the seed script (skip migrations)
  --help           Show this help message

${BOLD}Prerequisites:${NC}
  - Docker services running (use dev-start.sh)
  - sqlx-cli installed (cargo install sqlx-cli)
  - backend/.env configured with DATABASE_URL
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --migrate-only) RUN_SEED=false; shift ;;
    --seed-only)    RUN_MIGRATE=false; shift ;;
    --help|-h)      show_help ;;
    *)              error "Unknown option: $1"; show_help ;;
  esac
done

# Load DATABASE_URL from backend .env
load_backend_env || {
  error "Could not load backend .env — is it configured?"
  exit 1
}

if [[ -z "${DATABASE_URL:-}" ]]; then
  error "DATABASE_URL is not set. Check backend/.env"
  exit 1
fi

# Verify database is reachable
if ! docker exec "$DB_CONTAINER" pg_isready -U openyapper -d openyapper &>/dev/null; then
  error "PostgreSQL is not running. Start it with: ./scripts/dev-start.sh"
  exit 1
fi

# ── Run migrations ─────────────────────────────────────────────────
if [[ "$RUN_MIGRATE" == true ]]; then
  require_sqlx
  header "Running database migrations"
  cd "$BACKEND_DIR"
  sqlx migrate run
  success "Migrations complete"
  cd "$PROJECT_ROOT"
fi

# ── Run seed script ────────────────────────────────────────────────
if [[ "$RUN_SEED" == true ]]; then
  header "Seeding development data"
  local_seed="$BACKEND_DIR/scripts/dev_init.sh"
  if [[ -x "$local_seed" ]]; then
    "$local_seed"
    success "Seed data loaded"
  else
    error "Seed script not found or not executable: $local_seed"
    exit 1
  fi
fi

echo ""
success "Database is ready for development"
