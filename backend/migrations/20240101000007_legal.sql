-- Migration: Legal/Consent System
-- Description: Legal documents, consent groups, and items

-- ============================================
-- LEGAL TABLES
-- ============================================

-- Legal Documents
CREATE TABLE legal_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID REFERENCES contents(id) ON DELETE CASCADE,
    cookie_name TEXT NOT NULL,
    document_type legal_doc_type NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Legal Document Localizations
CREATE TABLE legal_document_localizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legal_document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
    locale_id UUID NOT NULL REFERENCES locales(id),
    title TEXT NOT NULL,
    intro TEXT,
    UNIQUE(legal_document_id, locale_id)
);

-- Consent Groups
CREATE TABLE legal_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legal_document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
    cookie_name TEXT NOT NULL,
    display_order SMALLINT NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    default_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Legal Group Localizations
CREATE TABLE legal_group_localizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legal_group_id UUID NOT NULL REFERENCES legal_groups(id) ON DELETE CASCADE,
    locale_id UUID NOT NULL REFERENCES locales(id),
    title TEXT NOT NULL,
    description TEXT,
    UNIQUE(legal_group_id, locale_id)
);

-- Individual Consent Items
CREATE TABLE legal_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legal_group_id UUID NOT NULL REFERENCES legal_groups(id) ON DELETE CASCADE,
    cookie_name TEXT NOT NULL,
    display_order SMALLINT NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Legal Item Localizations
CREATE TABLE legal_item_localizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legal_item_id UUID NOT NULL REFERENCES legal_items(id) ON DELETE CASCADE,
    locale_id UUID NOT NULL REFERENCES locales(id),
    title TEXT NOT NULL,
    content JSONB DEFAULT '[]',
    UNIQUE(legal_item_id, locale_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_legal_documents_content ON legal_documents(content_id);
CREATE INDEX idx_legal_documents_type ON legal_documents(document_type);
CREATE INDEX idx_legal_groups_document ON legal_groups(legal_document_id);
CREATE INDEX idx_legal_items_group ON legal_items(legal_group_id);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_legal_documents_updated_at BEFORE UPDATE ON legal_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
