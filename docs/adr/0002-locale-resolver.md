# ADR 0002 — Optional `?locale=` resolver on localized endpoints

- **Status**: Accepted
- **Date**: 2026-05-21
- **Issue**: `#744`
- **Builds on**: [ADR 0001](0001-project-list-detail-asymmetry.md) (list/detail
  asymmetry), `#737`, `#739`, `#741`, `#745`, `#747`, `#749`

## Context

After shipping `localizations[]` on the list shapes of `ProjectResponse`
(#739/#747), `CvEntryResponse` (#741/#749), and `SkillResponse` (#737/#745),
every localized endpoint returns the full `Vec<…LocalizationResponse>` —
typically one entry per active site locale (Forja admin ships in 11 locales;
consumer sites configure their own subset).

The dorfstetter.at consumer renders one localization at a time. It currently
picks the right entry client-side via a shared
`pickLocalization(entity, currentLocale, locales)` helper. The consumer asked
(forja_suggestions §8, filed as #744) whether the server could collapse that
step by accepting `?locale={code}` and returning a single resolved entry.

The ask is explicitly **stretch** — the consumer-unblock work (#737, #738,
#739, #741) shipped without this, and the helper works. So this ADR exists to
answer two questions before any code is written:

1. *Should* we build the resolver at all? (i.e. is the cost-benefit worth it)
2. *If we do*, what are the fallback semantics, response shape, and
   header-handling rules — so that the implementation across ~10 endpoints
   plus the SDK doesn't have to re-litigate them per PR.

Three pieces of evidence shape the call:

1. **The consumer pain is real but bounded.** `pickLocalization` is ~20 lines
   and runs in-memory after the payload is already on the wire. There is no
   measured page-load impact. The argument for the resolver is wire-size — a
   `?locale=` response is roughly `1 / locale_count` the size of the all-
   locales response — not latency.

2. **Admin tools need *every* localization.** The sitemap generator, the
   localization editor, and the publish-status overview all iterate
   `localizations[]`. Any resolver must be **opt-in** (i.e. omitting
   `?locale=` keeps current behaviour exactly) — replacing the current shape
   is non-negotiable.

3. **Fallback semantics are easy to over-engineer.** The space includes
   `Accept-Language` parsing with q-values, regional fallbacks (`de-AT` →
   `de`), and "best match" RFC 4647 lookups. Each adds cache-key cardinality
   and surface area for bugs. The consumer is a server-side Astro adapter
   (`src/lib/forja-real.ts`) that already knows the exact locale code per
   route — it does not need browser-style content negotiation.

## Decision

**Build the resolver, with a deliberately narrow contract.**

### 1. Fallback chain

The resolver applies this chain, in order, returning the first hit:

1. Exact match on `?locale={code}` against the entity's localizations.
2. The site's default locale (`site_locales.is_default = TRUE`).
3. The first remaining localization, ordered by `locale.code` ascending —
   matches the existing `ORDER BY sl.is_default DESC, l.code ASC` in
   `repos/site_locale.rs`.
4. If the entity has **zero** localizations: return the entity with
   `localizations: []`. Do **not** return 404 — the entity exists; only
   localized text is missing. The consumer decides whether to render.

`?locale=` accepting an *unknown-to-this-site* code (e.g. `?locale=fr` on a
site configured for `{de, en}`) falls through to step 2 silently. No `400`,
no `Warning` header — the chain is the contract, and it always produces an
answer. This favours consumer simplicity over strict validation.

### 2. Response shape

**Keep `localizations` as an array, collapsed to one element.** Do not
flatten to top-level `title` / `description` fields.

```jsonc
// GET /projects/{id}?locale=en
{
  "id": "...",
  "slug": "...",
  "skill_ids": [...],
  "localizations": [
    { "id": "...", "locale_id": "...", "title": "...", "short_description": "...", "description": "..." }
  ]
}
```

Rationale: the SDK types, OpenAPI schemas, and consumer code paths that
already iterate `localizations[]` keep working unchanged. The only diff at
call sites is `localizations[0]` instead of `pickLocalization(entity, locale)`.
Flattening would force a schema fork (`ProjectResponse` vs.
`ProjectLocalizedResponse`) and double the surface of every endpoint. We
trade one extra array-index for that complexity not existing.

### 3. `Accept-Language` is NOT consulted

`?locale=` is the sole input. If the query param is absent, the response
returns all localizations as today — even if `Accept-Language` is present on
the request.

Rationale:
- The known consumer is a server-side adapter that already knows the locale.
- `Accept-Language` parsing with q-values and regional fallback materially
  enlarges the resolver and its cache-key footprint.
- Browser-driven consumption (if any future consumer wants it) can be added
  later as a second, explicitly-named feature (`?locale=auto`, or a new
  header opt-in). This ADR does not preclude that — it just doesn't ship it.

### 4. Cache-key implications

`?locale=` becomes part of any downstream cache key (CDN, response cache,
`If-None-Match`/`ETag`-bearing caches). Cardinality is bounded:
`endpoint_variants × locale_count + 1` (the `+1` is the "no locale param"
variant). For a typical 5-locale site this is a 6× multiplier on the
endpoints in scope — acceptable, and explicitly documented here so a future
caching layer (Phase 0 of the caching epic) builds the key correctly from
day one.

### 5. Endpoints in scope

Initial sweep (collapses `localizations[]` to one element when `?locale=` is
provided):

- `GET /api/v1/sites/{site_id}/projects` and `/projects/public`
- `GET /api/v1/sites/{site_id}/projects/{id}`
- `GET /api/v1/sites/{site_id}/cv-entries`
- `GET /api/v1/sites/{site_id}/cv-entries/{id}`
- `GET /api/v1/sites/{site_id}/skills`
- `GET /api/v1/sites/{site_id}/skills/{id}`
- `GET /api/v1/sites/{site_id}/pages` and `/pages/{slug}` — audit shape
  before applying; bring under the same resolver if it already returns a
  localizations array, otherwise file a follow-up.
- Localized blog and legal endpoints — audit and include during
  implementation.

**Explicitly out of scope (must keep all localizations):**

- Admin-only endpoints: sitemap generation, localization editor, publish
  overview, anything in the admin SPA.
- Endpoints whose response already collapses localizations (e.g.
  `SiteLocaleResponse` itself).
- Endpoints that return only IDs (no `localizations[]` to collapse).

### 6. Implementation seams

- **Backend**: one `ResolveLocale` axum extractor parsing `Option<String>`
  from the query string. One shared `resolve_localization` function over
  `(localizations: &[T], requested: Option<&Uuid>, site_default: Option<&Uuid>)`
  with the chain above. Per-endpoint: wrap the existing repo result and
  truncate `localizations` to the resolver's pick when the param is present.
- **OpenAPI**: each affected `#[utoipa::path]` documents the optional
  parameter; the response schema description notes that when the parameter
  is present, `localizations` contains exactly one element.
- **SDK** (`libs/client`): each list/detail method gains an optional
  `{ locale?: string }` argument; the TypeScript return type stays
  `localizations: Localization[]` (no tuple narrowing — keeps the type
  identical to the no-param shape per Decision 2).

### 7. Phasing

To keep PRs reviewable, implementation is broken into sub-issues filed
against #744 (per the project's vertical-slice tracer-bullet convention),
one entity family at a time:

1. Shared resolver + `ResolveLocale` extractor + tests (tracer bullet:
   `?locale=en` on `/projects` returns one localization).
2. Cv-entries.
3. Skills.
4. Pages (after the audit).
5. Blog + legal (after their audit).
6. SDK methods updated in lockstep with the backend (one SDK PR per backend
   family, or a single sweep at the end — implementer's call).
7. Consumer-side cleanup of `pickLocalization` in dorfstetter.at — tracked
   outside this repo.

## Consequences

**Positive**

- Wire-size cut for the typical consumer call by roughly `1 / locale_count`.
- Single canonical fallback chain — no per-endpoint divergence.
- Shape compatibility: no SDK breaking change, no parallel response type.
- Admin tools are untouched — no risk to sitemap or editor flows.

**Negative / accepted trade-offs**

- Resolver code path exists in every affected handler. Mitigated by
  centralising into one extractor + one helper, exercised by a shared unit
  test suite.
- `?locale=fr` against a site with `{de, en}` silently returns the default
  rather than `400`-ing. Documented in the OpenAPI description and this ADR.
  The cost of strict validation (round-trip to fetch the site's locale set
  to validate the param) is judged not worth it.
- `Accept-Language` users are not served. Acceptable: the known consumer
  has its own routing-derived locale. Revisit if a browser consumer asks.
- Cache key cardinality goes up by the locale-count factor on affected
  endpoints. Documented here so the caching layer accounts for it.

## Revisit triggers

Re-open if any of the following becomes true:

- A consumer needs `Accept-Language` negotiation — file as a follow-up,
  reuse the resolver but feed it a parsed header instead of the query.
- Wire-size measurements show the all-locales response is *also* a
  meaningful tax on the admin SPA (e.g. content-heavy sites with 8+
  locales). Today it isn't — the editor wants all locales by definition,
  and the SPA isn't latency-bound on these endpoints.
- The caching epic lands and reveals that `?locale=` cache-key explosion is
  worse than projected — at which point we may want to flip to header-based
  negotiation with a `Vary: Accept-Language` boundary.
- A consumer wants strict `400`-on-unknown-locale behaviour — this can be
  added as `?locale=fr&strict=1` or a separate endpoint variant without
  breaking the existing contract.

## References

- ADR 0001 — list/detail asymmetry. Same pattern of recording an API-shape
  decision rather than carrying it implicitly in code.
- forja_suggestions.md §8 (dorfstetter.at consumer repo) — original ask.
- `backend/src/repos/site_locale.rs` — current `is_default` model and
  `ORDER BY is_default DESC, code ASC` query, which Decision §1.3 reuses.
- `backend/src/dto/project.rs` (and siblings under `dto/`) — current
  `localizations: Vec<…LocalizationResponse>` shapes that this resolver
  collapses to a 1-element array.
