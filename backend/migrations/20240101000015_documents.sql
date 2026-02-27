-- Migration: Document Library
-- Description: Site-level document library with localization and blog attachment

-- ============================================
-- DOCUMENT FOLDER HIERARCHY
-- ============================================

CREATE TABLE document_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES document_folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    display_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- DOCUMENT LIBRARY
-- ============================================

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES document_folders(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    document_type TEXT NOT NULL,
    display_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- DOCUMENT LOCALIZATIONS
-- ============================================

CREATE TABLE document_localizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    locale_id UUID NOT NULL REFERENCES locales(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(document_id, locale_id)
);

-- ============================================
-- BLOG <-> DOCUMENT JUNCTION
-- ============================================

CREATE TABLE blog_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    display_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(blog_id, document_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_document_folders_site ON document_folders(site_id);
CREATE INDEX idx_document_folders_parent ON document_folders(parent_id);
CREATE INDEX idx_documents_site ON documents(site_id);
CREATE INDEX idx_documents_folder ON documents(folder_id);
CREATE INDEX idx_document_locs_doc ON document_localizations(document_id);
CREATE INDEX idx_blog_documents_blog ON blog_documents(blog_id);
CREATE INDEX idx_blog_documents_doc ON blog_documents(document_id);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_document_folders_updated_at BEFORE UPDATE ON document_folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_document_localizations_updated_at BEFORE UPDATE ON document_localizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
