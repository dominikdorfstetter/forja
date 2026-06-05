#!/usr/bin/env bash
# Regenerate admin/src/generated/api-types.ts from the backend OpenAPI spec
# and fail if the result differs from what's committed.
#
# Slice 5 of issue #623 — keeps the generated client honest. If a backend DTO
# changes without a regen-commit, this script catches it before merge.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GENERATED="$ROOT/admin/src/generated/api-types.ts"

if [[ ! -f "$GENERATED" ]]; then
  echo "error: $GENERATED does not exist — run 'npm run generate:openapi' inside admin/ first." >&2
  exit 1
fi

echo "Regenerating OpenAPI types..."
(cd "$ROOT/admin" && npm run generate:openapi --silent)

if ! git -C "$ROOT" diff --exit-code -- "$GENERATED"; then
  echo
  echo "error: admin/src/generated/api-types.ts is out of sync with the backend OpenAPI spec." >&2
  echo "Run 'npm run generate:openapi' in admin/ and commit the regenerated file." >&2
  exit 1
fi

echo "OpenAPI types are in sync."
