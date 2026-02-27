-- Migration: Content System
-- Description: Base content tables for polymorphic content management

-- ============================================
-- CONTENT TABLES
-- ============================================

-- Base Content Table (polymorphic)
CREATE TABLE contents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type_id UUID NOT NULL REFERENCES entity_types(id),
    environment_id UUID NOT NULL REFERENCES environments(id),
    slug CITEXT,
    status content_status NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    publish_start TIMESTAMPTZ,
    publish_end TIMESTAMPTZ,
    current_version SMALLINT NOT NULL DEFAULT 1,
    is_global BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_publish_dates CHECK (publish_end IS NULL OR publish_start IS NULL OR publish_end > publish_start)
);

-- Content-Site Junction
CREATE TABLE content_sites (
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    is_owner BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    display_order SMALLINT,
    site_specific_slug CITEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (content_id, site_id)
);

-- Content Version History
CREATE TABLE content_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    version_number SMALLINT NOT NULL,
    snapshot JSONB NOT NULL,
    change_summary TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(content_id, version_number)
);

-- Localized Content Data
CREATE TABLE content_localizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    locale_id UUID NOT NULL REFERENCES locales(id),
    title TEXT NOT NULL,
    subtitle TEXT,
    excerpt TEXT,
    meta_title TEXT,
    meta_description TEXT,
    translation_status translation_status NOT NULL DEFAULT 'pending',
    translated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(content_id, locale_id)
);

-- Rich Text Content Blocks
CREATE TABLE content_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_localization_id UUID NOT NULL REFERENCES content_localizations(id) ON DELETE CASCADE,
    block_type block_type NOT NULL,
    block_order SMALLINT NOT NULL,
    block_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_contents_slug ON contents USING btree(slug);
CREATE INDEX idx_contents_status ON contents(status);
CREATE INDEX idx_contents_entity_type ON contents(entity_type_id);
CREATE INDEX idx_contents_global ON contents(is_global) WHERE is_global = TRUE;
CREATE INDEX idx_contents_published ON contents(published_at) WHERE status = 'published';
CREATE INDEX idx_contents_deleted ON contents(is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX idx_content_sites_site ON content_sites(site_id);
CREATE INDEX idx_content_sites_content ON content_sites(content_id);
CREATE INDEX idx_content_sites_featured ON content_sites(site_id) WHERE is_featured = TRUE;
CREATE INDEX idx_content_localizations_locale ON content_localizations(locale_id);
CREATE INDEX idx_content_localizations_content ON content_localizations(content_id);
CREATE INDEX idx_content_blocks_localization ON content_blocks(content_localization_id);
CREATE INDEX idx_content_blocks_order ON content_blocks(content_localization_id, block_order);
CREATE INDEX idx_content_blocks_data ON content_blocks USING gin(block_data jsonb_path_ops);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_contents_updated_at BEFORE UPDATE ON contents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_content_localizations_updated_at BEFORE UPDATE ON content_localizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_content_blocks_updated_at BEFORE UPDATE ON content_blocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA: Entity Types
-- ============================================

INSERT INTO entity_types (name, table_name, is_versionable, is_localizable, is_site_specific) VALUES
    ('blog', 'blogs', TRUE, TRUE, TRUE),
    ('page', 'pages', TRUE, TRUE, TRUE),
    ('cv_entry', 'cv_entries', TRUE, TRUE, TRUE),
    ('legal_document', 'legal_documents', TRUE, TRUE, TRUE);
