-- Migration: Site-scoped RBAC via Clerk-native memberships
-- Adds site_memberships table, system_admins table, and created_by on sites.

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE site_role AS ENUM ('owner', 'admin', 'editor', 'author', 'reviewer', 'viewer');

-- ============================================
-- TABLES
-- ============================================

-- Site memberships: per-site role for Clerk users
CREATE TABLE site_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_user_id TEXT NOT NULL,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    role site_role NOT NULL DEFAULT 'viewer',
    invited_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(clerk_user_id, site_id)
);

-- System admins: Clerk users with global admin privileges
CREATE TABLE system_admins (
    clerk_user_id TEXT PRIMARY KEY,
    granted_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add created_by to sites (Clerk user ID of creator)
ALTER TABLE sites ADD COLUMN IF NOT EXISTS created_by TEXT;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_site_memberships_clerk_user ON site_memberships(clerk_user_id);
CREATE INDEX idx_site_memberships_site ON site_memberships(site_id);
CREATE INDEX idx_sites_created_by ON sites(created_by) WHERE created_by IS NOT NULL;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_site_memberships_updated_at BEFORE UPDATE ON site_memberships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
