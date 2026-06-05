# backend/src/services — Integrations & background workers

External-system integrations (S3 storage, Clerk IdP, AI/LLM providers) and the
background workers that run on startup.

## Background workers

Each worker exposes `pub fn spawn(state: AppState)` and is aggregated by
`axum_app::workers::spawn_all(state)`, called once at boot. Examples:
`publish_scheduler`, `trash_cleanup`, `forms_retention_cleanup`, `audit_cleanup`,
`usage_aggregation`, `anomaly_detection`, `webhook_retry_worker`,
`webhook_flush_worker`, `site_export_worker`, `demo_mode`.

## Conventions

- New worker → expose `spawn(state)` and register it in `spawn_all`; don't start
  tasks ad hoc elsewhere.
- `trash_cleanup` purges soft-deleted items after the retention window for the
  entity types it covers (content/blogs/pages, media, documents, legal, social,
  navigation) — extend it when you make a new entity soft-deletable.
- Integrations should be provider-agnostic where Forja serves arbitrary client
  sites (AI, analytics, captcha, payments) — interface + per-site config, not a
  hardcoded vendor.
- AI provider calls go through the `ai_service` seam: a sealed `PinnedClient`
  (the ONLY HTTP-client constructor — its `mint` runs the SSRF gate + DNS pin
  and propagates build errors) and `ProviderAdapter`s (OpenAI-compatible,
  Anthropic, Ollama). Never build a `reqwest::Client` for a provider inline; add
  an adapter and shape requests in pure free fns. See `CONTEXT.md`.
- Keep secrets in config/env; never log credentials or PII.
