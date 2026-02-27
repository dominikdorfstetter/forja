-- API Key Management
-- Provides authentication and authorization via API keys with usage tracking

-- API Key permission levels
CREATE TYPE api_key_permission AS ENUM (
    'master',      -- Can manage all API keys and has full access
    'admin',       -- Full CRUD access to content
    'write',       -- Can create and update content
    'read'         -- Read-only access
);

-- API Key status
CREATE TYPE api_key_status AS ENUM (
    'active',
    'blocked',
    'expired',
    'revoked'
);

-- Main API keys table
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Key identification
    key_hash VARCHAR(128) NOT NULL UNIQUE,  -- SHA-256 hash of the actual key
    key_prefix VARCHAR(8) NOT NULL,         -- First 8 chars for identification (e.g., "dk_live_")
    name VARCHAR(100) NOT NULL,             -- Human-readable name
    description TEXT,

    -- Permissions
    permission api_key_permission NOT NULL DEFAULT 'read',

    -- Site scope (NULL means all sites for master/admin keys)
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,

    -- Status and lifecycle
    status api_key_status NOT NULL DEFAULT 'active',

    -- Rate limiting
    rate_limit_per_second INTEGER DEFAULT 10,
    rate_limit_per_minute INTEGER DEFAULT 100,
    rate_limit_per_hour INTEGER DEFAULT 1000,
    rate_limit_per_day INTEGER DEFAULT 10000,

    -- Usage tracking
    total_requests BIGINT NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    last_used_ip INET,

    -- Expiration
    expires_at TIMESTAMPTZ,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Audit
    created_by UUID REFERENCES api_keys(id),  -- Which key created this key
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    blocked_at TIMESTAMPTZ,
    blocked_reason TEXT,

    -- Constraints
    CONSTRAINT valid_rate_limits CHECK (
        rate_limit_per_second > 0 AND
        rate_limit_per_minute > 0 AND
        rate_limit_per_hour > 0 AND
        rate_limit_per_day > 0
    )
);

-- API Key usage log for detailed tracking
CREATE TABLE api_key_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,

    -- Request details
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code SMALLINT NOT NULL,
    response_time_ms INTEGER NOT NULL,

    -- Client info
    ip_address INET,
    user_agent TEXT,

    -- Request/Response size
    request_size INTEGER,
    response_size INTEGER,

    -- Error tracking
    error_message TEXT,

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily usage aggregation for reporting
CREATE TABLE api_key_usage_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Aggregated stats
    total_requests BIGINT NOT NULL DEFAULT 0,
    successful_requests BIGINT NOT NULL DEFAULT 0,
    failed_requests BIGINT NOT NULL DEFAULT 0,

    -- Response time stats (in ms)
    avg_response_time INTEGER,
    min_response_time INTEGER,
    max_response_time INTEGER,

    -- Bandwidth
    total_request_bytes BIGINT DEFAULT 0,
    total_response_bytes BIGINT DEFAULT 0,

    -- Rate limit hits
    rate_limit_hits INTEGER DEFAULT 0,

    -- Unique IPs
    unique_ips INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(api_key_id, date)
);

-- IP allowlist/blocklist for API keys
CREATE TABLE api_key_ip_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,

    -- IP or CIDR range
    ip_range CIDR NOT NULL,

    -- Rule type
    rule_type VARCHAR(10) NOT NULL CHECK (rule_type IN ('allow', 'block')),

    -- Description
    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(api_key_id, ip_range)
);

-- Indexes for performance
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_status ON api_keys(status);
CREATE INDEX idx_api_keys_site_id ON api_keys(site_id);
CREATE INDEX idx_api_keys_permission ON api_keys(permission);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX idx_api_key_usage_api_key_id ON api_key_usage(api_key_id);
CREATE INDEX idx_api_key_usage_created_at ON api_key_usage(created_at);
CREATE INDEX idx_api_key_usage_endpoint ON api_key_usage(endpoint);

CREATE INDEX idx_api_key_usage_daily_api_key_id ON api_key_usage_daily(api_key_id);
CREATE INDEX idx_api_key_usage_daily_date ON api_key_usage_daily(date);

CREATE INDEX idx_api_key_ip_rules_api_key_id ON api_key_ip_rules(api_key_id);

-- Trigger to update updated_at
CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_key_usage_daily_updated_at
    BEFORE UPDATE ON api_key_usage_daily
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to increment API key usage
CREATE OR REPLACE FUNCTION increment_api_key_usage(
    p_api_key_id UUID,
    p_ip_address INET DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE api_keys
    SET
        total_requests = total_requests + 1,
        last_used_at = NOW(),
        last_used_ip = COALESCE(p_ip_address, last_used_ip)
    WHERE id = p_api_key_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if API key is valid and not rate limited
CREATE OR REPLACE FUNCTION check_api_key_valid(
    p_key_hash VARCHAR(128)
) RETURNS TABLE (
    id UUID,
    permission api_key_permission,
    site_id UUID,
    is_valid BOOLEAN,
    reason TEXT
) AS $$
DECLARE
    v_key RECORD;
BEGIN
    SELECT * INTO v_key FROM api_keys ak WHERE ak.key_hash = p_key_hash;

    IF NOT FOUND THEN
        RETURN QUERY SELECT
            NULL::UUID,
            NULL::api_key_permission,
            NULL::UUID,
            FALSE,
            'API key not found'::TEXT;
        RETURN;
    END IF;

    -- Check status
    IF v_key.status != 'active' THEN
        RETURN QUERY SELECT
            v_key.id,
            v_key.permission,
            v_key.site_id,
            FALSE,
            ('API key is ' || v_key.status::TEXT)::TEXT;
        RETURN;
    END IF;

    -- Check expiration
    IF v_key.expires_at IS NOT NULL AND v_key.expires_at < NOW() THEN
        -- Update status to expired
        UPDATE api_keys SET status = 'expired' WHERE api_keys.id = v_key.id;

        RETURN QUERY SELECT
            v_key.id,
            v_key.permission,
            v_key.site_id,
            FALSE,
            'API key has expired'::TEXT;
        RETURN;
    END IF;

    -- Key is valid
    RETURN QUERY SELECT
        v_key.id,
        v_key.permission,
        v_key.site_id,
        TRUE,
        NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE api_keys IS 'API keys for authentication and authorization';
COMMENT ON TABLE api_key_usage IS 'Detailed API key usage log';
COMMENT ON TABLE api_key_usage_daily IS 'Daily aggregated API key usage statistics';
COMMENT ON TABLE api_key_ip_rules IS 'IP allowlist/blocklist rules for API keys';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash of the actual API key - never store plaintext';
COMMENT ON COLUMN api_keys.key_prefix IS 'First 8 chars of key for identification without exposing full key';
