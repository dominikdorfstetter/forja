#!/usr/bin/env bash
# dev-status.sh — Show status of all OpenYapper development services
#
# Usage:
#   ./scripts/dev-status.sh

source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

show_help() {
  cat <<EOF
${BOLD}dev-status.sh${NC} — Show status of all OpenYapper development services

${BOLD}Usage:${NC}
  ./scripts/dev-status.sh

${BOLD}Checks:${NC}
  - Docker containers (postgres, redis, pgadmin)
  - Backend API (port 8000)
  - Admin dashboard (port 5173)
  - Database connectivity
  - Redis connectivity
EOF
  exit 0
}

[[ "${1:-}" == "--help" || "${1:-}" == "-h" ]] && show_help

header "OpenYapper Development Status"

# ── Docker containers ──────────────────────────────────────────────
echo -e "${BOLD}Docker Containers:${NC}"

check_container() {
  local name="$1"
  local label="$2"
  if is_container_running "$name"; then
    echo -e "  ${GREEN}●${NC} $label ($name)"
  else
    echo -e "  ${RED}●${NC} $label ($name) — not running"
  fi
}

check_container "$DB_CONTAINER"      "PostgreSQL"
check_container "$REDIS_CONTAINER"   "Redis"
check_container "$PGADMIN_CONTAINER" "pgAdmin"

# ── Ports ──────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Service Ports:${NC}"

check_port() {
  local port="$1"
  local label="$2"
  if is_port_open "$port"; then
    echo -e "  ${GREEN}●${NC} $label (port $port)"
  else
    echo -e "  ${RED}●${NC} $label (port $port) — not listening"
  fi
}

check_port 5432 "PostgreSQL"
check_port 6379 "Redis"
check_port 5050 "pgAdmin"
check_port 8000 "Backend API"
check_port 5173 "Admin Dashboard"

# ── Database connectivity ──────────────────────────────────────────
echo ""
echo -e "${BOLD}Database:${NC}"

if is_container_running "$DB_CONTAINER"; then
  if docker exec "$DB_CONTAINER" pg_isready -U openyapper -d openyapper &>/dev/null; then
    echo -e "  ${GREEN}●${NC} PostgreSQL accepting connections"

    # Check migration status
    TABLE_COUNT=$(docker exec "$DB_CONTAINER" psql -U openyapper -d openyapper -t -c \
      "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
    if [[ -n "$TABLE_COUNT" && "$TABLE_COUNT" -gt 0 ]]; then
      echo -e "  ${GREEN}●${NC} Database has $TABLE_COUNT tables"
    else
      echo -e "  ${YELLOW}●${NC} Database has no tables — run ./scripts/dev-seed.sh"
    fi
  else
    echo -e "  ${RED}●${NC} PostgreSQL not accepting connections"
  fi
else
  echo -e "  ${RED}●${NC} PostgreSQL container not running"
fi

# ── Redis connectivity ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}Redis:${NC}"

if is_container_running "$REDIS_CONTAINER"; then
  PONG=$(docker exec "$REDIS_CONTAINER" redis-cli ping 2>/dev/null)
  if [[ "$PONG" == "PONG" ]]; then
    echo -e "  ${GREEN}●${NC} Redis responding"
  else
    echo -e "  ${RED}●${NC} Redis not responding"
  fi
else
  echo -e "  ${RED}●${NC} Redis container not running"
fi

# ── Backend .env ───────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Configuration:${NC}"

if [[ -f "$BACKEND_DIR/.env" ]]; then
  echo -e "  ${GREEN}●${NC} backend/.env exists"
else
  echo -e "  ${YELLOW}●${NC} backend/.env missing — copy from .env.example"
fi

echo ""
