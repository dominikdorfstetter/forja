#!/usr/bin/env bash
set -euo pipefail

# Creates 7 test user accounts in Clerk for e2e testing.
# Uses the Clerk Backend API: https://clerk.com/docs/reference/backend-api
#
# Usage: ./scripts/create-test-users.sh
# Requires: CLERK_SECRET_KEY in ../backend/.env or E2E_CLERK_SECRET_KEY in .env

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$E2E_DIR")"

# Load secret key
if [ -f "$E2E_DIR/.env" ]; then
  CLERK_KEY=$(grep -E '^E2E_CLERK_SECRET_KEY=' "$E2E_DIR/.env" | cut -d= -f2-)
fi
if [ -z "${CLERK_KEY:-}" ] && [ -f "$PROJECT_ROOT/backend/.env" ]; then
  CLERK_KEY=$(grep -E '^CLERK_SECRET_KEY=' "$PROJECT_ROOT/backend/.env" | cut -d= -f2-)
fi

if [ -z "${CLERK_KEY:-}" ]; then
  echo "ERROR: No Clerk secret key found. Set E2E_CLERK_SECRET_KEY in e2e/.env"
  exit 1
fi

CLERK_API="https://api.clerk.com/v1"
TEST_PASSWORD="E2eTest!2026secure"

# Role → email mapping
declare -a ROLES=("viewer" "reviewer" "author" "editor" "admin" "owner" "system_admin")
declare -a FIRST_NAMES=("Viewer" "Reviewer" "Author" "Editor" "Admin" "Owner" "SysAdmin")
declare -a LAST_NAMES=("TestUser" "TestUser" "TestUser" "TestUser" "TestUser" "TestUser" "TestUser")

echo "============================================"
echo "  Creating Clerk Test Users for E2E"
echo "============================================"
echo ""

ENV_LINES=""
CREATED_IDS=""

for i in "${!ROLES[@]}"; do
  role="${ROLES[$i]}"
  first_name="${FIRST_NAMES[$i]}"
  last_name="${LAST_NAMES[$i]}"
  email="${role}@test.forja.dev"

  echo -n "Creating ${role} (${email})... "

  # Check if user already exists
  EXISTING=$(curl -s -H "Authorization: Bearer ${CLERK_KEY}" \
    "${CLERK_API}/users?email_address=${email}" | \
    python3 -c "import sys,json; data=json.load(sys.stdin); print(data[0]['id'] if data else '')" 2>/dev/null || echo "")

  if [ -n "$EXISTING" ]; then
    echo "already exists (${EXISTING})"
    USER_ID="$EXISTING"
  else
    # Create the user
    RESPONSE=$(curl -s -X POST "${CLERK_API}/users" \
      -H "Authorization: Bearer ${CLERK_KEY}" \
      -H "Content-Type: application/json" \
      -d "{
        \"email_address\": [\"${email}\"],
        \"password\": \"${TEST_PASSWORD}\",
        \"first_name\": \"${first_name}\",
        \"last_name\": \"${last_name}\",
        \"skip_password_checks\": true
      }")

    USER_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

    if [ -z "$USER_ID" ]; then
      ERROR=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('errors',[{}])[0].get('message','unknown error'))" 2>/dev/null || echo "unknown error")
      echo "FAILED: ${ERROR}"
      echo "  Response: ${RESPONSE}"
      continue
    fi

    echo "created (${USER_ID})"
  fi

  # Build .env lines
  ROLE_UPPER=$(echo "$role" | tr '[:lower:]' '[:upper:]')
  ENV_LINES="${ENV_LINES}E2E_${ROLE_UPPER}_EMAIL=${email}\nE2E_${ROLE_UPPER}_PASSWORD=${TEST_PASSWORD}\n"

  if [ "$role" = "system_admin" ]; then
    CREATED_IDS="${CREATED_IDS}${USER_ID}"
  else
    CREATED_IDS="${CREATED_IDS}${USER_ID},"
  fi
done

echo ""
echo "============================================"
echo "  Done! Add these to your e2e/.env:"
echo "============================================"
echo ""
printf "$ENV_LINES"
echo ""
echo "============================================"
echo "  System Admin Clerk ID (add to backend .env SYSTEM_ADMIN_CLERK_IDS):"
echo "============================================"
echo ""

# Extract just the system_admin ID (last one)
SYSADMIN_ID=$(echo "$CREATED_IDS" | tr ',' '\n' | tail -1)
echo "  SYSTEM_ADMIN_CLERK_IDS should include: ${SYSADMIN_ID}"
echo ""

# Auto-update e2e/.env if it exists
if [ -f "$E2E_DIR/.env" ]; then
  echo "Auto-updating e2e/.env..."
  for role in "${ROLES[@]}"; do
    ROLE_UPPER=$(echo "$role" | tr '[:lower:]' '[:upper:]')
    email="${role}@test.forja.dev"
    sed -i '' "s|^E2E_${ROLE_UPPER}_EMAIL=.*|E2E_${ROLE_UPPER}_EMAIL=${email}|" "$E2E_DIR/.env"
    sed -i '' "s|^E2E_${ROLE_UPPER}_PASSWORD=.*|E2E_${ROLE_UPPER}_PASSWORD=${TEST_PASSWORD}|" "$E2E_DIR/.env"
  done
  echo "e2e/.env updated!"
fi

# Auto-update seed SQL with actual Clerk user IDs
echo "Updating seed-test-data.sql with actual Clerk user IDs..."
declare -A ROLE_IDS
IFS=',' read -ra ID_ARRAY <<< "$CREATED_IDS"
for i in "${!ROLES[@]}"; do
  ROLE_IDS["${ROLES[$i]}"]="${ID_ARRAY[$i]:-}"
done

SEED_FILE="$SCRIPT_DIR/seed-test-data.sql"
if [ -f "$SEED_FILE" ]; then
  for role in viewer reviewer author editor admin owner; do
    OLD_PATTERN="'user_[^']*', 'a0000000-0000-0000-0000-000000000001', '${role}'"
    NEW_PATTERN="'${ROLE_IDS[$role]}', 'a0000000-0000-0000-0000-000000000001', '${role}'"
    sed -i '' "s|${OLD_PATTERN}|${NEW_PATTERN}|" "$SEED_FILE" 2>/dev/null || true
  done
  echo "seed-test-data.sql updated!"
fi
