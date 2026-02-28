#!/usr/bin/env bash
# dev-test.sh — Run tests and linting for OpenYapper
#
# Usage:
#   ./scripts/dev-test.sh               # Run all tests + lint
#   ./scripts/dev-test.sh --backend     # Backend tests only
#   ./scripts/dev-test.sh --admin       # Admin tests only
#   ./scripts/dev-test.sh --integration # Backend integration tests
#   ./scripts/dev-test.sh --coverage    # Run with coverage reports

source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

RUN_BACKEND=true
RUN_ADMIN=true
RUN_INTEGRATION=false
COVERAGE=false

show_help() {
  cat <<EOF
${BOLD}dev-test.sh${NC} — Run tests and linting for OpenYapper

${BOLD}Usage:${NC}
  ./scripts/dev-test.sh [options]

${BOLD}Options:${NC}
  --backend      Run backend tests + linting only
  --admin        Run admin tests + linting only
  --integration  Include backend integration tests (requires running DB)
  --coverage     Generate coverage reports
  --help         Show this help message

${BOLD}Examples:${NC}
  ./scripts/dev-test.sh                      # All tests + lint
  ./scripts/dev-test.sh --backend --integration  # Backend with integration
  ./scripts/dev-test.sh --admin --coverage   # Admin with coverage
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend)     RUN_ADMIN=false; shift ;;
    --admin)       RUN_BACKEND=false; shift ;;
    --integration) RUN_INTEGRATION=true; shift ;;
    --coverage)    COVERAGE=true; shift ;;
    --help|-h)     show_help ;;
    *)             error "Unknown option: $1"; show_help ;;
  esac
done

EXIT_CODE=0

# ── Backend tests ──────────────────────────────────────────────────
if [[ "$RUN_BACKEND" == true ]]; then
  require_rust
  header "Backend — Formatting"
  cd "$BACKEND_DIR"
  if cargo fmt --check; then
    success "Formatting OK"
  else
    warn "Formatting issues found — run 'cargo fmt' to fix"
    EXIT_CODE=1
  fi

  header "Backend — Clippy"
  if cargo clippy -- -D warnings; then
    success "Clippy OK"
  else
    warn "Clippy warnings found"
    EXIT_CODE=1
  fi

  header "Backend — Unit tests"
  if cargo test --lib; then
    success "Unit tests passed"
  else
    error "Unit tests failed"
    EXIT_CODE=1
  fi

  if [[ "$RUN_INTEGRATION" == true ]]; then
    header "Backend — Integration tests"
    load_backend_env || true
    if cargo test --test integration_tests; then
      success "Integration tests passed"
    else
      error "Integration tests failed"
      EXIT_CODE=1
    fi
  fi

  cd "$PROJECT_ROOT"
fi

# ── Admin tests ────────────────────────────────────────────────────
if [[ "$RUN_ADMIN" == true ]]; then
  require_node
  header "Admin — Type check"
  cd "$ADMIN_DIR"
  if npm run typecheck; then
    success "Type check OK"
  else
    error "Type check failed"
    EXIT_CODE=1
  fi

  header "Admin — Lint"
  if npm run lint; then
    success "Lint OK"
  else
    warn "Lint issues found"
    EXIT_CODE=1
  fi

  header "Admin — Tests"
  if [[ "$COVERAGE" == true ]]; then
    if npm test -- --coverage; then
      success "Tests passed (with coverage)"
    else
      error "Tests failed"
      EXIT_CODE=1
    fi
  else
    if npm test; then
      success "Tests passed"
    else
      error "Tests failed"
      EXIT_CODE=1
    fi
  fi

  cd "$PROJECT_ROOT"
fi

# ── Summary ────────────────────────────────────────────────────────
echo ""
if [[ $EXIT_CODE -eq 0 ]]; then
  success "All checks passed"
else
  error "Some checks failed (exit code: $EXIT_CODE)"
fi

exit $EXIT_CODE
