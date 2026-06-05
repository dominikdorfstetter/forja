# ADR 0001 — Project list endpoint stays lightweight (no `links[]` / `media[]`)

- **Status**: Accepted
- **Date**: 2026-05-21
- **Issue**: `#740`
- **Siblings**: `#737`, `#738`, `#739`

## Context

After shipping `skill_ids` (#738), `skill_localizations` on `SkillResponse`
(#737), and `localizations[]` on `ProjectResponse` (#739), the dorfstetter.at
consumer flagged that `ProjectResponse` (list shape) still does not carry
`links[]` or `media[]` — those remain on `ProjectDetailResponse` only. The
consumer raised this as ask #4 in `forja_suggestions.md`, but with **no
immediate need**; it surfaced purely as a question of API consistency: should
the list response mirror the detail response, or is the asymmetry intentional?

The current shape (after #738 and #739) is:

```
ProjectResponse           // list item — lightweight + linkage + localized text
  id, slug, display_order, is_featured, dates, status,
  published_at, created_at, updated_at,
  skill_ids: Vec<Uuid>             // shipped in #738
  localizations: Vec<…>            // shipped in #739

ProjectDetailResponse     // detail = list shape + heavier relational graph
  #[serde(flatten)] project: ProjectResponse
  links, media, cv_entry_ids
```

Three pieces of evidence shaped the call:

1. **No consumer demand.** dorfstetter.at index cards render skill pills +
   localized title/short description — `skill_ids` and `localizations` cover
   both. They do not render link icons or media thumbnails per card today, and
   the team has no near-term plans to.

2. **`ProjectMediaResponse` is a reference, not a renderable record.** Its
   payload is `{ media_id, display_order, is_cover }` — no URL, no alt text,
   no MIME type. Embedding `media[]` on the list would not let a consumer
   render media on cards without a follow-up `/media/:id` fan-out. The fetch
   shape would move from `GET /projects → N × GET /projects/:id` to
   `GET /projects → N×M × GET /media/:id`. That is not the elimination of an
   N+1 — it is its relocation.

3. **`ProjectLinkResponse` is self-contained** (`label, url, link_type, icon,
   display_order`) and *could* be card-renderable. But shipping `links[]`
   alone — without `media[]` — would re-introduce the asymmetry one level
   deeper, inside `ProjectResponse` itself: half the related collections
   shipped, half not.

## Decision

**Keep `links[]` and `media[]` detail-only.** The list endpoint
(`GET /sites/{site_id}/projects` and its `/public` twin) stays lightweight:

- core scalar fields (id, slug, dates, status, …)
- linkage IDs that consumers commonly need for indexes (`skill_ids`)
- localized text needed for card rendering (`localizations[]`)

The detail endpoint (`GET /sites/{site_id}/projects/{id}`) remains the single
place to fetch the rest of the relational graph (`links`, `media`,
`cv_entry_ids`).

The contract is now: **list = lightweight metadata + linkage IDs + localized
text; detail = list shape plus the heavier relational graph.** This is
intentional, not an oversight.

## Consequences

**Positive**

- List payload stays bounded by `(projects × locales)` — adding `links` +
  `media` would have made it `(projects × (locales + links + media))`. For a
  20-project page on a site averaging 5 media + 3 links per project, that is
  roughly `20 × 8 = 160` extra nested objects, plus the bulk-join SQL to
  produce them.
- Single source of truth for "what the full graph looks like" — `ProjectDetailResponse`.
- Forces consumers that genuinely need media or links to also fetch the
  surrounding context (publish flags, scheduling) where it belongs, rather
  than rendering half-state from an index payload.

**Negative / accepted trade-offs**

- List-vs-detail asymmetry is preserved. Future consumers may rediscover
  this and need to be pointed at this ADR. Mitigated by documenting the
  contract in the OpenAPI schema descriptions for `ProjectResponse` and
  `ProjectDetailResponse`.
- If a future consumer needs link icons per card, they will need either a
  detail fan-out or a follow-up ticket to revisit this decision. We accept
  that cost rather than pay the payload cost now.

## Revisit triggers

Re-open if any of the following becomes true:

- A consumer needs per-card link icons or media thumbnails on a project
  index, and the detail fan-out is measurably hurting page-load.
- `ProjectMediaResponse` is enriched to include URL/alt/type, removing the
  "relocate the N+1" objection from §2 above. (Even then, weigh against the
  payload-size argument.)
- We add a generic `?include=` opt-in mechanism to list endpoints, at which
  point `links` and `media` become opt-in fields rather than always-on.

## References

- Sibling decisions kept by inference (no separate ADRs needed):
  - `skill_ids` on list: shipped (#738) — common consumer need, lightweight.
  - `localizations[]` on list: shipped (#739) — common consumer need, payload
    bounded by locale count.
  - `cv_entry_ids` on list: detail-only — same rationale as this ADR.
