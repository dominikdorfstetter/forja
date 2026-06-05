#!/usr/bin/env bash
# check-validated-extractor.test.sh
#
# Self-test for the request-validation seam gate (check-validated-extractor.sh).
# Drives the gate against throwaway fixtures via its VALIDATED_GATE_* overrides
# and asserts the exit code per scenario. No network, no cargo, no real source.
#
# Covers:
#   - Rule 2 (issue #610): a ValidatedDto type must use ValidatedJson<T>, never Json<T>.
#   - Rule 4 (issue #828): every request-body DTO must be ValidatedDto OR exempt.
#   - Exemptions must carry a reason annotation.
#
# Run from anywhere: `./scripts/check-validated-extractor.test.sh`.

set -uo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
GATE="$SCRIPT_DIR/check-validated-extractor.sh"

pass=0
fail=0

# run_case <name> <expected_exit> : reads fixture dirs from $DTO/$HANDLERS/$EXEMPT.
run_case() {
    local name="$1" expected="$2"
    local actual
    VALIDATED_GATE_DTO_DIR="$DTO" \
    VALIDATED_GATE_HANDLERS_DIR="$HANDLERS" \
    VALIDATED_GATE_EXEMPTIONS="$EXEMPT" \
        "$GATE" >/dev/null 2>&1
    actual=$?
    if [ "$actual" -eq "$expected" ]; then
        printf '  ok   %-58s (exit %s)\n' "$name" "$actual"
        pass=$((pass + 1))
    else
        printf '  FAIL %-58s (expected %s, got %s)\n' "$name" "$expected" "$actual"
        fail=$((fail + 1))
    fi
}

# Fresh, empty fixture tree for each scenario.
new_fixture() {
    ROOT=$(mktemp -d)
    DTO="$ROOT/dto"
    HANDLERS="$ROOT/handlers"
    EXEMPT="$ROOT/exemptions.txt"
    mkdir -p "$DTO" "$HANDLERS"
    : > "$EXEMPT"
    TMP_ROOTS+=("$ROOT")
}

TMP_ROOTS=()
cleanup() { for r in "${TMP_ROOTS[@]:-}"; do [ -n "$r" ] && rm -rf "$r"; done; }
trap cleanup EXIT

echo "check-validated-extractor.sh — self-test"

# --- Scenario 1: validated type extracted via ValidatedJson → clean ---
new_fixture
cat > "$DTO/clean.rs" <<'RS'
#[derive(Debug, Deserialize, Validate, ValidatedDto)]
pub struct CleanRequest { pub name: String }
RS
cat > "$HANDLERS/clean.rs" <<'RS'
async fn create_clean(ValidatedJson(body): ValidatedJson<CleanRequest>) {}
RS
run_case "validated type via ValidatedJson is accepted" 0

# --- Scenario 2 (rule 2): validated type extracted via bare Json → reject ---
new_fixture
cat > "$DTO/leak.rs" <<'RS'
#[derive(Debug, Deserialize, Validate, ValidatedDto)]
pub struct LeakRequest { pub name: String }
RS
cat > "$HANDLERS/leak.rs" <<'RS'
async fn create_leak(Json(body): Json<LeakRequest>) {}
RS
run_case "rule2: ValidatedDto type via bare Json is rejected" 1

# --- Scenario 3 (rule 4, the new behavior): unvalidated request DTO, no exemption → reject ---
new_fixture
cat > "$DTO/raw.rs" <<'RS'
#[derive(Debug, Deserialize)]
pub struct RawRequest { pub name: String }
RS
cat > "$HANDLERS/raw.rs" <<'RS'
async fn create_raw(Json(body): Json<RawRequest>) {}
RS
run_case "rule4: unvalidated request DTO with no exemption is rejected" 1

# --- Scenario 4 (rule 4): unvalidated request DTO that is exempted with a reason → clean ---
new_fixture
cat > "$DTO/raw.rs" <<'RS'
#[derive(Debug, Deserialize)]
pub struct RawRequest { pub name: String }
RS
cat > "$HANDLERS/raw.rs" <<'RS'
async fn create_raw(Json(body): Json<RawRequest>) {}
RS
printf 'RawRequest # no fields need validation; pass-through to repo\n' > "$EXEMPT"
run_case "rule4: exempted-with-reason request DTO is accepted" 0

# --- Scenario 5: exemption without a reason annotation → reject ---
new_fixture
cat > "$DTO/raw.rs" <<'RS'
#[derive(Debug, Deserialize)]
pub struct RawRequest { pub name: String }
RS
cat > "$HANDLERS/raw.rs" <<'RS'
async fn create_raw(Json(body): Json<RawRequest>) {}
RS
printf 'RawRequest\n' > "$EXEMPT"
run_case "exemption lacking a reason is rejected" 1

# --- Scenario 6 (rule 4, multiline extractor): wrapped ValidatedJson<\n T \n> → clean ---
new_fixture
cat > "$DTO/multi.rs" <<'RS'
impl ValidatedDto for MultiRequest { type Context = (); }
pub struct MultiRequest { pub name: String }
RS
cat > "$HANDLERS/multi.rs" <<'RS'
async fn create_multi(
    crate::dto::validated::ValidatedJson(body): crate::dto::validated::ValidatedJson<
        MultiRequest,
    >,
) {}
RS
run_case "rule4: multiline ValidatedJson<T> extractor is recognized" 0

# --- Scenario 7 (Vec seam): array body via ValidatedJson<Vec<T>> → clean ---
new_fixture
cat > "$DTO/vec.rs" <<'RS'
impl<T> ValidatedDto for Vec<T> where T: Validate { type Context = (); }
pub struct FooInput { pub name: String }
RS
cat > "$HANDLERS/vec.rs" <<'RS'
async fn upsert_many(ValidatedJson(items): ValidatedJson<Vec<FooInput>>) {}
RS
run_case "rule4: ValidatedJson<Vec<T>> array body is accepted" 0

# --- Scenario 8 (Vec seam, rule 2): raw Json<Vec<T>> bypass → reject ---
new_fixture
cat > "$DTO/vec.rs" <<'RS'
impl<T> ValidatedDto for Vec<T> where T: Validate { type Context = (); }
pub struct FooInput { pub name: String }
RS
cat > "$HANDLERS/vec.rs" <<'RS'
async fn upsert_many(Json(items): Json<Vec<FooInput>>) {}
RS
run_case "rule2: raw Json<Vec<T>> bypassing the Vec seam is rejected" 1

# --- Scenario 9 (rule 4): `Json(mut body)` mutable binding must not slip the gate ---
new_fixture
cat > "$DTO/mutbody.rs" <<'RS'
#[derive(Debug, Deserialize)]
pub struct MutRequest { pub name: String }
RS
cat > "$HANDLERS/mutbody.rs" <<'RS'
async fn create_mut(Json(mut body): Json<MutRequest>) { body.name.clear(); }
RS
run_case "rule4: Json(mut body) binding is still policed" 1

echo
echo "passed: $pass   failed: $fail"
[ "$fail" -eq 0 ]
