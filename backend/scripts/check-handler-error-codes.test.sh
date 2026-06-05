#!/usr/bin/env bash
# Self-test for check-handler-error-codes.sh (issue #922).
#
# Proves the gate fails on a code-less handler ApiError site and passes once a
# .with_code(...) is attached. Uses HANDLER_ERROR_CODES_DIR to point the gate at
# a throwaway fixture so it never touches real source.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
GATE="$SCRIPT_DIR/check-handler-error-codes.sh"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# --- Case 1: a code-less site must FAIL the gate ---
cat >"$TMP/bad.rs" <<'RS'
async fn h() -> Result<(), ApiError> {
    Err(ApiError::bad_request("nope"))
}
RS

if HANDLER_ERROR_CODES_DIR="$TMP" "$GATE" >/dev/null 2>&1; then
    echo "FAIL: gate passed on a code-less ApiError site" >&2
    exit 1
fi
echo "ok: gate fails on a code-less site"

# --- Case 2: the same site WITH a code must PASS ---
cat >"$TMP/bad.rs" <<'RS'
async fn h() -> Result<(), ApiError> {
    Err(ApiError::bad_request("nope").with_code(codes::BAD_REQUEST))
}
RS

if ! HANDLER_ERROR_CODES_DIR="$TMP" "$GATE" >/dev/null 2>&1; then
    echo "FAIL: gate rejected a properly-coded ApiError site" >&2
    exit 1
fi
echo "ok: gate passes once a code is attached"

# --- Case 3: multi-line statement with a code on a later line must PASS ---
cat >"$TMP/bad.rs" <<'RS'
async fn h() -> Result<(), ApiError> {
    Err(
        ApiError::not_found("missing")
            .with_code(codes::RESOURCE_NOT_FOUND),
    )
}
RS

if ! HANDLER_ERROR_CODES_DIR="$TMP" "$GATE" >/dev/null 2>&1; then
    echo "FAIL: gate rejected a multi-line coded site" >&2
    exit 1
fi
echo "ok: gate handles multi-line statements"

echo "check-handler-error-codes self-test: all cases pass."
