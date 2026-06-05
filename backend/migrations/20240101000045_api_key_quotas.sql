-- Add quota-based rate limiting columns to api_keys.
-- These replace the per-second/per-minute burst limits with consumption budgets.
-- Old rate_limit_per_* columns are kept for backward compatibility.

ALTER TABLE api_keys
    ADD COLUMN quota_hourly  INTEGER NOT NULL DEFAULT 1000,
    ADD COLUMN quota_daily   INTEGER NOT NULL DEFAULT 10000,
    ADD COLUMN quota_monthly INTEGER NOT NULL DEFAULT 100000;

-- Ensure quotas are positive
ALTER TABLE api_keys
    ADD CONSTRAINT valid_quotas CHECK (
        quota_hourly > 0 AND
        quota_daily > 0 AND
        quota_monthly > 0
    );

COMMENT ON COLUMN api_keys.quota_hourly IS 'Maximum requests per clock hour';
COMMENT ON COLUMN api_keys.quota_daily IS 'Maximum requests per calendar day (UTC)';
COMMENT ON COLUMN api_keys.quota_monthly IS 'Maximum requests per calendar month';
