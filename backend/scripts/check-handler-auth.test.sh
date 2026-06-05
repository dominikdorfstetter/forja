#!/usr/bin/env bash
# check-handler-auth.test.sh
#
# Self-test for the handler-auth gate (check-handler-auth.sh). Drives the gate
# against throwaway handler fixtures via its HANDLER_AUTH_GATE_* overrides and
# asserts the exit code per scenario. No network, no cargo, no real source.
#
# Run from anywhere: `./scripts/check-handler-auth.test.sh`.

set -uo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
GATE="$SCRIPT_DIR/check-handler-auth.sh"

pass=0
fail=0

# run_case <name> <expected_exit> : reads fixtures from $HANDLERS / $ALLOW.
run_case() {
    local name="$1" expected="$2" actual
    HANDLER_AUTH_GATE_HANDLERS_DIR="$HANDLERS" \
    HANDLER_AUTH_GATE_ALLOWLIST="$ALLOW" \
        "$GATE" >/dev/null 2>&1
    actual=$?
    if [ "$actual" -eq "$expected" ]; then
        printf '  ok   %-60s (exit %s)\n' "$name" "$actual"
        pass=$((pass + 1))
    else
        printf '  FAIL %-60s (expected %s, got %s)\n' "$name" "$expected" "$actual"
        fail=$((fail + 1))
    fi
}

TMP_ROOTS=()
new_fixture() {
    ROOT=$(mktemp -d)
    HANDLERS="$ROOT/handlers"
    ALLOW="$ROOT/allowlist.txt"
    mkdir -p "$HANDLERS"
    : > "$ALLOW"
    TMP_ROOTS+=("$ROOT")
}
cleanup() { for r in "${TMP_ROOTS[@]:-}"; do [ -n "$r" ] && rm -rf "$r"; done; }
trap cleanup EXIT

echo "check-handler-auth.sh — self-test"

# --- Scenario 1: guarded handler (ReadKey) → clean ---
new_fixture
cat > "$HANDLERS/clean.rs" <<'RS'
#[utoipa::path(get, path = "/things")]
async fn list_things(State(s): State<AppState>, auth: ReadKey) -> Json<Vec<Thing>> {}
RS
run_case "handler with ReadKey is accepted" 0

# --- Scenario 2 (the bug class): guard-less handler, not allow-listed → reject ---
new_fixture
cat > "$HANDLERS/leak.rs" <<'RS'
#[utoipa::path(get, path = "/things")]
async fn list_things(State(s): State<AppState>) -> Json<Vec<Thing>> {}
RS
run_case "guard-less handler not on allow-list is rejected" 1

# --- Scenario 3: guard-less handler that IS allow-listed → clean ---
new_fixture
cat > "$HANDLERS/pub.rs" <<'RS'
#[utoipa::path(get, path = "/config")]
async fn get_config(State(s): State<AppState>) -> Json<Config> {}
RS
printf 'pub.rs::get_config  # intentionally public\n' > "$ALLOW"
run_case "guard-less handler on allow-list is accepted" 0

# --- Scenario 4: AuthorizedSite extractor → recognised as guarded ---
new_fixture
cat > "$HANDLERS/site.rs" <<'RS'
#[utoipa::path(get, path = "/sites/{site_id}/things")]
async fn list_site_things(
    State(s): State<AppState>,
    Path(site_id): Path<Uuid>,
    _access: AuthorizedSite<ThingKind, Read>,
) -> Json<Vec<Thing>> {}
RS
run_case "AuthorizedSite<K, A> is recognised as a guard" 0

# --- Scenario 5: AuthorizedContentWithOwnership (substring of AuthorizedContent) ---
new_fixture
cat > "$HANDLERS/own.rs" <<'RS'
#[utoipa::path(put, path = "/things/{id}")]
async fn update_thing(
    State(s): State<AppState>,
    access: AuthorizedContentWithOwnership<ThingContent, Update>,
) -> Json<Thing> {}
RS
run_case "AuthorizedContentWithOwnership is recognised as a guard" 0

# --- Scenario 6: nested-paren params (Path<(Uuid, String)>) with a guard ---
new_fixture
cat > "$HANDLERS/nested.rs" <<'RS'
#[utoipa::path(get, path = "/sites/{site_id}/things/{slug}")]
async fn get_by_slug(
    State(s): State<AppState>,
    Path((site_id, slug)): Path<(Uuid, String)>,
    auth: ReadKey,
) -> Json<Thing> {}
RS
run_case "nested-paren param list with a guard is parsed correctly" 0

# --- Scenario 7: nested-paren params, NO guard → still policed ---
new_fixture
cat > "$HANDLERS/nested_leak.rs" <<'RS'
#[utoipa::path(get, path = "/sites/{site_id}/things/{slug}")]
async fn get_by_slug(
    State(s): State<AppState>,
    Path((site_id, slug)): Path<(Uuid, String)>,
) -> Json<Thing> {}
RS
run_case "guard-less handler with nested-paren params is still caught" 1

# --- Scenario 8: `: Actor` extractor → recognised as guarded ---
new_fixture
cat > "$HANDLERS/actor.rs" <<'RS'
#[utoipa::path(post, path = "/cache/invalidate")]
async fn invalidate(State(s): State<AppState>, auth: Actor) -> StatusCode {}
RS
run_case "bare Actor extractor is recognised as a guard" 0

# --- Scenario 9: two handlers in one file, one guarded one not → reject ---
new_fixture
cat > "$HANDLERS/mixed.rs" <<'RS'
#[utoipa::path(get, path = "/health")]
async fn health(State(s): State<AppState>) -> Json<Health> {}

#[utoipa::path(get, path = "/health/detailed")]
async fn health_detailed(State(s): State<AppState>, _a: AdminKey) -> Json<Health> {}
RS
run_case "per-function granularity: one guarded sibling does not cover the other" 1

# --- Scenario 10: a non-handler async fn (no #[utoipa::path]) is ignored ---
new_fixture
cat > "$HANDLERS/helper.rs" <<'RS'
async fn internal_helper(pool: &PgPool) -> Result<(), Error> {}

#[utoipa::path(get, path = "/things")]
async fn list_things(State(s): State<AppState>, auth: ReadKey) -> Json<Vec<Thing>> {}
RS
run_case "non-#[utoipa::path] async fn is not treated as a handler" 0

echo
echo "passed: $pass   failed: $fail"
[ "$fail" -eq 0 ]
