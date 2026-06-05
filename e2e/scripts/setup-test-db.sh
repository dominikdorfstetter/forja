#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$E2E_DIR")"

echo "==> Starting test database containers..."
docker compose -f "$E2E_DIR/docker-compose.test.yaml" up -d --wait

echo "==> Waiting for PostgreSQL to be ready..."
until docker compose -f "$E2E_DIR/docker-compose.test.yaml" exec -T postgres-test pg_isready -U forja -d forja_test 2>/dev/null; do
  sleep 1
done

echo "==> Running migrations..."
DATABASE_URL="postgres://forja:forja@localhost:5433/forja_test" \
  sqlx migrate run --source "$PROJECT_ROOT/backend/migrations"

echo "==> Seeding test data..."
PGPASSWORD=forja psql -h localhost -p 5433 -U forja -d forja_test \
  -f "$SCRIPT_DIR/seed-test-data.sql" 2>&1 | grep -v "already exists\|NOTICE\|DO NOTHING" || true

echo "==> Test database is ready!"
echo ""
echo "Connection string: postgres://forja:forja@localhost:5433/forja_test"
echo "Redis: redis://127.0.0.1:6380"
