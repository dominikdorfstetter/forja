# ADR 0005 — `LookupSubmissionRequest` stays exempt from the Validated seam (anti-enumeration)

- **Status**: Accepted
- **Date**: 2026-05-31
- **Issue**: [#878](https://github.com/dominikdorfstetter/forja/issues/878)

## Context

The `Validated<T>` request seam (`dto/validated.rs`, issue #828) enforces
"validation ran" at the request boundary, and a lint gate
(`check-validated-extractor.sh`) forbids raw `Json<T>` on any `ValidatedDto`.
A handful of DTOs are listed in `validated-extractor-exemptions.txt`. Epic
#878 pulls `CustomEntryRequest` into the seam (its exemption was incidental)
and re-audits the rest.

`LookupSubmissionRequest` (form-submission lookup by code) is one of the
remaining exemptions. A future architecture review will likely flag it as
"another bypass to close." This ADR records why closing it would be a
**regression**.

## Decision

**`LookupSubmissionRequest` remains exempt from the Validated seam — by
design, for security.**

The lookup endpoint takes a submission code and returns the matching
submission, or **no match** if the code is unknown. This is an
**anti-enumeration** property: an unknown or malformed code must produce the
same "no match" outcome as a well-formed-but-nonexistent code. If the request
were run through a validating extractor that rejected malformed codes with a
`4xx` validation error, an attacker could distinguish "malformed" from
"valid-but-not-found" and enumerate the code space.

Therefore validation is *deliberately* deferred to the lookup itself, where
every non-hit — malformed, unknown, or expired — collapses to the same
no-match response.

## Consequences

**Positive**

- The lookup leaks no signal about which codes are well-formed or exist.
- The exemption is now documented intent, not an oversight, so the lint-gate
  exemption is defensible.

**Negative / accepted trade-offs**

- One DTO permanently outside the seam's type-level "validation ran" proof.
  Accepted: the seam's goal (fail fast on bad input) directly conflicts with
  this endpoint's goal (reveal nothing), and the endpoint wins.

## Revisit triggers

- The lookup endpoint gains rate-limiting / proof-of-work strong enough that
  enumeration is infeasible regardless of error shape → reconsider whether
  light validation can be added without leaking.
- The response shape changes such that malformed vs not-found are already
  distinguishable downstream → the exemption's rationale weakens.

## References

- Issue #878 — Validated-seam deepening epic; #880 (re-audit exemptions).
- Issue #828 — the Validated request seam.
- `backend/scripts/validated-extractor-exemptions.txt` — the exemption list.
