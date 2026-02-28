#!/usr/bin/env bash
# _common.sh — Shared library for OpenYapper dev scripts
# Source this file: source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Project paths ───────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
ADMIN_DIR="$PROJECT_ROOT/admin"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.dev.yaml"

# ── Docker container names (from docker-compose.dev.yaml) ──────────
DB_CONTAINER="openyapper-db"
REDIS_CONTAINER="openyapper-redis"
PGADMIN_CONTAINER="openyapper-pgadmin"

# ── Output helpers ──────────────────────────────────────────────────
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*" >&2; }
header()  { echo -e "\n${BOLD}${CYAN}=== $* ===${NC}\n"; }

# ── Requirement checks ─────────────────────────────────────────────
require_cmd() {
  local cmd="$1"
  local install_hint="${2:-}"
  if ! command -v "$cmd" &>/dev/null; then
    error "'$cmd' is required but not installed."
    [[ -n "$install_hint" ]] && echo -e "  Install: ${YELLOW}${install_hint}${NC}"
    exit 1
  fi
}

require_docker() {
  require_cmd docker "https://docs.docker.com/get-docker/"
  if ! docker info &>/dev/null; then
    error "Docker daemon is not running."
    exit 1
  fi
}

require_rust() {
  require_cmd cargo "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
}

require_node() {
  require_cmd node "https://nodejs.org/"
  require_cmd npm "https://nodejs.org/"
}

require_sqlx() {
  require_cmd sqlx "cargo install sqlx-cli"
}

# ── Docker Compose wrapper ─────────────────────────────────────────
dc() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

# ── Load backend .env ──────────────────────────────────────────────
load_backend_env() {
  local env_file="$BACKEND_DIR/.env"
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source <(grep -v '^\s*#' "$env_file" | grep -v '^\s*$')
    set +a
  else
    warn "No backend .env file found at $env_file"
    return 1
  fi
}

# ── Port check ─────────────────────────────────────────────────────
is_port_open() {
  local port="$1"
  if command -v nc &>/dev/null; then
    nc -z localhost "$port" 2>/dev/null
  elif command -v lsof &>/dev/null; then
    lsof -i :"$port" &>/dev/null
  else
    return 1
  fi
}

# ── Container status ───────────────────────────────────────────────
is_container_running() {
  local name="$1"
  [[ "$(docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null)" == "true" ]]
}
