#!/usr/bin/env bash
# check-handler-auth.sh
#
# Lint gate for the "auth-by-declaration" model (issue #856).
#
# The Axum backend has NO blanket `/api/v1` authentication middleware.
# Authorisation is enforced per handler by naming a guard extractor in the
# function's argument list — one of:
#
#     AuthorizedSite<K, A>        AuthorizedContent<E, A>
#     AuthorizedContentWithOwnership<E, A>   AuthorizedJson<K, T, A>
#     ReadKey   WriteKey   AdminKey   MasterKey
#     AuthenticatedKey            <name>: Actor
#
# The failure mode this gate closes: a handler that *forgets* the guard
# argument is silently public, and nothing else catches it — not the type
# checker, not the tests, and not the OpenAPI `security(...)` annotation
# (which only documents intent, it does not enforce). This is precisely how
# the six endpoints in #855 lost their auth during the Rocket->Axum port.
#
# The gate enumerates every `#[utoipa::path]` handler function under the
# handlers directory and FAILS if any of them carries no auth extractor —
# unless it is on the ALLOW-LIST below of endpoints that are public by
# design. Adding a new public endpoint is therefore a deliberate, reviewed
# one-line allow-list edit; everything else must carry a guard.
#
# Run from the repository root or with backend/ as CWD:
#     ./scripts/check-handler-auth.sh
#
# Self-test: ./scripts/check-handler-auth.test.sh
#
# Overrides (used by the self-test; default to the real tree):
#   HANDLER_AUTH_GATE_HANDLERS_DIR   directory of handler .rs files
#   HANDLER_AUTH_GATE_ALLOWLIST      file of `file.rs::fn` allow-list entries
#                                    (one per line, `#` comments allowed);
#                                    replaces the embedded default when set.

set -uo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
BACKEND_DIR=$(cd "$SCRIPT_DIR/.." && pwd)

HANDLERS_DIR="${HANDLER_AUTH_GATE_HANDLERS_DIR:-$BACKEND_DIR/src/axum_app/handlers}"

if ! command -v perl >/dev/null 2>&1; then
    echo "error: perl is required for this gate" >&2
    exit 2
fi

# ── Allow-list ────────────────────────────────────────────────────────────
#
# `file.rs::function` for every handler that is intentionally reachable
# without authentication. Keep this list SHORT and justified — each entry is
# a public attack surface. A handler that *should* be guarded must carry an
# auth extractor, not an allow-list entry; if you find yourself adding a
# non-public endpoint here, fix the handler instead.
embedded_allowlist() {
    cat <<'ALLOW'
# ── Public by design (no authentication intended) ──────────────────────────
# Frontend bootstrap config (Clerk publishable key only — no secrets).
config.rs::get_config
# Operational probes (health is sanitised for anonymous callers).
system.rs::index
system.rs::health
# SEO / crawler / browser-fetched site assets.
robots.rs::get_robots_txt
sitemap.rs::get_sitemap
favicon.rs::get_favicon
favicon.rs::get_webmanifest
favicon.rs::get_browserconfig
favicon.rs::download_favicon
# Public legal imprint + machine-readable error-code catalog.
imprint.rs::get_imprint
error_codes.rs::list_error_codes
# Public stored-file proxy (path-traversal hardened in services::storage).
files.rs::serve_file
# Public document delivery: access is gated internally by an HMAC token
# (download) or a password (verify-access), not by an API key.
document.rs::download_document
document.rs::verify_document_access
# Public, ALTCHA-protected self-service form surface (#579 / forms epic).
forms.rs::public_get_form
forms.rs::public_submit_form
forms.rs::public_altcha_challenge
forms.rs::public_lookup_submission
forms.rs::public_get_submission
forms.rs::public_delete_submission
# Demo guest token issuance (mints a scoped, short-lived demo key).
auth.rs::get_guest_token
ALLOW
}

# Normalise an allow-list stream: drop `#` comments (full-line OR trailing
# inline), strip all whitespace, drop the blank lines that leaves behind.
# Entry tokens are `file.rs::fn` and never contain `#`, so this is safe.
normalize_allowlist() {
    sed -E 's/#.*//' | sed 's/[[:space:]]//g' | grep -vE '^$'
}

if [ -n "${HANDLER_AUTH_GATE_ALLOWLIST:-}" ]; then
    allowlist=$(normalize_allowlist < "$HANDLER_AUTH_GATE_ALLOWLIST" 2>/dev/null)
else
    allowlist=$(embedded_allowlist | normalize_allowlist)
fi

# ── Enumerate guard-less handlers ──────────────────────────────────────────
#
# For each `#[utoipa::path]` handler, capture its parameter list and emit
# `file.rs::fn` only when NO auth-extractor token appears in the params.
extract_guardless() {
    perl -0777 -ne '
        ($f = $ARGV) =~ s{.*/}{};
        while (/\#\[utoipa::path\((.*?)async\s+fn\s+(\w+)\s*\((.*?)\)\s*(?:->|\{)/sg) {
            my ($name, $params) = ($2, $3);
            next if $params =~ /\b(?:ReadKey|WriteKey|AdminKey|MasterKey|AuthenticatedKey)\b/;
            next if $params =~ /:\s*Actor\b/;
            next if $params =~ /\bAuthorized(?:Site|Content|Json|ContentWithOwnership)\s*</;
            print "$f\::$name\n";
        }
    ' "$@"
}

if [ ! -d "$HANDLERS_DIR" ]; then
    echo "error: handlers dir not found: $HANDLERS_DIR" >&2
    exit 2
fi

shopt -s nullglob
handler_files=("$HANDLERS_DIR"/*.rs)
shopt -u nullglob
if [ ${#handler_files[@]} -eq 0 ]; then
    echo "error: no handler .rs files in $HANDLERS_DIR" >&2
    exit 2
fi

guardless=$(extract_guardless "${handler_files[@]}" | sort -u)

exit_code=0
violations=0

echo "check-handler-auth.sh — every #[utoipa::path] handler must declare a guard"
echo "handlers dir: $HANDLERS_DIR"
echo "---"

while IFS= read -r entry; do
    [ -z "$entry" ] && continue
    if printf '%s\n' "$allowlist" | grep -qxF "$entry"; then
        continue
    fi
    echo "FAIL  $entry — handler has no auth extractor and is not allow-listed"
    violations=$((violations + 1))
    exit_code=1
done <<EOF
$guardless
EOF

# Stale allow-list entries: listed as public but no longer guard-less (either
# deleted, renamed, or a guard was added). Warn so the list stays honest.
while IFS= read -r allowed; do
    [ -z "$allowed" ] && continue
    if ! printf '%s\n' "$guardless" | grep -qxF "$allowed"; then
        echo "warn  $allowed — allow-listed but no longer a guard-less handler (stale? remove it)"
    fi
done <<EOF
$allowlist
EOF

echo "---"
if [ "$exit_code" -eq 0 ]; then
    echo "ok    no unguarded handlers outside the allow-list"
else
    echo "FAILED: $violations unguarded handler(s) — add a guard extractor or, if"
    echo "        genuinely public, add the entry to the allow-list in this script."
fi

exit "$exit_code"
