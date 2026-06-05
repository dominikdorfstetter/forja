# ADR 0003 — Uniform content route convention: `/{base}/{id}` lightweight + `/{base}/{id}/detail` full

- **Status**: Accepted
- **Date**: 2026-05-31
- **Issue**: [#874](https://github.com/dominikdorfstetter/forja/issues/874)
- **Builds on**: [ADR 0001](0001-project-list-detail-asymmetry.md) (list/detail asymmetry)

## Context

The six content types expose single-item reads inconsistently:

- **blog / page / legal** expose **both** `/{base}/{id}` (lightweight, list
  shape) **and** `/{base}/{id}/detail` (full relational graph).
- **cv / document / project** expose only `/{base}/{id}`, which *is* the
  detail shape (e.g. `CvEntryDetailResponse`).

So `GET /blogs/{id}` and `GET /cv/{id}` return **different altitudes** of data
— one lightweight, one a full graph. This blocks a single admin
`createContentService` factory (it would need per-entity path + shape config)
and forces every consumer to special-case which types have a `/detail` route.

The friction surfaced while consolidating the five admin content service files
(thin `apiRequest` pass-throughs) into one factory: the *only* reason they
resist a factory is this route irregularity.

## Decision

**Extend ADR-0001's list/detail asymmetry uniformly.** Every content type
exposes:

- `GET /{base}/{id}` → **lightweight** single item (list-shape: scalars +
  linkage IDs + localized text, per ADR-0001).
- `GET /{base}/{id}/detail` → **full** relational graph.

cv / document / project are brought into line: add `/detail`, and make bare
`/{id}` return the lightweight shape (adding lightweight single-item response
types where they don't yet exist).

The change is **breaking, in-place** on `/api/v1` — no deprecation window. The
generated SDK (`admin/src/generated/api-types.ts` + `libs/client`) and the
dorfstetter.at consumer are updated in lockstep with the backend change.

## Consequences

**Positive**

- One predictable contract: "single item is lightweight; `/detail` is the
  full graph" holds for all six types.
- Unblocks the admin `createContentService` factory — no per-entity path
  config needed.
- Consistent altitude semantics: a caller knows what shape it gets from the
  path alone.

**Negative / accepted trade-offs**

- Breaking change to `/api/v1`. Any external consumer not under our control
  breaks until it migrates. Accepted because the routes are
  consumer-coordinated today and the cost of a deprecation window (dual
  routing + alias maintenance) outweighs the benefit for the current consumer
  set.
- cv / document / project gain a new lightweight response shape that must be
  kept in sync with their detail shape (mitigated by the list shape already
  existing for their list endpoints).

## Revisit triggers

- A third-party consumer outside our coordination depends on `/api/v1` and a
  breaking cutover is no longer acceptable → switch to additive routes + a
  deprecation window.
- A generic `?include=` opt-in mechanism lands (ADR-0001 revisit trigger), at
  which point `/detail` may fold into the lightweight route with opt-in
  expansion.

## References

- ADR 0001 — list/detail asymmetry (the shape this convention generalizes).
- Issue #874 — epic; #875 (backend routes), #876 (SDK), #877 (admin factory).
