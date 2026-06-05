-- Migration: Taxonomy System
-- Description: Tags and categories for content classification

-- ============================================
-- TAXONOMY TABLES
-- ============================================

-- Tags (flat taxonomy)
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug CITEXT NOT NULL UNIQUE,
    is_global BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tag-Site Junction
CREATE TABLE tag_sites (
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    is_owner BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tag_id, site_id)
);

-- Tag Localizations
CREATE TABLE tag_localizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    locale_id UUID NOT NULL REFERENCES locales(id),
    name TEXT NOT NULL,
    UNIQUE(tag_id, locale_id)
);

-- Categories (hierarchical taxonomy)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    slug CITEXT NOT NULL,
    is_global BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE NULLS NOT DISTINCT (parent_id, slug)
);

-- Category-Site Junction
CREATE TABLE category_sites (
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    is_owner BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (category_id, site_id)
);

-- Category Localizations
CREATE TABLE category_localizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    locale_id UUID NOT NULL REFERENCES locales(id),
    name TEXT NOT NULL,
    description TEXT,
    UNIQUE(category_id, locale_id)
);

-- Content Tags Junction
CREATE TABLE content_tags (
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (content_id, tag_id)
);

-- Content Categories Junction
CREATE TABLE content_categories (
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (content_id, category_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_tags_slug ON tags USING btree(slug);
CREATE INDEX idx_tags_global ON tags(is_global) WHERE is_global = TRUE;
CREATE INDEX idx_tag_sites_site ON tag_sites(site_id);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories USING btree(slug);
CREATE INDEX idx_categories_global ON categories(is_global) WHERE is_global = TRUE;
CREATE INDEX idx_category_sites_site ON category_sites(site_id);
CREATE INDEX idx_content_tags_tag ON content_tags(tag_id);
CREATE INDEX idx_content_tags_content ON content_tags(content_id);
CREATE INDEX idx_content_categories_category ON content_categories(category_id);
CREATE INDEX idx_content_categories_content ON content_categories(content_id);
CREATE INDEX idx_content_categories_primary ON content_categories(content_id) WHERE is_primary = TRUE;
