#!/usr/bin/env bash
# dev-start.sh — Start OpenYapper development environment
#
# Usage:
#   ./scripts/dev-start.sh              # Start Docker infra only
#   ./scripts/dev-start.sh --all        # Start infra + backend + admin
#   ./scripts/dev-start.sh --backend    # Start infra + backend
#   ./scripts/dev-start.sh --admin      # Start infra + admin

source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

START_BACKEND=false
START_ADMIN=false

show_help() {
  cat <<EOF
${BOLD}dev-start.sh${NC} — Start OpenYapper development environment

${BOLD}Usage:${NC}
  ./scripts/dev-start.sh [options]

${BOLD}Options:${NC}
  --all        Start Docker infra + backend + admin
  --backend    Also start the Rust backend (cargo run)
  --admin      Also start the admin dashboard (npm run dev)
  --help       Show this help message

${BOLD}Examples:${NC}
  ./scripts/dev-start.sh              # Docker infra only
  ./scripts/dev-start.sh --all        # Everything
  ./scripts/dev-start.sh --backend    # Infra + backend
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)     START_BACKEND=true; START_ADMIN=true; shift ;;
    --backend) START_BACKEND=true; shift ;;
    --admin)   START_ADMIN=true; shift ;;
    --help|-h) show_help ;;
    *)         error "Unknown option: $1"; show_help ;;
  esac
done

require_docker

# ── Start Docker services ──────────────────────────────────────────
header "Starting Docker services"
dc up -d
success "Docker services started"

# Wait for Postgres to be healthy
info "Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
  if docker exec "$DB_CONTAINER" pg_isready -U openyapper -d openyapper &>/dev/null; then
    success "PostgreSQL is ready"
    break
  fi
  if [[ $i -eq 30 ]]; then
    error "PostgreSQL did not become ready in time"
    exit 1
  fi
  sleep 1
done

# Wait for Redis to be healthy
info "Waiting for Redis to be ready..."
for i in $(seq 1 15); do
  if docker exec "$REDIS_CONTAINER" redis-cli ping &>/dev/null; then
    success "Redis is ready"
    break
  fi
  if [[ $i -eq 15 ]]; then
    error "Redis did not become ready in time"
    exit 1
  fi
  sleep 1
done

# ── Start backend ──────────────────────────────────────────────────
if [[ "$START_BACKEND" == true ]]; then
  require_rust
  header "Starting backend"
  info "Running cargo run in $BACKEND_DIR ..."
  cd "$BACKEND_DIR"
  cargo run &
  BACKEND_PID=$!
  info "Backend started (PID: $BACKEND_PID)"
  cd "$PROJECT_ROOT"
fi

# ── Start admin ────────────────────────────────────────────────────
if [[ "$START_ADMIN" == true ]]; then
  require_node
  header "Starting admin dashboard"
  info "Running npm run dev in $ADMIN_DIR ..."
  cd "$ADMIN_DIR"
  npm run dev &
  ADMIN_PID=$!
  info "Admin dashboard started (PID: $ADMIN_PID)"
  cd "$PROJECT_ROOT"
fi

# ── Summary ────────────────────────────────────────────────────────
header "Services"
echo -e "  PostgreSQL:  ${GREEN}localhost:5432${NC}"
echo -e "  Redis:       ${GREEN}localhost:6379${NC}"
echo -e "  pgAdmin:     ${GREEN}http://localhost:5050${NC}"
[[ "$START_BACKEND" == true ]] && echo -e "  Backend API: ${GREEN}http://localhost:8000${NC}"
[[ "$START_ADMIN" == true ]]   && echo -e "  Admin UI:    ${GREEN}http://localhost:5173${NC}"
echo ""

if [[ "$START_BACKEND" == true ]] || [[ "$START_ADMIN" == true ]]; then
  info "Press Ctrl+C to stop foreground services"
  wait
fi
