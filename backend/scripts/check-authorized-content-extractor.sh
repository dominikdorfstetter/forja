#!/usr/bin/env bash
# check-authorized-content-extractor.sh
#
# Lint gate for the authorized-content-entity seam (issue #662).
#
# Every authorisation prelude in a content-entity handler should route
# through `AuthorizedContent<E, A>` or `AuthorizedSite<K, A>`, not via
# raw `PermissionService::require` + `ModuleGuard::<M>::check` calls.
#
# The script lists every remaining raw call site in the six content
# handler files with a per-file count, and exits non-zero only when
# any file exceeds its allow-listed budget. The allow-list shrinks as
# slices of issue #662 land — set the file's budget to its remaining
# call-site count after each migration PR.
#
# Run from the repository root or with backend/ as CWD.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
BACKEND_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
HANDLERS_DIR="$BACKEND_DIR/src/axum_app/handlers"

if ! command -v rg >/dev/null 2>&1; then
    echo "error: ripgrep (rg) is required for this gate" >&2
    exit 2
fi

# Per-file budgets — `file:budget` pairs. Decrement after each
# migration sub-issue lands. Initial values reflect call-site counts
# right after the seam PR (#662 tracer; only blog.rs partially
# migrated). bash 3.2 on macOS lacks associative arrays, so a flat
# list keeps the gate portable.
BUDGETS=(
    "blog.rs:1"
    "page.rs:1"
    "legal.rs:6"
    "project.rs:1"
    "cv.rs:5"
    "document.rs:4"
)

PATTERN='PermissionService::require\b|PermissionService::check_resource_access\b|ModuleGuard::<[A-Za-z]+>::check\b'

exit_code=0
total=0

for entry in "${BUDGETS[@]}"; do
    file="${entry%%:*}"
    budget="${entry##*:}"
    path="$HANDLERS_DIR/$file"
    if [[ ! -f "$path" ]]; then
        echo "warn: $path missing — skipping" >&2
        continue
    fi
    count=$(rg --no-heading --no-filename -c "$PATTERN" "$path" 2>/dev/null || echo 0)
    total=$((total + count))
    if (( count > budget )); then
        echo "FAIL  $file: $count call sites (budget $budget)"
        rg --no-heading -n "$PATTERN" "$path"
        exit_code=1
    else
        echo "ok    $file: $count call sites (budget $budget)"
    fi
done

echo "---"
echo "Total raw auth calls in content handlers: $total"
echo "Migrate through AuthorizedContent<E, A> / AuthorizedSite<K, A> to shrink."

exit "$exit_code"
