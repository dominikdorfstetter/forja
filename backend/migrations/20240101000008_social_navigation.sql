-- Migration: Social Links & Navigation
-- Description: Social media links and navigation structure

-- ============================================
-- SOCIAL & NAVIGATION TABLES
-- ============================================

-- Social Links (site-scoped)
CREATE TABLE social_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    icon TEXT NOT NULL,
    alt_text TEXT,
    display_order SMALLINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Navigation Items (site-scoped, hierarchical)
CREATE TABLE navigation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES navigation_items(id) ON DELETE CASCADE,
    page_id UUID REFERENCES pages(id) ON DELETE SET NULL,
    external_url TEXT,
    icon TEXT,
    display_order SMALLINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    open_in_new_tab BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_nav_target CHECK (page_id IS NOT NULL OR external_url IS NOT NULL)
);

-- Navigation Item Localizations
CREATE TABLE navigation_item_localizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    navigation_item_id UUID NOT NULL REFERENCES navigation_items(id) ON DELETE CASCADE,
    locale_id UUID NOT NULL REFERENCES locales(id),
    title TEXT NOT NULL,
    UNIQUE(navigation_item_id, locale_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_social_links_site ON social_links(site_id);
CREATE INDEX idx_social_links_order ON social_links(site_id, display_order) WHERE is_active = TRUE;
CREATE INDEX idx_navigation_items_site ON navigation_items(site_id);
CREATE INDEX idx_navigation_items_parent ON navigation_items(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_navigation_items_page ON navigation_items(page_id) WHERE page_id IS NOT NULL;
CREATE INDEX idx_navigation_items_order ON navigation_items(site_id, display_order) WHERE is_active = TRUE;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_social_links_updated_at BEFORE UPDATE ON social_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_navigation_items_updated_at BEFORE UPDATE ON navigation_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
