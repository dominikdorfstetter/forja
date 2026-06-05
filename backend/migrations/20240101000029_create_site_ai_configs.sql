-- AI content assist configuration per site
CREATE TABLE site_ai_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    provider_name VARCHAR(100) NOT NULL,
    base_url VARCHAR(500) NOT NULL,
    api_key_encrypted BYTEA NOT NULL,
    api_key_nonce BYTEA NOT NULL,
    model VARCHAR(200) NOT NULL,
    temperature DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    max_tokens INTEGER NOT NULL DEFAULT 1024,
    system_prompts JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(site_id)
);

CREATE INDEX idx_site_ai_configs_site_id ON site_ai_configs(site_id);
