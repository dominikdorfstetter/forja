-- Migration: Navigation Menus
-- Description: Named menu containers (primary, footer, sidebar, etc.) with localized names

-- ============================================
-- NAVIGATION MENUS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS navigation_menus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    description TEXT,
    max_depth SMALLINT NOT NULL DEFAULT 3,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_navigation_menus_site_slug UNIQUE(site_id, slug),
    CONSTRAINT chk_navigation_menus_slug CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$'),
    CONSTRAINT chk_navigation_menus_max_depth CHECK (max_depth BETWEEN 1 AND 10)
);

-- Navigation Menu Localizations (translatable display names)
CREATE TABLE IF NOT EXISTS navigation_menu_localizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    navigation_menu_id UUID NOT NULL REFERENCES navigation_menus(id) ON DELETE CASCADE,
    locale_id UUID NOT NULL REFERENCES locales(id),
    name TEXT NOT NULL,
    UNIQUE(navigation_menu_id, locale_id)
);

-- ============================================
-- ALTER navigation_items: add menu_id
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'navigation_items' AND column_name = 'menu_id'
    ) THEN
        ALTER TABLE navigation_items ADD COLUMN menu_id UUID REFERENCES navigation_menus(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================
-- DATA MIGRATION: backfill menu_id
-- ============================================

-- Create a "primary" menu for each site that already has navigation items
INSERT INTO navigation_menus (id, site_id, slug, description)
SELECT DISTINCT
    uuid_generate_v4(),
    ni.site_id,
    'primary',
    'Primary navigation menu'
FROM navigation_items ni
WHERE NOT EXISTS (
    SELECT 1 FROM navigation_menus nm WHERE nm.site_id = ni.site_id AND nm.slug = 'primary'
)
ON CONFLICT (site_id, slug) DO NOTHING;

-- Backfill menu_id on all existing navigation items that don't have one yet
UPDATE navigation_items ni
SET menu_id = nm.id
FROM navigation_menus nm
WHERE nm.site_id = ni.site_id AND nm.slug = 'primary'
  AND ni.menu_id IS NULL;

-- Now make menu_id NOT NULL (idempotent: only if currently nullable)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'navigation_items' AND column_name = 'menu_id' AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE navigation_items ALTER COLUMN menu_id SET NOT NULL;
    END IF;
END $$;

-- ============================================
-- INDEXES (IF NOT EXISTS)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_navigation_menus_site ON navigation_menus(site_id);
CREATE INDEX IF NOT EXISTS idx_navigation_menus_site_slug ON navigation_menus(site_id, slug);
CREATE INDEX IF NOT EXISTS idx_navigation_items_menu ON navigation_items(menu_id);

-- Replace old site-scoped order index with menu-scoped one
DROP INDEX IF EXISTS idx_navigation_items_order;
CREATE INDEX IF NOT EXISTS idx_navigation_items_menu_order ON navigation_items(menu_id, display_order) WHERE is_active = TRUE;

-- ============================================
-- TRIGGERS
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_navigation_menus_updated_at'
    ) THEN
        CREATE TRIGGER update_navigation_menus_updated_at BEFORE UPDATE ON navigation_menus
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
