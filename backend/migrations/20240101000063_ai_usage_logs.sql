-- Migration: AI Usage Log (replaces no-op 20240101000062).
--
-- One row per successful `ai_service::generate()` call. Source of truth for
-- the admin AI usage page and (later) for plan-limit enforcement (#429).
-- Failed AI calls do NOT write a row, so client-side retries cannot
-- double-count (matches the retry-idempotency AC in #647).
--
-- `actor_id` carries `Actor.id` — the Forja-internal stable UUID per auth.
-- It is NOT a foreign key: Forja delegates identity to Clerk (see migration
-- 20240101000020), so there is no `users` table to reference. The same
-- pattern is used by `audit_logs.user_id` after the same drop. DSR
-- anonymisation (#649) will set this column to NULL while preserving the
-- aggregate counter.

CREATE TABLE ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    actor_id UUID,
    -- AiAction serde name (e.g. "seo", "translate", "section_content"). TEXT
    -- rather than a Postgres enum so adding a new action is a one-line Rust
    -- change.
    action TEXT NOT NULL,
    -- "openai" | "anthropic" | "ollama" | custom — same string used in
    -- SiteAiConfig.provider_name.
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    -- Provider-reported token counts. NULL when the provider does not return
    -- usage (e.g. some Ollama responses) — distinguished from 0 so the admin
    -- can see "approximate" vs "exact" in a follow-up.
    input_tokens INTEGER,
    output_tokens INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_logs_site_created ON ai_usage_logs(site_id, created_at DESC);
CREATE INDEX idx_ai_usage_logs_actor ON ai_usage_logs(actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_ai_usage_logs_action ON ai_usage_logs(action);
-- BRIN for time-range scans on large tables (issue #647 perf AC: ≤500ms at 10k rows).
CREATE INDEX idx_ai_usage_logs_created_brin ON ai_usage_logs USING brin(created_at);
