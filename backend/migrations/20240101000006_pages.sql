-- Migration: Pages System
-- Description: Generic pages and landing page sections

-- ============================================
-- PAGES TABLES
-- ============================================

-- Generic Pages
CREATE TABLE pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE UNIQUE,
    route CITEXT NOT NULL,
    page_type page_type NOT NULL DEFAULT 'static',
    template TEXT,
    is_in_navigation BOOLEAN NOT NULL DEFAULT FALSE,
    navigation_order SMALLINT,
    parent_page_id UUID REFERENCES pages(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Landing Page Sections
CREATE TABLE page_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    section_type section_type NOT NULL,
    display_order SMALLINT NOT NULL,
    cover_image_id UUID REFERENCES media_files(id),
    call_to_action_route TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Section Localizations
CREATE TABLE page_section_localizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_section_id UUID NOT NULL REFERENCES page_sections(id) ON DELETE CASCADE,
    locale_id UUID NOT NULL REFERENCES locales(id),
    title TEXT,
    text TEXT,
    button_text TEXT,
    UNIQUE(page_section_id, locale_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_pages_route ON pages USING btree(route);
CREATE INDEX idx_pages_content ON pages(content_id);
CREATE INDEX idx_pages_type ON pages(page_type);
CREATE INDEX idx_pages_parent ON pages(parent_page_id) WHERE parent_page_id IS NOT NULL;
CREATE INDEX idx_pages_navigation ON pages(navigation_order) WHERE is_in_navigation = TRUE;
CREATE INDEX idx_page_sections_page ON page_sections(page_id);
CREATE INDEX idx_page_sections_order ON page_sections(page_id, display_order);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_pages_updated_at BEFORE UPDATE ON pages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_page_sections_updated_at BEFORE UPDATE ON page_sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
