#!/bin/bash
# Development Initialization Script
#
# This script initializes the development database with sample data
# including a master API key for development access.
#
# Usage: ./scripts/dev_init.sh
#
# Environment Variables:
#   DATABASE_URL - PostgreSQL connection string (required)
#
# Example:
#   DATABASE_URL=postgres://user:pass@localhost/openyapper ./scripts/dev_init.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== OpenYapper API Development Initialization ===${NC}"
echo ""

# Check for DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    # Try to load from .env
    if [ -f "$SCRIPT_DIR/../.env" ]; then
        export $(grep -v '^#' "$SCRIPT_DIR/../.env" | xargs)
    fi
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
    echo ""
    echo "Please set DATABASE_URL or create a .env file in the backend directory"
    echo "Example: DATABASE_URL=postgres://user:pass@localhost/openyapper"
    exit 1
fi

echo -e "${GREEN}Database URL:${NC} ${DATABASE_URL%@*}@..."
echo ""

# Run migrations first
echo -e "${YELLOW}Running database migrations...${NC}"
cd "$SCRIPT_DIR/.."
cargo sqlx migrate run 2>/dev/null || {
    echo -e "${YELLOW}Note: Migrations may already be applied or sqlx-cli not installed${NC}"
    echo "You can install with: cargo install sqlx-cli"
}

echo ""
echo -e "${YELLOW}Initializing development data...${NC}"

# Run the SQL script
psql "$DATABASE_URL" -f "$SCRIPT_DIR/dev_init.sql"

echo ""
echo -e "${GREEN}=== Development Initialization Complete ===${NC}"
echo ""
echo -e "${YELLOW}Development API Keys:${NC}"
echo ""
echo -e "  Master Key (full access):"
echo -e "    ${GREEN}dk_devmast_00000000000000000000000000000000${NC}"
echo ""
echo -e "  Read Key (read-only):"
echo -e "    ${GREEN}dk_devread_00000000000000000000000000000000${NC}"
echo ""
echo -e "  Write Key (write access):"
echo -e "    ${GREEN}dk_devwrit_00000000000000000000000000000000${NC}"
echo ""
echo -e "${YELLOW}Example usage:${NC}"
echo "  curl -H 'X-API-Key: dk_devmast_00000000000000000000000000000000' \\"
echo "       http://localhost:8000/api/v1/sites"
echo ""
