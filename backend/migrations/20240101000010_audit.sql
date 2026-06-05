-- Migration: Audit System
-- Description: Audit logs and change history tracking

-- ============================================
-- AUDIT TABLES
-- ============================================

-- Audit Logs (append-only)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES sites(id),
    user_id UUID REFERENCES users(id),
    action audit_action NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Full Change History (field-level changes)
CREATE TABLE change_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES sites(id),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    field_name TEXT,
    old_value JSONB,
    new_value JSONB,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_site ON audit_logs(site_id) WHERE site_id IS NOT NULL;
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
-- BRIN index for time-series data (efficient for large tables)
CREATE INDEX idx_audit_logs_created_brin ON audit_logs USING brin(created_at);

CREATE INDEX idx_change_history_entity ON change_history(entity_type, entity_id);
CREATE INDEX idx_change_history_site ON change_history(site_id) WHERE site_id IS NOT NULL;
CREATE INDEX idx_change_history_changed_at ON change_history(changed_at DESC);
CREATE INDEX idx_change_history_changed_at_brin ON change_history USING brin(changed_at);
