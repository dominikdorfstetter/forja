-- Migration: Media Folders
-- Description: Add folder organization to media files

-- ============================================
-- MEDIA FOLDER HIERARCHY
-- ============================================

CREATE TABLE media_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES media_folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    display_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ADD FOLDER REFERENCE TO MEDIA FILES
-- ============================================

ALTER TABLE media_files ADD COLUMN folder_id UUID REFERENCES media_folders(id) ON DELETE SET NULL;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_media_folders_site ON media_folders(site_id);
CREATE INDEX idx_media_folders_parent ON media_folders(parent_id);
CREATE INDEX idx_media_files_folder ON media_files(folder_id);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_media_folders_updated_at BEFORE UPDATE ON media_folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
