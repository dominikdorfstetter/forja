#!/usr/bin/env bash
# dev-clean.sh — Remove build artifacts and optionally Docker volumes
#
# Usage:
#   ./scripts/dev-clean.sh            # Clean build artifacts
#   ./scripts/dev-clean.sh --docker   # Also remove Docker volumes

source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

CLEAN_DOCKER=false

show_help() {
  cat <<EOF
${BOLD}dev-clean.sh${NC} — Remove build artifacts and optionally Docker volumes

${BOLD}Usage:${NC}
  ./scripts/dev-clean.sh [options]

${BOLD}Options:${NC}
  --docker    Also stop containers and remove Docker volumes
  --help      Show this help message

${BOLD}What gets cleaned:${NC}
  - backend/target/          (Rust build artifacts)
  - admin/node_modules/      (Node dependencies)
  - admin/dist/              (Admin production build)
  - backend/static/dashboard/ (Deployed admin build)
  --docker: Docker containers + volumes
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --docker)  CLEAN_DOCKER=true; shift ;;
    --help|-h) show_help ;;
    *)         error "Unknown option: $1"; show_help ;;
  esac
done

header "Cleaning build artifacts"

# Backend
if [[ -d "$BACKEND_DIR/target" ]]; then
  info "Removing backend/target/ ..."
  rm -rf "$BACKEND_DIR/target"
  success "Backend build artifacts removed"
else
  info "backend/target/ not found — skipping"
fi

# Admin node_modules
if [[ -d "$ADMIN_DIR/node_modules" ]]; then
  info "Removing admin/node_modules/ ..."
  rm -rf "$ADMIN_DIR/node_modules"
  success "Admin node_modules removed"
else
  info "admin/node_modules/ not found — skipping"
fi

# Admin dist
if [[ -d "$ADMIN_DIR/dist" ]]; then
  info "Removing admin/dist/ ..."
  rm -rf "$ADMIN_DIR/dist"
  success "Admin dist removed"
fi

# Deployed admin dashboard
if [[ -d "$BACKEND_DIR/static/dashboard" ]]; then
  info "Removing backend/static/dashboard/ ..."
  rm -rf "$BACKEND_DIR/static/dashboard"
  success "Deployed admin build removed"
fi

# Docker
if [[ "$CLEAN_DOCKER" == true ]]; then
  require_docker
  header "Cleaning Docker resources"
  warn "Stopping containers and removing volumes..."
  dc down -v
  success "Docker containers and volumes removed"
fi

echo ""
success "Clean complete"
