#!/usr/bin/env bash
# bump-version.sh — Set a consistent version across the entire Forja monorepo.
#
# Usage:
#   ./scripts/bump-version.sh 1.0.10
#   ./scripts/bump-version.sh          # prints current versions (dry-run)

source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Files that contain the Forja project version
VERSION_FILES=(
  "backend/Cargo.toml"
  "backend/macros/Cargo.toml"
  "admin/package.json"
  "docs/package.json"
  "libs/analytics/package.json"
  "libs/client/package.json"
  "libs/sections/package.json"
  "libs/sections-react/package.json"
  "e2e/package.json"
  "templates/astro-blog/package.json"
)

# ── Show current versions ────────────────────────────────────────────

show_versions() {
  echo -e "${BOLD}Current versions:${NC}"
  for file in "${VERSION_FILES[@]}"; do
    local full_path="$REPO_ROOT/$file"
    if [[ ! -f "$full_path" ]]; then
      echo -e "  ${YELLOW}$file${NC}: ${RED}not found${NC}"
      continue
    fi

    local version=""
    case "$file" in
      *.toml)
        version=$(grep -m1 '^version' "$full_path" | sed 's/.*"\(.*\)"/\1/')
        ;;
      *.json)
        version=$(grep -m1 '"version"' "$full_path" | sed 's/.*: *"\(.*\)".*/\1/')
        ;;
    esac

    if [[ -z "$version" ]]; then
      echo -e "  ${YELLOW}$file${NC}: ${RED}version not found${NC}"
    else
      echo -e "  ${CYAN}$file${NC}: $version"
    fi
  done
}

# ── Bump to target version ───────────────────────────────────────────

bump_version() {
  local target="$1"
  echo -e "${BOLD}Bumping all versions to ${GREEN}$target${NC}"
  echo ""

  for file in "${VERSION_FILES[@]}"; do
    local full_path="$REPO_ROOT/$file"
    if [[ ! -f "$full_path" ]]; then
      echo -e "  ${YELLOW}SKIP${NC} $file (not found)"
      continue
    fi

    case "$file" in
      *.toml)
        # Replace version on the line matching ^version = "..." (first match)
        sed -i '' '/^version = /s/= ".*"/= "'"$target"'"/' "$full_path"
        ;;
      *.json)
        # Replace first "version": "x.y.z" occurrence (within first 5 lines)
        sed -i '' '1,5{s/"version": ".*"/"version": "'"$target"'"/;}' "$full_path"
        ;;
    esac

    echo -e "  ${GREEN}OK${NC} $file"
  done

  # Update package-lock.json files by running npm install in affected dirs
  # Update package-lock.json top-level version fields
  echo ""
  echo -e "${BOLD}Updating lock files...${NC}"
  for dir in admin docs libs/analytics libs/client libs/sections libs/sections-react e2e templates/astro-blog; do
    local lock="$REPO_ROOT/$dir/package-lock.json"
    if [[ -f "$lock" ]]; then
      # Top-level "version" is within the first 5 lines
      sed -i '' '1,5{s/"version": ".*"/"version": "'"$target"'"/;}' "$lock"
      echo -e "  ${GREEN}OK${NC} $dir/package-lock.json"
    fi
  done

  # Update cross-package peer dependencies
  echo ""
  echo -e "${BOLD}Updating peer dependencies...${NC}"
  local sections_react="$REPO_ROOT/libs/sections-react/package.json"
  if [[ -f "$sections_react" ]]; then
    local major_minor="${target%.*}"
    sed -i '' 's/"@forjacms\/sections": "^[^"]*"/"@forjacms\/sections": "^'"$target"'"/' "$sections_react"
    echo -e "  ${GREEN}OK${NC} sections-react → @forjacms/sections@^$target"
  fi

  echo ""
  echo -e "${GREEN}${BOLD}Done!${NC} All files set to ${GREEN}$target${NC}"
  echo ""
  show_versions
}

# ── Main ─────────────────────────────────────────────────────────────

if [[ $# -eq 0 ]]; then
  show_versions
  echo ""
  echo -e "Usage: ${BOLD}$0 <version>${NC}  (e.g. $0 1.0.10)"
  exit 0
fi

# Validate version format (semver-ish)
if [[ ! "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
  echo -e "${RED}Error:${NC} Invalid version format: $1"
  echo "Expected format: MAJOR.MINOR.PATCH (e.g. 1.0.10)"
  exit 1
fi

bump_version "$1"
