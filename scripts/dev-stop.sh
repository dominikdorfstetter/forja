#!/usr/bin/env bash
# dev-stop.sh — Stop OpenYapper development environment
#
# Usage:
#   ./scripts/dev-stop.sh              # Stop containers (keep volumes)
#   ./scripts/dev-stop.sh --volumes    # Stop containers and destroy volumes

source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

REMOVE_VOLUMES=false

show_help() {
  cat <<EOF
${BOLD}dev-stop.sh${NC} — Stop OpenYapper development environment

${BOLD}Usage:${NC}
  ./scripts/dev-stop.sh [options]

${BOLD}Options:${NC}
  --volumes    Also remove Docker volumes (destroys database data)
  --help       Show this help message
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --volumes|-v) REMOVE_VOLUMES=true; shift ;;
    --help|-h)    show_help ;;
    *)            error "Unknown option: $1"; show_help ;;
  esac
done

require_docker

header "Stopping Docker services"

if [[ "$REMOVE_VOLUMES" == true ]]; then
  warn "Removing volumes — all database data will be destroyed!"
  dc down -v
  success "Docker services stopped and volumes removed"
else
  dc down
  success "Docker services stopped (volumes preserved)"
fi
