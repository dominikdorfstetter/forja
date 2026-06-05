#!/usr/bin/env bash
# check-validated-extractor.sh
#
# Lint gate for the request-validation seam (issues #610 / #615 / #828).
#
# The seam is opt-out-with-reason: every request body either validates through
# `ValidatedJson<T>` or is explicitly exempted with a justification. The gate
# enforces two rules:
#
#   Rule 2 (#610): once a DTO opts into `ValidatedDto` (via
#     `#[derive(ValidatedDto)]` or `impl ValidatedDto for X`), every handler
#     taking it as a request body MUST use `ValidatedJson<X>`, never the raw
#     `Json<X>` — the raw extractor bypasses the seam.
#
#   Rule 4 (#828): every request-body DTO extracted in a handler must be a
#     `ValidatedDto` OR appear in the exemption allowlist with a reason. This
#     stops a *new* request body from silently skipping validation — the gate
#     no longer only polices types that already opted in.
#
# Exemptions live in `validated-extractor-exemptions.txt` (one `Type # reason`
# per line). The dirs and exemption path are overridable via the
# VALIDATED_GATE_* env vars so the self-test can point the gate at fixtures.
#
# Run from the repository root (or with backend/ as CWD). Returns 0 on a clean
# state; wired into CI alongside `cargo clippy` (.github/workflows/ci.yml).

set -euo pipefail

# Resolve the script's own location so the gate works from anywhere.
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
BACKEND_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
SRC_DIR="$BACKEND_DIR/src"

# Directories and the exemption list are overridable so the gate can be
# pointed at throwaway fixtures by its self-test (check-validated-extractor.test.sh).
# Production runs use the defaults below.
HANDLERS_DIR="${VALIDATED_GATE_HANDLERS_DIR:-$SRC_DIR/axum_app/handlers}"
DTO_DIR="${VALIDATED_GATE_DTO_DIR:-$SRC_DIR/dto}"
EXEMPTIONS_FILE="${VALIDATED_GATE_EXEMPTIONS:-$SCRIPT_DIR/validated-extractor-exemptions.txt}"

if ! command -v rg >/dev/null 2>&1; then
    echo "error: ripgrep (rg) is required for this gate" >&2
    exit 2
fi

# 1. Manual impls: `impl ValidatedDto for <Type>`. `--no-filename` is
#    essential — without it rg prefixes each match with the file path,
#    which then leaks into the alternation pattern below.
manual_impls=$(rg --no-heading --no-line-number --no-filename -o \
    'impl(?:<[^>]*>)? ValidatedDto for ([A-Z][A-Za-z0-9_]+)' \
    --replace '$1' "$DTO_DIR" 2>/dev/null || true)

# 2. Derive opt-ins: `#[derive(... ValidatedDto ...)]` followed (within a few
#    lines, since `#[schema(...)]` / `#[serde(...)]` attributes commonly sit
#    in between) by `pub struct <Type>`.
derive_block=$(rg --no-heading --no-line-number -A 3 \
    '#\[derive\([^)]*\bValidatedDto\b[^)]*\)\]' \
    "$DTO_DIR" 2>/dev/null || true)
derived=$(printf '%s\n' "$derive_block" \
    | rg -o 'pub struct ([A-Z][A-Za-z0-9_]+)' --replace '$1' 2>/dev/null || true)

# Deduplicated set of ValidatedDto type names. The `|| true` keeps the gate
# alive when the set is empty — `rg -v` exits non-zero on no matches, which
# `pipefail` would otherwise turn into a spurious gate failure.
validated=$(printf '%s\n%s\n' "$manual_impls" "$derived" \
    | { rg -v '^[[:space:]]*$' || true; } \
    | sort -u)

# ---------------------------------------------------------------------------
# Exemption allowlist (issue #828). Each line is `TypeName # reason`. Blank
# lines and full-line `#` comments are ignored. A bare `TypeName` with no
# `# reason` is a hard error: every opt-out of the seam must be justified.
# ---------------------------------------------------------------------------
exempt=""
if [ -f "$EXEMPTIONS_FILE" ]; then
    while IFS= read -r raw || [ -n "$raw" ]; do
        line="$(printf '%s' "$raw" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
        [ -z "$line" ] && continue
        case "$line" in \#*) continue ;; esac
        name="$(printf '%s' "$line" | sed 's/[[:space:]]*#.*$//; s/[[:space:]]*$//')"
        if ! printf '%s' "$line" | grep -q '#'; then
            echo "ERROR: validation-seam exemption '$name' has no reason." >&2
            echo "       Annotate it as: '$name # why this DTO needs no ValidatedDto'." >&2
            echo "       (edit $EXEMPTIONS_FILE)" >&2
            exit 1
        fi
        exempt="$exempt $name"
    done < "$EXEMPTIONS_FILE"
fi

is_exempt()    { case " $exempt " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }
is_validated() { printf '%s\n' "$validated" | grep -qx "$1"; }

status=0

# ---------------------------------------------------------------------------
# Rule 2 (issue #610): a ValidatedDto type must never be extracted via the raw
# `Json<T>`. Matched only in the request-body *parameter* position
# (`Json(<binding>): Json<X>`), so response return types like
# `-> Result<Json<Vec<XResponse>>, _>` are not false-positives. The word
# boundary `\b` before the left `Json(` excludes `ValidatedJson(...)`. The
# `[<>]` terminator catches both `Json<Type>` and `Json<Vec<Type>>` (the latter
# bypasses the `Vec<T>` seam). `-U` lets a wrapped multi-line parameter match.
# ---------------------------------------------------------------------------
if [ -n "$validated" ]; then
    alternation=$(printf '%s' "$validated" | paste -sd '|' -)
    if matches=$(rg --no-heading -nU "\bJson\((?:mut[[:space:]]+)?[a-z_]+\)[[:space:]]*:[[:space:]]*Json<[[:space:]]*($alternation)[<>]" "$HANDLERS_DIR" 2>/dev/null); then
        printf '\n'
        echo "ERROR: ValidatedDto types must be extracted via ValidatedJson<T>, not Json<T>."
        echo "       (Using Json<T> bypasses the validation seam — see issue #610.)"
        echo
        echo "Offending sites:"
        printf '%s\n' "$matches" | sed 's/^/    /'
        echo
        echo "Fix: change \`Json<X>\` to \`ValidatedJson<X>\` in the offending handler"
        echo "signatures, and remove any inline \`body.validate()\` call."
        status=1
    fi
fi

# ---------------------------------------------------------------------------
# Rule 4 (issue #828): every request-body DTO extracted in a handler must be a
# ValidatedDto or carry an annotated exemption. This flips the seam from opt-in
# (only opted-in DTOs were policed) to opt-out-with-reason, so a *new* request
# body cannot silently skip validation. Matches `Json(b): Json<X>` and
# `ValidatedJson(b): ValidatedJson<X>`, single- or multi-line (`-U` lets the
# pattern span the wrapped form). Response types (`-> ... Json<X>`) have no
# `Json(binding):` prefix and are not matched.
# ---------------------------------------------------------------------------
request_dtos=$(rg -UoN --no-filename \
    '(?:Json|ValidatedJson)\((?:mut[[:space:]]+)?[a-z_]+\)[[:space:]]*:[[:space:]]*(?:Json|ValidatedJson)<[[:space:]]*([A-Za-z0-9_]+)' \
    --replace '$1' "$HANDLERS_DIR" 2>/dev/null | sort -u || true)

unaccounted=""
while IFS= read -r dto; do
    [ -z "$dto" ] && continue
    if is_validated "$dto" || is_exempt "$dto"; then
        continue
    fi
    unaccounted="$unaccounted $dto"
done <<EOF
$request_dtos
EOF

if [ -n "$unaccounted" ]; then
    printf '\n'
    echo "ERROR: request-body DTOs must validate via ValidatedJson<T> or be exempted."
    echo "       (A raw Json<T> request body skips the validation seam — see issue #828.)"
    echo
    echo "Unaccounted request DTOs — add \`#[derive(ValidatedDto)]\` / \`impl ValidatedDto\`"
    echo "and extract via ValidatedJson<T>, or list in"
    echo "$(basename "$EXEMPTIONS_FILE") with a reason:"
    for d in $unaccounted; do echo "    $d"; done
    status=1
fi

[ "$status" -ne 0 ] && exit 1

echo "OK: every request-body DTO is validated via ValidatedJson<T> or exempted."
exit 0
