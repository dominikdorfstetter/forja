# ADR 0007 — Spine soft-delete convergence boundary

- **Status**: Accepted
- **Date**: 2026-05-31
- **Issue**: `#862`, `#866`

## Context

Issue #866 (under epic #862) proposed routing **every** spine entity's
soft-delete through `ContentService::soft_delete_content` — the canonical path
that sets `contents.is_deleted` / `deleted_at` and owns the not-found
(`rows_affected == 0`) check in one place — and deleting the hand-rolled
`UPDATE … is_deleted = TRUE` blocks in the document / cv / legal repos.

On inspection the convergence was already complete for the genuine spine
entities, and the remaining "targets" turned out to be **deliberate
exceptions**, not accidental duplication. This ADR records the boundary so a
future "finish the convergence" suggestion does not undo intentional design.

## Decision

**Canonical spine soft-delete** — `ContentService::soft_delete_content` — is the
single path for the spine content entities that carry a non-null `content_id`:

- **blog**, **page**, **project**, **cv_entry** all delegate to it. (cv_entry
  joined the spine lifecycle in #864; the other three predate this epic.)

Three entities **intentionally** keep their own soft-delete and are **not**
converged:

- **legal** — `legal_documents` has its **own** `is_deleted` / `deleted_at`
  (migration `…49`), and `ContentQuery::use_entity_soft_delete()` exists
  specifically so legal lists filter the entity flag, not the spine flag.
  Two further reasons make convergence wrong, not just costly:
  - `legal_documents.content_id` is **nullable** — a legal doc with no spine
    row cannot be soft-deleted via `soft_delete_content` (which needs a
    non-null `content_id`).
  - Converging would require a **reverse data-sync migration**
    (`contents.is_deleted ← legal_documents.is_deleted`) to avoid resurrecting
    currently-trashed legal docs — the inverse of what migration `…49` did.
- **document** — a bespoke file/media entity with no `contents` row at all
  (see [ADR 0006](./0006-document-not-a-content-entity.md)); it tracks
  deletion on `documents.is_deleted`.
- **skill** — an own-table entity with **no `deleted_at`** (see
  [ADR 0004](./0004-skill-not-a-content-entity.md)).

## Consequences

**Positive**

- `soft_delete_content` stays the single canonical path for every entity that
  genuinely lives on the spine; the not-found / `rows_affected` check is not
  duplicated for those types.
- The three exceptions are now documented as deliberate, with their reasons,
  rather than read as "unfinished convergence."

**Negative / accepted trade-offs**

- legal, document, and skill keep bespoke soft-delete code. Accepted: each has a
  concrete structural reason (nullable/absent `content_id`, file entity, no
  `deleted_at`) that makes the canonical path inapplicable or incorrect.

## Revisit triggers

- `legal_documents.content_id` is made `NOT NULL` (every legal doc guaranteed a
  spine row) **and** product wants legal trash on the spine → re-evaluate, with
  the reverse-sync migration.
- document or skill is migrated onto the `contents` spine for unrelated reasons
  → fold its soft-delete into `soft_delete_content` at that point.

## References

- Issue #862 — atomic ContentEntity lifecycle epic.
- Issue #866 — converge spine soft_delete.
- ADR 0004 — `skill` is not a `ContentEntity`.
- ADR 0006 — `document` is not a `ContentEntity`.
- Migration `20240101000049_trash_legal_social_navigation` — legal's
  entity-level soft-delete.
