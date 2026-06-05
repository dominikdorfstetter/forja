#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Start the Astro dev server for a specific site (preview mode)
# ---------------------------------------------------------------------------
# Usage:
#   ./start-preview.sh <site-slug> [port]
#
# Examples:
#   ./start-preview.sh john-doe 4321
#   ./start-preview.sh techbites 4322
#
# Prerequisites:
#   - npm install (or pnpm install) in this directory
#   - A running backend at CMS_API_URL (default: http://localhost:8000/api/v1)
#   - A valid CMS_API_KEY
#
# The script resolves the site UUID from its slug, then starts the Astro
# dev server with the correct environment variables.
# ---------------------------------------------------------------------------
set -euo pipefail

SLUG="${1:?Usage: $0 <site-slug> [port]}"
PORT="${2:-4321}"

# Load .env if present (allows overriding CMS_API_URL / CMS_API_KEY)
if [[ -f "$(dirname "$0")/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$(dirname "$0")/.env"
  set +a
fi

API_URL="${CMS_API_URL:-http://localhost:8000/api/v1}"
API_KEY="${CMS_API_KEY:?CMS_API_KEY is required — set it in .env or export it}"

echo "→ Resolving site UUID for slug: ${SLUG}"

SITE_JSON=$(curl -sf -H "X-API-Key: ${API_KEY}" "${API_URL}/sites/by-slug/${SLUG}")
if [[ -z "${SITE_JSON}" ]]; then
  echo "✗ Could not find site with slug '${SLUG}'" >&2
  exit 1
fi

# Extract the id field (works with basic tools, no jq dependency)
SITE_ID=$(echo "${SITE_JSON}" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [[ -z "${SITE_ID}" ]]; then
  echo "✗ Failed to parse site ID from API response" >&2
  exit 1
fi

echo "→ Site ID: ${SITE_ID}"
echo "→ Starting Astro dev server on port ${PORT}..."

export CMS_API_URL="${API_URL}"
export CMS_API_KEY="${API_KEY}"
export CMS_SITE_ID="${SITE_ID}"

npx astro dev --port "${PORT}"
