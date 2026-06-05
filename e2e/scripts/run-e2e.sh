#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_DIR="$(dirname "$SCRIPT_DIR")"

echo "============================================"
echo "  Forja E2E Test Runner"
echo "============================================"
echo ""

# Step 1: Set up test database
echo "==> Step 1: Setting up test database..."
"$SCRIPT_DIR/setup-test-db.sh"
echo ""

# Step 2: Verify backend is running
echo "==> Step 2: Checking backend..."
if curl -s --max-time 3 "http://localhost:8000/health" > /dev/null 2>&1; then
  echo "    Backend is running on :8000"
else
  echo "    WARNING: Backend is not running on :8000"
  echo "    Start it with: cd backend && cargo run"
  echo "    Make sure to set DATABASE_URL=postgres://forja:forja@localhost:5433/forja_test"
  exit 1
fi
echo ""

# Step 3: Verify admin dev server is running
echo "==> Step 3: Checking admin dev server..."
if curl -s --max-time 3 "http://localhost:3000" > /dev/null 2>&1; then
  echo "    Admin dev server is running on :3000"
else
  echo "    WARNING: Admin dev server is not running on :3000"
  echo "    Start it with: cd admin && npm run dev"
  exit 1
fi
echo ""

# Step 4: Run tests
echo "==> Step 4: Running Cucumber tests..."
cd "$E2E_DIR"
npx cucumber-js "$@"

echo ""
echo "==> E2E tests complete!"
echo "    Reports: $E2E_DIR/reports/"
echo "    Screenshots: $(dirname "$E2E_DIR")/docs/screenshots/"
