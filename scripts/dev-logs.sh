#!/usr/bin/env bash
# dev-logs.sh — View Docker service logs
#
# Usage:
#   ./scripts/dev-logs.sh              # All service logs
#   ./scripts/dev-logs.sh -f           # Follow logs
#   ./scripts/dev-logs.sh postgres     # Specific service
#   ./scripts/dev-logs.sh --tail 50    # Last 50 lines

source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

FOLLOW=false
TAIL=""
SERVICE=""

show_help() {
  cat <<EOF
${BOLD}dev-logs.sh${NC} — View Docker service logs

${BOLD}Usage:${NC}
  ./scripts/dev-logs.sh [options] [service]

${BOLD}Options:${NC}
  -f, --follow     Follow log output
  --tail N         Show last N lines (default: all)
  --help           Show this help message

${BOLD}Services:${NC}
  postgres         PostgreSQL database
  redis            Redis cache
  pgadmin          pgAdmin web UI

${BOLD}Examples:${NC}
  ./scripts/dev-logs.sh -f                # Follow all logs
  ./scripts/dev-logs.sh --tail 100 postgres  # Last 100 Postgres lines
  ./scripts/dev-logs.sh redis             # All Redis logs
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -f|--follow)  FOLLOW=true; shift ;;
    --tail)       TAIL="$2"; shift 2 ;;
    --help|-h)    show_help ;;
    -*)           error "Unknown option: $1"; show_help ;;
    *)            SERVICE="$1"; shift ;;
  esac
done

require_docker

ARGS=()
[[ "$FOLLOW" == true ]] && ARGS+=("-f")
[[ -n "$TAIL" ]] && ARGS+=("--tail" "$TAIL")
[[ -n "$SERVICE" ]] && ARGS+=("$SERVICE")

dc logs "${ARGS[@]}"
