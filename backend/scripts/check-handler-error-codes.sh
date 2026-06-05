#!/usr/bin/env bash
# check-handler-error-codes.sh
#
# Lint gate for stable, intentional API error codes (issue #922).
#
# Every `ApiError` returned from a request handler should carry an explicit,
# machine-readable `.with_code(codes::…)`. `ApiError::code()` does derive a
# status-generic fallback (e.g. BAD_REQUEST, RESOURCE_NOT_FOUND) so no response
# is ever code-less — but relying on the fallback makes the code incidental
# rather than chosen. This gate fails when a fallible `ApiError` constructor in
# `src/axum_app/handlers/` is not followed by `.with_code(` within the same
# statement, so codes stay deliberate and a regression can't ship green.
#
# Run from the repository root or with backend/ as CWD; returns 0 when clean.
# Integrate into CI alongside the other seam gates.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
BACKEND_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
HANDLERS_DIR="${HANDLER_ERROR_CODES_DIR:-$BACKEND_DIR/src/axum_app/handlers}"

if ! command -v python3 >/dev/null 2>&1; then
    echo "error: python3 is required for this gate" >&2
    exit 2
fi

python3 - "$HANDLERS_DIR" <<'PY'
import glob, re, sys

handlers_dir = sys.argv[1]

# Fallible constructors whose error is a real API response — each should carry
# an explicit code. `ApiError::database`/`from(...)` are not user-constructed.
CTORS = (
    "bad_request|unauthorized|forbidden|not_found|internal|conflict|"
    "unprocessable_entity|payload_too_large|locked|rate_limited|"
    "too_many_requests|service_unavailable"
)
pat = re.compile(r"ApiError::(" + CTORS + r")\(")

offenders = []
for path in sorted(glob.glob(f"{handlers_dir}/**/*.rs", recursive=True)):
    lines = open(path).read().split("\n")
    for i, line in enumerate(lines):
        for _ in pat.finditer(line):
            # Collect the statement: forward until parens balance and the line
            # ends the expression (`;`, `?`, or `),` in an argument list).
            depth, seg = 0, []
            for j in range(i, min(i + 14, len(lines))):
                seg.append(lines[j])
                depth += lines[j].count("(") - lines[j].count(")")
                tail = lines[j].rstrip()
                if depth <= 0 and tail.endswith((";", "?", "),")):
                    break
            if ".with_code(" not in "\n".join(seg):
                offenders.append(f"{path}:{i + 1}: {line.strip()[:90]}")

if offenders:
    print("error: handler ApiError sites missing an explicit .with_code(codes::…):", file=sys.stderr)
    for o in offenders:
        print(f"  {o}", file=sys.stderr)
    print(f"\n{len(offenders)} site(s). Attach a stable code from `crate::errors::codes`.", file=sys.stderr)
    sys.exit(1)

print("check-handler-error-codes: all handler ApiError sites carry an explicit code.")
PY
