# backend/src/axum_app/handlers — Route handlers

Axum route handlers, one module per resource (blogs, pages, media, trash, …).
Handlers are the HTTP edge: parse + validate the request, call a model/repo, wrap
the result in a response DTO. **Keep them thin** — no SQL or business logic inline.

## Conventions

- Annotate every handler with `#[utoipa::path(...)]` and register it on the
  `OpenApiRouter`; register schemas in `AxumApiDoc` (`axum_app/mod.rs`). The admin
  SDK is generated from this — an unannotated handler is invisible to clients.
- Extract request bodies as **`ValidatedJson<T>`** (or `ValidatedJson<Vec<T>>` for
  array bodies), never raw `Json<T>`. Don't hand-call `body.validate()` — the
  extractor runs it and returns 422 on failure. CI's `check-validated-extractor.sh`
  fails on any request body that isn't a `ValidatedDto` or exempted with a reason in
  `scripts/validated-extractor-exemptions.txt` (issue #828).
- Get auth/site context from the extractors (`AuthenticatedKey`, `ModuleGuard`,
  `CurrentSite`) rather than re-deriving it.
- Return `ApiError` for failures — it renders as RFC 7807 ProblemDetails.
- Deletes should route through the soft-delete path (Trash) unless the resource is
  explicitly hard-deleted.
