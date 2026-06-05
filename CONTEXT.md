# Forja — Domain Language

Glossary of domain concepts used in architecture discussions, ADRs, and the
deepening plan. Pair with `CLAUDE.md` (project conventions) and the architecture
skill's `LANGUAGE.md` (module / interface / seam / adapter / depth / leverage /
locality).

## Content & sites

**Content entity** — One of Forja's six content types: Blog, Page, Legal,
Document, CV, Project. All link to the shared `contents` table and share the
publish lifecycle.

**Site** — A Forja tenant. The codebase is multi-site: content entities belong
to a site; APIs are scoped via the `CurrentSite` extractor.

**Actor** — The authenticated principal making a request. Resolved via one of
three auth strategies (Clerk JWT, API key, preview token). Used in audit,
RBAC, and validation contexts.

## Publish lifecycle

**ContentLifecycle** — Orchestrator for the create / update / publish / delete
pipeline of content entities. Introduced 2026-05-08 (closed issue #519).

**PublishPipeline** — Single entry point for the synchronous request-time
publish steps (validate → audit → webhook → notify → hooks). Introduced
2026-05-08 (closed issue #523).

## Request validation seam (introduced 2026-05-12)

**Validated\<T>** — A newtype carrying the type-level proof that a request DTO
`T` has passed *both* its `derive(Validate)` field-level checks *and* its
cross-field / context-bound checks. Construction is private to the
`ValidatedDto` trait. Handlers take `Validated<T>` (via the `ValidatedJson<T>`
extractor) so the compiler enforces "validation ran."

**ValidationContext** — Trait describing how to assemble a DTO's validation
context from an in-flight request:
`async fn from_request_parts(parts, state) -> Result<Self, ApiError>`. Per-DTO
context types (`BlogValidationCtx`, `DocumentValidationCtx`, …) carry the
database handle, current site, current actor, and any per-site settings the
DTO's checks need.

**ValidatedDto** — Trait describing how a DTO validates against its `Context`:
`async fn validate_all(self, ctx) -> Result<Validated<Self>, ApiError>`.
Trivial DTOs get a derived `Context = ()` via `#[derive(ValidatedDto)]`.

**ValidatedJson\<T>** — The Axum extractor. Deserializes the request body,
builds `T::Context` from request parts + `AppState`, calls `T::validate_all`,
and yields `Validated<T>`. The wall.

**Validation seam lint gate** — `backend/scripts/check-validated-extractor.sh`
(wired into CI after `cargo clippy`). Once a DTO implements `ValidatedDto`,
its Axum handler must use `ValidatedJson<T>`. Using the raw `Json<T>` bypasses
the seam and trips the gate.

## AI provider seam (proposed 2026-05-29, epic #820)

**PinnedClient** — A sealed transport port in `services/ai_service.rs`: the only
way to send an HTTP request to an AI provider. Its single constructor
`mint(base_url)` runs the SSRF gate (skip for local providers; otherwise
`url_validation::validate_and_resolve_url` + DNS-pin) and *propagates* the
client-build error instead of `unwrap_or_default()`. Holding a remote
`PinnedClient` is therefore type-level proof the URL was validated and the IP
pinned. Private fields + a sealing marker make it un-constructable elsewhere, so
an adapter cannot reach `reqwest::Client::builder()` or skip the pin.

**ProviderAdapter** — Trait describing how one provider shapes requests and
parses responses (`chat`, `vision`, `list_models`, `probe`, plus
`supports_json_mode`). It is handed a `&PinnedClient` it cannot construct. Three
adapters: `OpenAiCompatible` (also DeepSeek / Qwen, which are OpenAI-compatible
presets — not new adapters), `Anthropic`, and `Ollama` (a newtype over
`OpenAiCompatible` overriding only json-mode and `/api/tags` model listing).
Wire-shaping lives in pure free functions so it is unit-testable without a
network.

**AI driver send-helpers** — `send_json<T>(req, StatusPolicy)` / `send_ok(req)`:
the single home of the status → `ApiError` block (including the
401/403 → `bad_request` model-listing case). Prompt-building and
`parse_ai_response` stay *outside* the seam; `record_usage` stays in the
orchestrator.
