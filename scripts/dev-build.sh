#!/usr/bin/env bash
# dev-build.sh — Build OpenYapper components
#
# Usage:
#   ./scripts/dev-build.sh              # Build admin + backend (debug)
#   ./scripts/dev-build.sh --admin      # Build admin only
#   ./scripts/dev-build.sh --backend    # Build backend only
#   ./scripts/dev-build.sh --release    # Build backend in release mode

source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

BUILD_ADMIN=true
BUILD_BACKEND=true
RELEASE_MODE=false

show_help() {
  cat <<EOF
${BOLD}dev-build.sh${NC} — Build OpenYapper components

${BOLD}Usage:${NC}
  ./scripts/dev-build.sh [options]

${BOLD}Options:${NC}
  --admin      Build admin dashboard only
  --backend    Build backend only
  --release    Build backend in release mode
  --help       Show this help message

${BOLD}Examples:${NC}
  ./scripts/dev-build.sh                 # Build everything (debug)
  ./scripts/dev-build.sh --backend --release  # Release build for backend
  ./scripts/dev-build.sh --admin         # Admin production build
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --admin)   BUILD_BACKEND=false; shift ;;
    --backend) BUILD_ADMIN=false; shift ;;
    --release) RELEASE_MODE=true; shift ;;
    --help|-h) show_help ;;
    *)         error "Unknown option: $1"; show_help ;;
  esac
done

# ── Build backend ──────────────────────────────────────────────────
if [[ "$BUILD_BACKEND" == true ]]; then
  require_rust
  header "Building backend"
  cd "$BACKEND_DIR"
  if [[ "$RELEASE_MODE" == true ]]; then
    info "Building in release mode..."
    cargo build --release
    success "Backend built (release) → target/release/"
  else
    info "Building in debug mode..."
    cargo build
    success "Backend built (debug) → target/debug/"
  fi
  cd "$PROJECT_ROOT"
fi

# ── Build admin ────────────────────────────────────────────────────
if [[ "$BUILD_ADMIN" == true ]]; then
  require_node
  header "Building admin dashboard"
  cd "$ADMIN_DIR"
  info "Installing dependencies..."
  npm install
  info "Building production bundle..."
  npm run build
  success "Admin built → backend/static/dashboard/"
  cd "$PROJECT_ROOT"
fi

echo ""
success "Build complete"
