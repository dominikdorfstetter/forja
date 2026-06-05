#!/usr/bin/env bash
# check-content-join-duplication.sh
#
# Lint gate for the canonical content+content_sites JOIN pattern (issue #617).
#
# `repos/content_query.rs` owns the builder that generates the canonical
# `entity ⋈ contents ⋈ content_sites` JOIN. Every site-scoped listing /
# counting query should go through that builder.
#
# A subset of methods legitimately keeps inline SQL — single-row lookups
# (`find_by_id`, `find_by_slug`, `find_by_route`), filtered listings with
# entity-specific predicates (search ILIKE, is_featured, entry_type, etc.)
# whose binds + dynamic ORDER BY don't fit the builder's `&'static str`
# surface, complex CTEs (`find_similar`), aggregations
# (`status_counts_for_site`), and mutations.
#
# This gate freezes today's per-file count of `INNER JOIN contents c `
# occurrences. Adding a new inline JOIN to any repo file lifts the count
# above its baseline and fails CI — forcing the contributor to either
# extend `ContentQuery` or document why the new shape is a legitimate
# exception (and then update the baseline here in the same PR).
#
# Run from the repository root (or with backend/ as CWD).

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
BACKEND_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
REPOS_DIR="$BACKEND_DIR/src/repos"

# Per-file baseline of permitted `INNER JOIN contents c ` occurrences.
# `content_query.rs` is the canonical builder and emits the JOIN string
# itself; it is excluded from the gate. Adding new entries here requires
# the same PR to update this baseline.
#
# Format: <file_basename>:<expected_count>
BASELINES=(
    "blog_repo.rs:13"
    "page_repo.rs:7"
    "legal_repo.rs:5"
    "cv_repo.rs:4"
    "project_repo.rs:5"
)

PATTERN='INNER JOIN contents c '

fail=0
for entry in "${BASELINES[@]}"; do
    file="${entry%%:*}"
    expected="${entry##*:}"
    path="$REPOS_DIR/$file"

    if [ ! -f "$path" ]; then
        echo "error: baseline references missing file $path" >&2
        fail=1
        continue
    fi

    actual=$(grep -c "$PATTERN" "$path" || true)

    if [ "$actual" -gt "$expected" ]; then
        echo "FAIL: $file has $actual inline content+content_sites JOIN(s); baseline is $expected"
        echo "  → Either extend ContentQuery to cover the new shape (see backend/src/repos/content_query.rs),"
        echo "    or — if the new JOIN is a legitimate exception (single-row lookup, complex CTE, mutation,"
        echo "    aggregation, or filter with binds that the builder doesn't support) — update the baseline"
        echo "    in scripts/check-content-join-duplication.sh in this PR."
        fail=1
    elif [ "$actual" -lt "$expected" ]; then
        echo "INFO: $file has $actual inline JOIN(s); baseline is $expected — please lower the baseline."
        fail=1
    fi
done

# Catch new repo files added without a baseline entry. content_query.rs
# is the canonical builder and intentionally has the JOIN string in its
# template; skip it.
declared_files=$(printf '%s\n' "${BASELINES[@]}" | cut -d: -f1 | sort)
actual_files=$(grep -l "$PATTERN" "$REPOS_DIR"/*.rs 2>/dev/null \
    | xargs -n1 basename 2>/dev/null \
    | grep -v '^content_query\.rs$' \
    | sort)

undeclared=$(comm -23 <(echo "$actual_files") <(echo "$declared_files"))
if [ -n "$undeclared" ]; then
    echo "FAIL: repo file(s) contain inline content+content_sites JOIN but have no baseline:"
    printf '  %s\n' "$undeclared"
    echo "  → Add a baseline entry in scripts/check-content-join-duplication.sh."
    fail=1
fi

if [ "$fail" -ne 0 ]; then
    exit 1
fi

echo "OK: inline content+content_sites JOIN counts match the documented baseline."
exit 0
