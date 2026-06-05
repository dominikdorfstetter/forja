-- Add per-task model configuration to AI configs
-- Each task can override the default model, temperature, and max_tokens
ALTER TABLE site_ai_configs
ADD COLUMN task_configs JSONB NOT NULL DEFAULT '{}';

-- Example structure:
-- {
--   "seo": { "model": "gpt-4o-mini", "temperature": 0.5, "max_tokens": 512 },
--   "tagging": { "model": "gpt-4o", "temperature": 0.3, "max_tokens": 256 },
--   "alt_text": { "model": "gpt-4o", "temperature": 0.5, "max_tokens": 512 }
-- }
COMMENT ON COLUMN site_ai_configs.task_configs IS 'Per-task AI model overrides (model, temperature, max_tokens per action)';
