#!/usr/bin/env bash
# check-audited-mutation.sh
#
# Lint gate for the AuditedMutation seam (issue #621).
#
# `services::audited_mutation::execute` is the single path from request
# handlers to `audit_service::log_action` + `webhook_service::dispatch`
# for sibling (non-content) entities. Concentrating the call here gives
# us the audit → webhook ordering guarantee and the `audit_id` payload
# injection — both impossible to enforce when handlers inline the two
# calls separately.
#
# This script fails if `audit_service::log_action(` appears anywhere
# under `src/axum_app/handlers/`. The function is `pub(crate)`; if you
# need to log an audit row from a handler, route it through
# `audited_mutation::execute` with a `MutationEvent`.
#
# Comments and docstrings are tolerated.
#
# Run from the repository root or with backend/ as CWD; returns 0 on a
# clean state. Integrate into CI alongside `cargo clippy` and the
# validated-extractor gate.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
BACKEND_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
HANDLERS_DIR="$BACKEND_DIR/src/axum_app/handlers"

if ! command -v rg >/dev/null 2>&1; then
    echo "error: ripgrep (rg) is required for this gate" >&2
    exit 2
fi

# Match real call sites, not docstring mentions. The `(` immediately
# after the function name excludes prose like `audit_service::log_action`
# in module-level `//!` comments.
pattern='audit_service::log_action\s*\('

# `--type rust` skips non-source files; lines starting with `//` are
# common in docs (mentioning the API by name) and are filtered out
# explicitly so future doc rewrites can keep the symbol name without
# tripping the gate.
if matches=$(rg --no-heading -n --type rust "$pattern" "$HANDLERS_DIR" 2>/dev/null \
        | rg -v '^[^:]+:[0-9]+:\s*//'); then
    printf '\n'
    echo "ERROR: audit_service::log_action must not be called from handlers."
    echo "       Route audit writes through services::audited_mutation::execute"
    echo "       (issue #621 — preserves audit → webhook ordering and the"
    echo "       audit_id payload reference)."
    echo
    echo "Offending sites:"
    printf '%s\n' "$matches" | sed 's/^/    /'
    echo
    echo "Fix: replace the call with"
    echo "    audited_mutation::execute(pool, MutationEvent { ... })"
    echo "with site_id / user_id / action / entity_type / entity_id /"
    echo "webhook_event / webhook_payload / audit_metadata / change_diff"
    echo "set per the previous arguments."
    exit 1
fi

echo "OK: zero direct audit_service::log_action calls in handlers."
exit 0
