-- URL redirects (301/302) per site
CREATE TABLE redirects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    source_path TEXT NOT NULL,
    destination_path TEXT NOT NULL,
    status_code SMALLINT NOT NULL DEFAULT 301,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_redirect_status_code CHECK (status_code IN (301, 302)),
    CONSTRAINT chk_redirect_no_self CHECK (source_path != destination_path),
    CONSTRAINT uq_redirects_site_source UNIQUE (site_id, source_path)
);

CREATE INDEX idx_redirects_site_id ON redirects(site_id);
CREATE INDEX idx_redirects_lookup ON redirects(site_id, source_path) WHERE is_active = TRUE;

CREATE TRIGGER update_redirects_updated_at BEFORE UPDATE ON redirects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
