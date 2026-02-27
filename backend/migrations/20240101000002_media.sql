-- Migration: Media Library
-- Description: Media files, variants, and metadata tables

-- ============================================
-- MEDIA TABLES
-- ============================================

-- Core Media Files
CREATE TABLE media_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    storage_provider storage_provider NOT NULL DEFAULT 'local',
    storage_path TEXT NOT NULL,
    public_url TEXT,
    checksum CHAR(64),
    width SMALLINT,
    height SMALLINT,
    duration INTEGER,
    uploaded_by UUID REFERENCES users(id),
    environment_id UUID REFERENCES environments(id),
    is_global BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Media-Site Junction
CREATE TABLE media_sites (
    media_file_id UUID NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    is_owner BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (media_file_id, site_id)
);

-- Image Variants
CREATE TABLE media_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    media_file_id UUID NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
    variant_name media_variant_type NOT NULL,
    width SMALLINT NOT NULL,
    height SMALLINT NOT NULL,
    file_size INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    public_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(media_file_id, variant_name)
);

-- Localized Media Metadata
CREATE TABLE media_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    media_file_id UUID NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
    locale_id UUID NOT NULL REFERENCES locales(id),
    alt_text TEXT,
    caption TEXT,
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(media_file_id, locale_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_media_files_checksum ON media_files(checksum) WHERE checksum IS NOT NULL;
CREATE INDEX idx_media_files_mime ON media_files(mime_type);
CREATE INDEX idx_media_sites_site ON media_sites(site_id);
CREATE INDEX idx_media_sites_media ON media_sites(media_file_id);
CREATE INDEX idx_media_files_global ON media_files(is_global) WHERE is_global = TRUE;
CREATE INDEX idx_media_files_deleted ON media_files(is_deleted) WHERE is_deleted = FALSE;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_media_files_updated_at BEFORE UPDATE ON media_files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_media_metadata_updated_at BEFORE UPDATE ON media_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
