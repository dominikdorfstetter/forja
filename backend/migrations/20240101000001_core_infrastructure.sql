-- Migration: Core Infrastructure Tables
-- Description: Sites, environments, locales, users, and their relationships

-- ============================================
-- MULTI-SITE CORE
-- ============================================

-- Sites (Websites/Tenants)
CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug CITEXT NOT NULL UNIQUE,
    description TEXT,
    logo_url TEXT,
    favicon_url TEXT,
    theme JSONB DEFAULT '{}',
    default_locale_id UUID,
    timezone TEXT DEFAULT 'UTC',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Site Domains
CREATE TABLE site_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    domain CITEXT NOT NULL UNIQUE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ssl_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    redirect_to_primary BOOLEAN NOT NULL DEFAULT FALSE,
    environment environment_type NOT NULL DEFAULT 'production',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Site Settings
CREATE TABLE site_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    setting_value JSONB NOT NULL,
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(site_id, setting_key)
);

-- ============================================
-- CORE INFRASTRUCTURE
-- ============================================

-- Staging Environments
CREATE TABLE environments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name environment_type NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Global Locale Definitions
CREATE TABLE locales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    native_name TEXT,
    direction text_direction NOT NULL DEFAULT 'ltr',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK for sites.default_locale_id
ALTER TABLE sites ADD CONSTRAINT fk_sites_default_locale
    FOREIGN KEY (default_locale_id) REFERENCES locales(id);

-- Site Locales Junction
CREATE TABLE site_locales (
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    locale_id UUID NOT NULL REFERENCES locales(id) ON DELETE CASCADE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    url_prefix VARCHAR(10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (site_id, locale_id)
);

-- Entity Type Registry
CREATE TABLE entity_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name CITEXT NOT NULL UNIQUE,
    table_name TEXT NOT NULL,
    is_versionable BOOLEAN NOT NULL DEFAULT TRUE,
    is_localizable BOOLEAN NOT NULL DEFAULT TRUE,
    is_site_specific BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username CITEXT NOT NULL UNIQUE,
    email CITEXT NOT NULL UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_superadmin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User-Site Access
CREATE TABLE user_sites (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'editor',
    permissions JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, site_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_sites_slug ON sites USING btree(slug);
CREATE INDEX idx_sites_active ON sites(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_site_domains_domain ON site_domains USING btree(domain);
CREATE INDEX idx_site_domains_site ON site_domains(site_id);
CREATE INDEX idx_site_locales_site ON site_locales(site_id);
CREATE INDEX idx_user_sites_user ON user_sites(user_id);
CREATE INDEX idx_user_sites_site ON user_sites(site_id);
CREATE INDEX idx_users_email ON users USING btree(email);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON sites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON site_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_environments_updated_at BEFORE UPDATE ON environments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA
-- ============================================

-- Insert default environments
INSERT INTO environments (name, display_name, is_default) VALUES
    ('development', 'Development', FALSE),
    ('staging', 'Staging', FALSE),
    ('production', 'Production', TRUE);

-- Insert default locales
INSERT INTO locales (code, name, native_name, direction) VALUES
    ('en', 'English', 'English', 'ltr'),
    ('de', 'German', 'Deutsch', 'ltr'),
    ('es', 'Spanish', 'Español', 'ltr');
