-- Privacy-first analytics: pageview tracking with GDPR-compliant design.
-- No IP addresses stored. No raw User-Agent stored. No cookies.
-- visitor_hash uses a daily-rotating salt (site_id + date + IP + UA)
-- so visitors cannot be tracked across days.

CREATE TABLE analytics_pageviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    path VARCHAR(2048) NOT NULL,
    referrer_domain VARCHAR(255),
    visitor_hash VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- BRIN index for time-series queries (efficient for append-only data)
CREATE INDEX idx_analytics_pageviews_created_at ON analytics_pageviews USING BRIN (created_at);
CREATE INDEX idx_analytics_pageviews_site_id ON analytics_pageviews (site_id);
CREATE INDEX idx_analytics_pageviews_site_path ON analytics_pageviews (site_id, path);

CREATE TABLE analytics_daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    path VARCHAR(2048) NOT NULL,
    date DATE NOT NULL,
    view_count INTEGER NOT NULL DEFAULT 0,
    unique_visitors INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(site_id, path, date)
);

CREATE INDEX idx_analytics_daily_stats_site_date ON analytics_daily_stats (site_id, date);
CREATE INDEX idx_analytics_daily_stats_site_path ON analytics_daily_stats (site_id, path, date);
