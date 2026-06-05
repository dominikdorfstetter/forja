# ADR 0006 — `document` is intentionally not a `ContentEntity`

- **Status**: Accepted
- **Date**: 2026-05-31
- **Issue**: `#862`, `#864`

## Context

The `ContentEntity` trait (`services/content_lifecycle/entity.rs`) lets one
generic `content_lifecycle::create::<E>` drive content types through the shared
publish lifecycle (atomic spine + entity write, trait-method publish gate,
canonical soft-delete). Issue #864 proposed onboarding **document** and
**cv_entry** to `ContentEntity`, on the premise that both are content-spine
types.

cv_entry genuinely is a spine type (it carries a `content_id`, has a status,
and already routes create/update/soft-delete through the spine), and was
onboarded. **document is not** — and the create path resists the trait on
every axis. This ADR records why document stays bespoke. (ADR 0004 records the
parallel decision for `skill`.)

## Decision

**`document` stays a bespoke own-table file entity; it is NOT a
`ContentEntity`.**

`document` resists the spine on four independent axes, any one of which would
force a leaky abstraction:

1. **No `contents` row.** `documents` keys off `site_id` directly; there is no
   `content_id` column in any migration. Onboarding would require a schema
   migration + backfill on a privacy/encryption-sensitive table.
2. **No status.** `documents` has no status column and no
   draft/published/scheduled concept, but `contents.status` is `NOT NULL`. A
   spine row would need a *synthetic* status for a file that has no editorial
   lifecycle.
3. **No `site_ids` in the create payload.** `CreateDocumentRequest` carries
   `url` / `file_data` / `mime_type` / `folder_id`; the site arrives as a URL
   **path** parameter. But `ContentEntity::payload_site_ids(payload)` must read
   it from the payload.
4. **File bytes.** Document create takes `file_data: Option<Vec<u8>>` (an
   uploaded, optionally encrypted blob) plus a storage-quota check. The generic
   `create::<E>(pool, payload, auth)` has no slot for either; threading them in
   would leak file-upload concerns into a trait shared by five editorial
   entities.

document is a **file/media** entity (folders, MIME types, storage quota,
private-access TTL, encryption, lockout) — orthogonal to the editorial content
spine.

## Consequences

**Positive**

- The `ContentEntity` abstraction stays honest: every implementor genuinely has
  a spine row, a status, a publish lifecycle, and canonical soft-delete.
- No risky data migration / backfill on the encryption-sensitive `documents`
  table, and no synthetic status muddying the spine.

**Negative / accepted trade-offs**

- document keeps its own bespoke create + soft-delete code (own
  `is_deleted` / `deleted_at` on the `documents` table) that the five spine
  types share via the lifecycle. The portfolio Trash flow already reads
  document deletion state from the document table, so this is consistent.
- The epic #862's "six spine types" framing is corrected to **five** (blog,
  page, legal, project, cv_entry); document and skill are bespoke.

## Revisit triggers

- document is migrated onto the `contents` spine (gains `content_id`, a real
  status model, and editorial lifecycle) for unrelated product reasons →
  re-evaluate onboarding it to `ContentEntity`.
- The create lifecycle grows a first-class way to carry out-of-band binary
  payloads → revisit axis 4.

## References

- Issue #862 — atomic ContentEntity lifecycle epic.
- Issue #864 — onboard document + cv_entry (cv_entry done; document excluded).
- ADR 0004 — the parallel decision for `skill`.
