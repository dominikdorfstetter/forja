-- ============================================================================
-- Demo Site Seed (Production-Safe)
-- ============================================================================
-- Creates the "John Forja" demo site with sample content.
-- Safe to run on existing databases — does NOT truncate or modify existing data.
-- Skips if the demo site already exists with the current seed version.
--
-- Usage:
--   psql -U forja -d forja -f backend/scripts/demo_seed.sql
--
-- Seed version: 1
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_existing_site UUID;
    v_existing_version TEXT;
    -- Bump this whenever the seed payload changes. The version mismatch
    -- branch below cleans up the old demo site (cascade-deletes all its
    -- contents via FK ON DELETE CASCADE) and re-seeds from scratch — so
    -- bumping is what makes "re-seed whenever I want" actually work.
    --   v1 → original content
    --   v2 → adds 2 forms + 90 days of analytics
    --   v3 → analytics overhauled: raw events with realistic shape
    --        (weekday/weekend, viral spikes, time-of-day, returning
    --        visitors, referrer mix) instead of flat per-path daily rows
    --   v4 → analytics noise math: abs(hashtext()) + 60-event floor so
    --        weekend dips look like dips, not floor-clamped flats
    --   v5 → adds 10 form submissions across all four statuses
    --        (new/in_review/resolved/archived) with status logs + notes
    --        so the submissions triage UI has something to render
    --   v6 → schema #762: slugs are per-site now, not globally unique.
    --        Tags/skills/categories are owned by the demo site and torn
    --        down with it on reseed; catalog inserts no longer use
    --        ON CONFLICT (slug) (the global unique it targeted is gone).
    v_seed_version CONSTANT TEXT := '7';

    -- Locale IDs (from migration seed)
    v_locale_en  UUID;
    v_locale_de  UUID;
    v_locale_es  UUID;

    -- Environment IDs (from migration seed)
    v_env_dev    UUID;
    v_env_prod   UUID;

    -- Entity type IDs (from migration seed)
    v_et_blog    UUID;
    v_et_page    UUID;
    v_et_cv      UUID;
    v_et_legal   UUID;
    v_et_project UUID;

    -- Site
    v_site1      UUID;

    -- User placeholders (fake UUIDs for orphaned created_by/uploaded_by columns)
    v_user_admin UUID;

    -- Media
    v_media_avatar      UUID;
    v_media_hero        UUID;
    v_media_blog1_cover UUID;
    v_media_blog2_cover UUID;
    v_media_blog3_cover UUID;
    v_media_blog4_cover UUID;
    v_media_blog5_cover UUID;
    v_media_blog6_cover UUID;
    v_media_blog7_cover UUID;
    v_media_blog8_cover UUID;
    v_media_logo        UUID;

    -- Content IDs
    v_content_blog1      UUID;
    v_content_blog2      UUID;
    v_content_blog3      UUID;
    v_content_blog4      UUID;
    v_content_blog5      UUID;
    v_content_blog6      UUID;
    v_content_blog7      UUID;  -- in_review status
    v_content_blog8      UUID;  -- scheduled status
    v_content_page_home  UUID;
    v_content_page_about UUID;
    v_content_page_contact UUID;
    v_content_cv1        UUID;
    v_content_cv2        UUID;
    v_content_cv3        UUID;
    v_content_legal_cookie UUID;
    v_content_legal_privacy UUID;
    v_content_legal_imprint UUID;
    v_content_legal_tos UUID;
    v_content_project1   UUID;
    v_content_project2   UUID;
    v_content_project3   UUID;

    -- Blog IDs
    v_blog1 UUID;
    v_blog2 UUID;
    v_blog3 UUID;
    v_blog4 UUID;
    v_blog5 UUID;
    v_blog6 UUID;
    v_blog7 UUID;
    v_blog8 UUID;

    -- Page IDs
    v_page_home    UUID;
    v_page_about   UUID;
    v_page_contact UUID;

    -- CV Entry IDs
    v_cv1 UUID;
    v_cv2 UUID;
    v_cv3 UUID;

    -- Legal IDs
    v_legal_cookie  UUID;
    v_legal_privacy UUID;
    v_legal_imprint UUID;
    v_legal_tos     UUID;

    -- Project IDs
    v_project1 UUID;
    v_project2 UUID;
    v_project3 UUID;

    -- Content localization IDs (needed for content_blocks FK)
    v_cl_blog1_en UUID;
    v_cl_blog1_de UUID;
    v_cl_blog2_en UUID;
    v_cl_blog2_de UUID;
    v_cl_blog3_en UUID;
    v_cl_blog3_de UUID;
    v_cl_blog4_en UUID;
    v_cl_blog5_en UUID;
    v_cl_blog6_en UUID;
    v_cl_blog7_en UUID;
    v_cl_blog8_en UUID;
    v_cl_home_en  UUID;
    v_cl_home_de  UUID;
    v_cl_about_en UUID;
    v_cl_about_de UUID;
    v_cl_contact_en UUID;

    -- Tags
    v_tag_rust        UUID;
    v_tag_performance UUID;
    v_tag_opensource  UUID;
    v_tag_privacy     UUID;
    v_tag_gdpr        UUID;
    v_tag_analytics   UUID;
    v_tag_scope       UUID;
    v_tag_architecture UUID;
    v_tag_multitenancy UUID;
    v_tag_typescript  UUID;
    v_tag_startup     UUID;

    -- Categories
    v_cat_engineering UUID;
    v_cat_privacy     UUID;
    v_cat_product     UUID;
    v_cat_architecture UUID;

    -- Skills
    v_skill_rust     UUID;
    v_skill_ts       UUID;
    v_skill_react    UUID;
    v_skill_postgres UUID;
    v_skill_docker   UUID;
    v_skill_astro    UUID;
    v_skill_sqlx     UUID;

    -- Navigation Menus
    v_menu_primary UUID;
    v_menu_footer  UUID;

    -- Navigation Items
    v_nav_home    UUID;
    v_nav_blog    UUID;
    v_nav_about   UUID;
    v_nav_contact UUID;

    -- Page sections
    v_section_hero  UUID;
    v_section_feat  UUID;
    v_section_cta   UUID;

    -- Legal groups / items
    v_lg_essential UUID;
    v_li_session   UUID;

    -- Document folders
    v_doc_folder_guides UUID;

    -- Documents
    v_doc_rust_book UUID;
    v_doc_rocket    UUID;
    v_doc_gdpr      UUID;
    v_doc_sqlx      UUID;
    v_doc_clerk     UUID;
    v_doc_astro     UUID;

    -- Document folders
    v_doc_folder_specs UUID;

    -- Media folders
    v_mfolder_covers   UUID;
    v_mfolder_branding UUID;

    -- Webhook IDs
    v_webhook1 UUID;
    v_webhook2 UUID;

    -- Bulk generation loop variables
    v_i                 INTEGER;
    v_tmp_content       UUID;
    v_tmp_id            UUID;
BEGIN

    -- ========================================================================
    -- Version guard: skip if demo site already exists with current seed version
    -- ========================================================================
    SELECT id INTO v_existing_site FROM sites WHERE slug = 'john-forja';

    IF v_existing_site IS NOT NULL THEN
        -- Check seed version
        SELECT setting_value::text INTO v_existing_version
        FROM site_settings WHERE site_id = v_existing_site AND setting_key = 'demo_seed_version';

        IF v_existing_version IS NOT NULL AND REPLACE(v_existing_version, '"', '') = v_seed_version THEN
            RAISE NOTICE 'Demo site already exists with current seed version (v%). Skipping.', v_seed_version;
            RETURN;
        END IF;

        -- Version mismatch — delete and re-seed
        RAISE NOTICE 'Demo site exists but seed version is outdated. Deleting and re-seeding...';
        -- Clean up audit/change_history (NO ACTION FKs, not CASCADE)
        DELETE FROM audit_logs WHERE site_id = v_existing_site;
        DELETE FROM change_history WHERE site_id = v_existing_site;

        -- Collect orphan content IDs before deleting the site
        -- (content_sites junction will be cascade-deleted with the site,
        -- but contents themselves persist as orphans)
        CREATE TEMP TABLE _demo_orphan_contents AS
            SELECT content_id FROM content_sites WHERE site_id = v_existing_site AND is_owner = TRUE;

        -- Same for the catalog entities the demo site owns. Since #762,
        -- slugs are per-site, so these rows belong to this site alone and
        -- must be torn down with it — otherwise the next reseed would
        -- accumulate duplicate tags/skills/categories. Capture the IDs now;
        -- the *_sites junctions cascade away with the site below.
        CREATE TEMP TABLE _demo_orphan_tags AS
            SELECT tag_id FROM tag_sites WHERE site_id = v_existing_site AND is_owner = TRUE;
        CREATE TEMP TABLE _demo_orphan_skills AS
            SELECT skill_id FROM skill_sites WHERE site_id = v_existing_site AND is_owner = TRUE;
        CREATE TEMP TABLE _demo_orphan_categories AS
            SELECT category_id FROM category_sites WHERE site_id = v_existing_site AND is_owner = TRUE;

        -- Delete the site — cascade removes site_settings, content_sites, nav, media_sites, etc.
        DELETE FROM sites WHERE id = v_existing_site;

        -- Now clean up orphaned contents (projects, blogs, pages, cv_entries, legal_docs)
        DELETE FROM contents WHERE id IN (SELECT content_id FROM _demo_orphan_contents);
        -- …and the demo-owned catalog rows. Categories cascade parent→child
        -- via the self-referential FK, so deleting roots clears the tree.
        DELETE FROM tags       WHERE id IN (SELECT tag_id      FROM _demo_orphan_tags);
        DELETE FROM skills     WHERE id IN (SELECT skill_id    FROM _demo_orphan_skills);
        DELETE FROM categories WHERE id IN (SELECT category_id FROM _demo_orphan_categories);
        DROP TABLE _demo_orphan_contents;
        DROP TABLE _demo_orphan_tags;
        DROP TABLE _demo_orphan_skills;
        DROP TABLE _demo_orphan_categories;
    END IF;

    RAISE NOTICE 'Seeding demo site (v%)...', v_seed_version;

    -- ========================================================================
    -- Resolve migration-seeded reference IDs
    -- ========================================================================
    SELECT id INTO STRICT v_locale_en FROM locales WHERE code = 'en';
    SELECT id INTO STRICT v_locale_de FROM locales WHERE code = 'de';
    SELECT id INTO STRICT v_locale_es FROM locales WHERE code = 'es';
    SELECT id INTO STRICT v_env_dev   FROM environments WHERE name = 'development';
    SELECT id INTO STRICT v_env_prod  FROM environments WHERE name = 'production';
    SELECT id INTO STRICT v_et_blog   FROM entity_types WHERE name = 'blog';
    SELECT id INTO STRICT v_et_page   FROM entity_types WHERE name = 'page';
    SELECT id INTO STRICT v_et_cv     FROM entity_types WHERE name = 'cv_entry';
    SELECT id INTO STRICT v_et_legal  FROM entity_types WHERE name = 'legal_document';
    SELECT id INTO STRICT v_et_project FROM entity_types WHERE name = 'project';

    -- ========================================================================
    -- SITE
    -- ========================================================================
    INSERT INTO sites (name, slug, description, default_locale_id, timezone, theme, base_url)
    VALUES (
        'John Forja', 'john-forja',
        'The personal blog and portfolio of John Forja — a privacy-obsessed developer from Vienna who built a CMS in Rust because the alternatives tracked too much.',
        v_locale_en, 'Europe/Vienna',
        '{"primaryColor":"#7c3aed","fontFamily":"Inter","mode":"dark"}'::jsonb,
        'http://localhost:4321'
    ) RETURNING id INTO v_site1;

    -- Site domains
    INSERT INTO site_domains (site_id, domain, is_primary, environment) VALUES
        (v_site1, 'localhost:4321',   TRUE,  'development'),
        (v_site1, 'johnforja.dev',    TRUE,  'production');

    -- Site locales
    INSERT INTO site_locales (site_id, locale_id, is_default, is_active, url_prefix) VALUES
        (v_site1, v_locale_en, TRUE,  TRUE, NULL),
        (v_site1, v_locale_de, FALSE, TRUE, 'de'),
        (v_site1, v_locale_es, FALSE, TRUE, 'es');

    -- Site settings (includes demo_seed_version for version tracking)
    INSERT INTO site_settings (site_id, setting_key, setting_value, is_sensitive) VALUES
        (v_site1, 'demo_seed_version',           to_jsonb(v_seed_version), FALSE),
        (v_site1, 'analytics_enabled',           'true'::jsonb,   FALSE),
        (v_site1, 'maintenance_mode',            'false'::jsonb,  FALSE),
        (v_site1, 'contact_email',               '"hello@forja.dev"'::jsonb, FALSE),
        (v_site1, 'max_document_file_size',      '10485760'::jsonb, FALSE),
        (v_site1, 'max_media_file_size',         '52428800'::jsonb, FALSE),
        -- Module flags. Enable every content module so the demo site exposes
        -- the full admin UI (Forms tab in site settings, etc.) — including
        -- modules where the seed itself doesn't populate sample rows. AI is
        -- left off because it requires an external API key the demo can't
        -- ship.
        (v_site1, 'module_blog_enabled',         'true'::jsonb,   FALSE),
        (v_site1, 'module_pages_enabled',        'true'::jsonb,   FALSE),
        (v_site1, 'module_portfolio_enabled',    'true'::jsonb,   FALSE),
        (v_site1, 'module_documents_enabled',    'true'::jsonb,   FALSE),
        (v_site1, 'module_legal_enabled',        'true'::jsonb,   FALSE),
        (v_site1, 'module_forms_enabled',        'true'::jsonb,   FALSE),
        (v_site1, 'module_ai_enabled',           'false'::jsonb,  FALSE);

    -- ========================================================================
    -- USERS (Clerk-based — fake UUIDs for created_by/uploaded_by columns)
    -- ========================================================================
    v_user_admin  := 'a0000000-0000-4000-8000-000000000001'::UUID;

    -- NOTE: system_admins and site_memberships are NOT seeded here.
    -- System admins are managed via SYSTEM_ADMIN_CLERK_IDS env var.
    -- Site memberships are handled via auto-join on first login.

    -- ========================================================================
    -- MEDIA FILES (placeholders via placehold.co)
    -- ========================================================================
    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('avatar.webp','avatar.webp','image/webp',48000,'local','/media/avatar.webp','https://placehold.co/400x400/7c3aed/white?text=JF',400,400,v_user_admin,v_env_dev,FALSE)
    RETURNING id INTO v_media_avatar;

    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('hero.webp','hero.webp','image/webp',320000,'local','/media/hero.webp','https://placehold.co/1920x600/1e1b4b/e0d7ff?text=Forja',1920,600,v_user_admin,v_env_dev,FALSE)
    RETURNING id INTO v_media_hero;

    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('blog1-cover.webp','blog1-cover.webp','image/webp',210000,'local','/media/blog1-cover.webp','https://placehold.co/1200x630/7c3aed/white?text=Rust+%E2%9A%A1',1200,630,v_user_admin,v_env_dev,FALSE)
    RETURNING id INTO v_media_blog1_cover;

    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('blog2-cover.webp','blog2-cover.webp','image/webp',195000,'local','/media/blog2-cover.webp','https://placehold.co/1200x630/059669/white?text=Privacy+%F0%9F%94%92',1200,630,v_user_admin,v_env_dev,FALSE)
    RETURNING id INTO v_media_blog2_cover;

    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('blog3-cover.webp','blog3-cover.webp','image/webp',185000,'local','/media/blog3-cover.webp','https://placehold.co/1200x630/dc2626/white?text=Delete+%E2%9C%82%EF%B8%8F',1200,630,v_user_admin,v_env_dev,FALSE)
    RETURNING id INTO v_media_blog3_cover;

    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('blog4-cover.webp','blog4-cover.webp','image/webp',220000,'local','/media/blog4-cover.webp','https://placehold.co/1200x630/2563eb/white?text=Multi-Tenant',1200,630,v_user_admin,v_env_dev,FALSE)
    RETURNING id INTO v_media_blog4_cover;

    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('blog5-cover.webp','blog5-cover.webp','image/webp',198000,'local','/media/blog5-cover.webp','https://placehold.co/1200x630/d97706/white?text=Launch+%F0%9F%9A%80',1200,630,v_user_admin,v_env_dev,FALSE)
    RETURNING id INTO v_media_blog5_cover;

    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('blog6-cover.webp','blog6-cover.webp','image/webp',192000,'local','/media/blog6-cover.webp','https://placehold.co/1200x630/64748b/white?text=SDK+Draft',1200,630,v_user_admin,v_env_dev,FALSE)
    RETURNING id INTO v_media_blog6_cover;

    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('blog7-cover.webp','blog7-cover.webp','image/webp',198000,'local','/media/blog7-cover.webp','https://placehold.co/1200x630/0891b2/white?text=Error+Handling',1200,630,v_user_admin,v_env_dev,FALSE)
    RETURNING id INTO v_media_blog7_cover;

    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('blog8-cover.webp','blog8-cover.webp','image/webp',195000,'local','/media/blog8-cover.webp','https://placehold.co/1200x630/4f46e5/white?text=AI+Content',1200,630,v_user_admin,v_env_dev,FALSE)
    RETURNING id INTO v_media_blog8_cover;

    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('logo.webp','logo.webp','image/webp',3200,'local','/media/logo.webp','https://placehold.co/200x200/7c3aed/white?text=Forja',200,200,v_user_admin,v_env_dev,FALSE)
    RETURNING id INTO v_media_logo;

    -- Media -> Site links
    INSERT INTO media_sites (media_file_id, site_id) VALUES
        (v_media_avatar,      v_site1),
        (v_media_hero,        v_site1),
        (v_media_blog1_cover, v_site1),
        (v_media_blog2_cover, v_site1),
        (v_media_blog3_cover, v_site1),
        (v_media_blog4_cover, v_site1),
        (v_media_blog5_cover, v_site1),
        (v_media_blog6_cover, v_site1),
        (v_media_blog7_cover, v_site1),
        (v_media_blog8_cover, v_site1),
        (v_media_logo,        v_site1);

    -- Media metadata (alt texts)
    INSERT INTO media_metadata (media_file_id, locale_id, alt_text, title) VALUES
        (v_media_avatar,      v_locale_en, 'John Forja portrait',             'Avatar'),
        (v_media_hero,        v_locale_en, 'Forja CMS hero banner',           'Hero'),
        (v_media_blog1_cover, v_locale_en, 'Rust lightning bolt',             'Rust Performance'),
        (v_media_blog2_cover, v_locale_en, 'Privacy lock icon',               'Privacy'),
        (v_media_blog3_cover, v_locale_en, 'Scissors cutting code',           'Delete Code'),
        (v_media_blog4_cover, v_locale_en, 'Multi-tenant architecture',       'Multi-Tenant'),
        (v_media_blog5_cover, v_locale_en, 'Rocket launching',                'Launch'),
        (v_media_blog6_cover, v_locale_en, 'TypeScript SDK code',             'SDK Draft'),
        (v_media_blog7_cover, v_locale_en, 'Error handling patterns',         'Error Handling'),
        (v_media_blog8_cover, v_locale_en, 'AI content generation',           'AI Content'),
        (v_media_logo,        v_locale_en, 'Forja logo',                      'Logo');

    -- Update site logo
    UPDATE sites SET logo_url = 'https://placehold.co/200x200/7c3aed/white?text=Forja', favicon_url = 'https://placehold.co/32x32/7c3aed/white?text=F' WHERE id = v_site1;

    -- ========================================================================
    -- TAXONOMY — Tags (11 hand-crafted)
    -- ========================================================================
    INSERT INTO tags (slug, is_global) VALUES ('rust',           FALSE) RETURNING id INTO v_tag_rust;
    INSERT INTO tags (slug, is_global) VALUES ('performance',    FALSE) RETURNING id INTO v_tag_performance;
    INSERT INTO tags (slug, is_global) VALUES ('open-source',    FALSE) RETURNING id INTO v_tag_opensource;
    INSERT INTO tags (slug, is_global) VALUES ('privacy',        FALSE) RETURNING id INTO v_tag_privacy;
    INSERT INTO tags (slug, is_global) VALUES ('gdpr',           FALSE) RETURNING id INTO v_tag_gdpr;
    INSERT INTO tags (slug, is_global) VALUES ('analytics',      FALSE) RETURNING id INTO v_tag_analytics;
    INSERT INTO tags (slug, is_global) VALUES ('scope',          FALSE) RETURNING id INTO v_tag_scope;
    INSERT INTO tags (slug, is_global) VALUES ('architecture',   FALSE) RETURNING id INTO v_tag_architecture;
    INSERT INTO tags (slug, is_global) VALUES ('multi-tenancy',  FALSE) RETURNING id INTO v_tag_multitenancy;
    INSERT INTO tags (slug, is_global) VALUES ('typescript',     FALSE) RETURNING id INTO v_tag_typescript;
    INSERT INTO tags (slug, is_global) VALUES ('startup',        FALSE) RETURNING id INTO v_tag_startup;

    INSERT INTO tag_sites (tag_id, site_id) VALUES
        (v_tag_rust,         v_site1), (v_tag_performance,  v_site1),
        (v_tag_opensource,   v_site1), (v_tag_privacy,      v_site1),
        (v_tag_gdpr,         v_site1), (v_tag_analytics,    v_site1),
        (v_tag_scope,        v_site1), (v_tag_architecture, v_site1),
        (v_tag_multitenancy, v_site1), (v_tag_typescript,   v_site1),
        (v_tag_startup,      v_site1);

    INSERT INTO tag_localizations (tag_id, locale_id, name) VALUES
        (v_tag_rust,         v_locale_en, 'Rust'),
        (v_tag_rust,         v_locale_de, 'Rust'),
        (v_tag_performance,  v_locale_en, 'Performance'),
        (v_tag_performance,  v_locale_de, 'Performance'),
        (v_tag_opensource,   v_locale_en, 'Open Source'),
        (v_tag_opensource,   v_locale_de, 'Open Source'),
        (v_tag_privacy,      v_locale_en, 'Privacy'),
        (v_tag_privacy,      v_locale_de, 'Datenschutz'),
        (v_tag_gdpr,         v_locale_en, 'GDPR'),
        (v_tag_gdpr,         v_locale_de, 'DSGVO'),
        (v_tag_analytics,    v_locale_en, 'Analytics'),
        (v_tag_analytics,    v_locale_de, 'Analyse'),
        (v_tag_scope,        v_locale_en, 'Scope'),
        (v_tag_scope,        v_locale_de, 'Umfang'),
        (v_tag_architecture, v_locale_en, 'Architecture'),
        (v_tag_architecture, v_locale_de, 'Architektur'),
        (v_tag_multitenancy, v_locale_en, 'Multi-Tenancy'),
        (v_tag_multitenancy, v_locale_de, 'Mandantenfaehigkeit'),
        (v_tag_typescript,   v_locale_en, 'TypeScript'),
        (v_tag_typescript,   v_locale_de, 'TypeScript'),
        (v_tag_startup,      v_locale_en, 'Startup'),
        (v_tag_startup,      v_locale_de, 'Startup')
    ON CONFLICT (tag_id, locale_id) DO NOTHING;

    -- ========================================================================
    -- TAXONOMY — Categories (4 total, hierarchical)
    -- ========================================================================
    INSERT INTO categories (slug, is_global) VALUES ('engineering', FALSE) RETURNING id INTO v_cat_engineering;
    INSERT INTO categories (slug, is_global) VALUES ('privacy',     FALSE) RETURNING id INTO v_cat_privacy;
    INSERT INTO categories (slug, is_global) VALUES ('product',     FALSE) RETURNING id INTO v_cat_product;
    INSERT INTO categories (parent_id, slug) VALUES (v_cat_engineering, 'architecture') RETURNING id INTO v_cat_architecture;

    INSERT INTO category_sites (category_id, site_id) VALUES
        (v_cat_engineering,  v_site1),
        (v_cat_privacy,      v_site1),
        (v_cat_product,      v_site1),
        (v_cat_architecture, v_site1);

    INSERT INTO category_localizations (category_id, locale_id, name, description) VALUES
        (v_cat_engineering,  v_locale_en, 'Engineering',   'Software engineering deep dives'),
        (v_cat_engineering,  v_locale_de, 'Technik',       'Software-Engineering im Detail'),
        (v_cat_privacy,      v_locale_en, 'Privacy',       'Data protection and privacy topics'),
        (v_cat_privacy,      v_locale_de, 'Datenschutz',   'Datenschutz und Privacy-Themen'),
        (v_cat_product,      v_locale_en, 'Product',       'Product decisions, strategy, and scope'),
        (v_cat_product,      v_locale_de, 'Produkt',       'Produktentscheidungen, Strategie und Scope'),
        (v_cat_architecture, v_locale_en, 'Architecture',  'System design and architecture patterns'),
        (v_cat_architecture, v_locale_de, 'Architektur',   'Systemdesign und Architekturmuster')
    ON CONFLICT (category_id, locale_id) DO NOTHING;

    -- ========================================================================
    -- SKILLS (7 core)
    -- ========================================================================
    INSERT INTO skills (name, slug, category, proficiency_level, is_global) VALUES
        ('Rust',       'rust',       'programming', 5, FALSE) RETURNING id INTO v_skill_rust;
    INSERT INTO skills (name, slug, category, proficiency_level, is_global) VALUES
        ('TypeScript', 'typescript', 'programming', 5, FALSE) RETURNING id INTO v_skill_ts;
    INSERT INTO skills (name, slug, category, proficiency_level, is_global) VALUES
        ('React',      'react',      'framework',   5, FALSE) RETURNING id INTO v_skill_react;
    INSERT INTO skills (name, slug, category, proficiency_level, is_global) VALUES
        ('PostgreSQL', 'postgresql', 'database',    4, FALSE) RETURNING id INTO v_skill_postgres;
    INSERT INTO skills (name, slug, category, proficiency_level, is_global) VALUES
        ('Docker',     'docker',     'devops',      4, FALSE) RETURNING id INTO v_skill_docker;
    INSERT INTO skills (name, slug, category, proficiency_level, is_global) VALUES
        ('Astro',      'astro',      'framework',   3, FALSE) RETURNING id INTO v_skill_astro;
    INSERT INTO skills (name, slug, category, proficiency_level, is_global) VALUES
        ('SQLx',       'sqlx',       'framework',   4, FALSE) RETURNING id INTO v_skill_sqlx;

    INSERT INTO skill_sites (skill_id, site_id) VALUES
        (v_skill_rust,     v_site1), (v_skill_ts,       v_site1),
        (v_skill_react,    v_site1), (v_skill_postgres,  v_site1),
        (v_skill_docker,   v_site1), (v_skill_astro,     v_site1),
        (v_skill_sqlx,     v_site1);

    INSERT INTO skill_localizations (skill_id, locale_id, display_name, description) VALUES
        (v_skill_rust,     v_locale_en, 'Rust',       'Systems programming language focused on safety, speed, and concurrency'),
        (v_skill_rust,     v_locale_de, 'Rust',       'Systemprogrammiersprache mit Fokus auf Sicherheit, Geschwindigkeit und Nebenlaeufigkeit'),
        (v_skill_ts,       v_locale_en, 'TypeScript', 'Typed superset of JavaScript for scalable applications'),
        (v_skill_ts,       v_locale_de, 'TypeScript', 'Typisierte Erweiterung von JavaScript fuer skalierbare Anwendungen'),
        (v_skill_react,    v_locale_en, 'React',      'UI library for building component-based interfaces'),
        (v_skill_react,    v_locale_de, 'React',      'UI-Bibliothek fuer komponentenbasierte Oberflaechen'),
        (v_skill_postgres, v_locale_en, 'PostgreSQL', 'Advanced open-source relational database'),
        (v_skill_postgres, v_locale_de, 'PostgreSQL', 'Fortgeschrittene relationale Open-Source-Datenbank'),
        (v_skill_docker,   v_locale_en, 'Docker',     'Container platform for application packaging and deployment'),
        (v_skill_docker,   v_locale_de, 'Docker',     'Container-Plattform fuer Anwendungspaketierung und Deployment'),
        (v_skill_astro,    v_locale_en, 'Astro',      'Content-focused web framework with island architecture'),
        (v_skill_astro,    v_locale_de, 'Astro',      'Inhalts-fokussiertes Web-Framework mit Island-Architektur'),
        (v_skill_sqlx,     v_locale_en, 'SQLx',       'Compile-time checked SQL queries for Rust'),
        (v_skill_sqlx,     v_locale_de, 'SQLx',       'Zur Kompilierzeit geprueft SQL-Abfragen fuer Rust')
    ON CONFLICT (skill_id, locale_id) DO NOTHING;

    -- ========================================================================
    -- BLOG 1 — "Why I Quit Node.js and Rewrote Everything in Rust"
    -- (published, featured, 30 days ago)
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by, updated_by)
    VALUES (v_et_blog, v_env_dev, 'why-i-quit-nodejs-rewrote-in-rust', 'published', NOW() - INTERVAL '30 days', 1, v_user_admin, v_user_admin)
    RETURNING id INTO v_content_blog1;

    INSERT INTO content_sites (content_id, site_id, is_owner, is_featured) VALUES (v_content_blog1, v_site1, TRUE, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, excerpt, meta_title, meta_description, body, translation_status)
    VALUES (v_content_blog1, v_locale_en,
        'Why I Quit Node.js and Rewrote Everything in Rust',
        'From 2 AM crashes to 41,000 requests per second',
        'It was 2 AM on a Tuesday when our Node.js CMS crashed for the third time that week. That''s when I decided to build my own CMS in Rust.',
        'Why I Quit Node.js and Rewrote Everything in Rust | John Forja',
        'The story of how a 2 AM crash led me to build a privacy-first CMS in Rust with 41,000 req/sec performance.',
        E'## The Breaking Point\n\nIt was 2 AM on a Tuesday when our Node.js CMS crashed for the third time that week. The culprit? A memory leak in a popular Express middleware that nobody had patched in months. As I stared at the Grafana dashboard watching memory climb past 2GB for what should have been a simple content API, I made a decision: I was going to build my own CMS. In Rust.\n\n### Why Not Just Fix the Node.js Version?\n\nI could have. I almost did. But the problems went deeper than one memory leak:\n\n- **Runtime overhead**: Even idle, our Node process ate 200MB of RAM. The same logic in Rust uses 30MB.\n- **Type safety theater**: TypeScript catches typos but not logic errors at the boundary between your code and the database. Rust''s type system catches everything at compile time.\n- **Dependency hell**: Our `node_modules` folder was 847MB. Eight hundred and forty-seven megabytes. For a content API.\n\n### The First Weekend\n\nI started with Rocket, a Rust web framework that felt surprisingly ergonomic:\n\n```rust\n#[get("/api/v1/sites/<site_id>/blogs")]\nasync fn list_blogs(\n    pool: &State<PgPool>,\n    site_id: Uuid,\n    auth: AuthGuard,\n) -> Result<Json<Vec<Blog>>, ApiError> {\n    let blogs = Blog::list_published(pool, site_id).await?;\n    Ok(Json(blogs))\n}\n```\n\nThe compiler yelled at me a lot that first weekend. But every error it caught was a bug I would have shipped in Node.js.\n\n### Six Months Later\n\nThe results speak for themselves:\n\n| Metric | Node.js CMS | Forja (Rust) |\n|--------|-------------|------------|\n| Cold start | 3.2s | 45ms |\n| Memory (idle) | 210MB | 28MB |\n| Requests/sec | 2,400 | 41,000 |\n| Dependencies | 847MB | 0 (single binary) |\n\nWas it more work? Yes. Was it worth it? Every single compile error.\n\n## What I Learned\n\nRust doesn''t make you a better programmer by magic. It makes you a better programmer by refusing to compile your bad decisions. After six months of fighting the borrow checker, I started writing cleaner JavaScript too — because I finally understood *why* certain patterns are dangerous.\n\nThe CMS I built that weekend is now called **Forja**. It manages multiple sites from a single instance, tracks zero user data, and deploys as a single binary. But that''s a story for another post.',
        'approved')
    RETURNING id INTO v_cl_blog1_en;

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, excerpt, body, translation_status)
    VALUES (v_content_blog1, v_locale_de,
        'Warum ich Node.js aufgegeben und alles in Rust neugeschrieben habe',
        'Von 2-Uhr-nachts-Abstuerzen zu 41.000 Anfragen pro Sekunde',
        'Es war 2 Uhr nachts an einem Dienstag, als unser Node.js CMS zum dritten Mal in dieser Woche abstuerzte. Da beschloss ich, mein eigenes CMS in Rust zu bauen.',
        E'## Der Wendepunkt\n\nEs war 2 Uhr nachts an einem Dienstag, als unser Node.js CMS zum dritten Mal in dieser Woche abstuerzte. Ein Speicherleck in einer populaeren Express-Middleware, die seit Monaten niemand gepatcht hatte. In diesem Moment beschloss ich: Ich baue mein eigenes CMS. In Rust.\n\n### Warum nicht einfach die Node.js-Version reparieren?\n\nDie Probleme gingen tiefer als ein einzelnes Speicherleck. Unser Node-Prozess verbrauchte im Leerlauf 200MB RAM. TypeScript fing Tippfehler ab, aber keine Logikfehler an der Grenze zwischen Code und Datenbank. Und unser `node_modules`-Ordner war 847MB gross.\n\n### Sechs Monate spaeter\n\nDie Ergebnisse sprechen fuer sich: Rust bewaeltigt 41.000 Anfragen pro Sekunde bei 28MB Speicherverbrauch. War es mehr Arbeit? Ja. War es das wert? Jeder einzelne Compile-Error.\n\n## Was ich gelernt habe\n\nRust macht dich nicht durch Magie zu einem besseren Programmierer. Es macht dich besser, indem es sich weigert, deine schlechten Entscheidungen zu kompilieren.',
        'approved')
    RETURNING id INTO v_cl_blog1_de;

    INSERT INTO blogs (content_id, author, published_date, reading_time_minutes, cover_image_id, is_featured)
    VALUES (v_content_blog1, 'John Forja', (NOW() - INTERVAL '30 days')::DATE, 8, v_media_blog1_cover, TRUE)
    RETURNING id INTO v_blog1;

    INSERT INTO content_tags (content_id, tag_id) VALUES
        (v_content_blog1, v_tag_rust), (v_content_blog1, v_tag_performance), (v_content_blog1, v_tag_opensource);
    INSERT INTO content_categories (content_id, category_id, is_primary) VALUES
        (v_content_blog1, v_cat_engineering, TRUE);

    -- Content blocks for blog 1 EN
    INSERT INTO content_blocks (content_localization_id, block_type, block_order, block_data) VALUES
        (v_cl_blog1_en, 'heading',   0, '{"level":2,"text":"The Breaking Point"}'::jsonb),
        (v_cl_blog1_en, 'paragraph', 1, '{"text":"It was 2 AM on a Tuesday when our Node.js CMS crashed for the third time that week."}'::jsonb),
        (v_cl_blog1_en, 'heading',   2, '{"level":3,"text":"Why Not Just Fix the Node.js Version?"}'::jsonb),
        (v_cl_blog1_en, 'paragraph', 3, '{"text":"I could have. I almost did. But the problems went deeper than one memory leak."}'::jsonb),
        (v_cl_blog1_en, 'heading',   4, '{"level":3,"text":"The First Weekend"}'::jsonb),
        (v_cl_blog1_en, 'code',      5, '{"language":"rust","code":"#[get(\"/api/v1/sites/<site_id>/blogs\")]\nasync fn list_blogs(\n    pool: &State<PgPool>,\n    site_id: Uuid,\n    auth: AuthGuard,\n) -> Result<Json<Vec<Blog>>, ApiError> {\n    let blogs = Blog::list_published(pool, site_id).await?;\n    Ok(Json(blogs))\n}"}'::jsonb),
        (v_cl_blog1_en, 'heading',   6, '{"level":3,"text":"Six Months Later"}'::jsonb),
        (v_cl_blog1_en, 'table',     7, '{"headers":["Metric","Node.js CMS","Forja (Rust)"],"rows":[["Cold start","3.2s","45ms"],["Memory (idle)","210MB","28MB"],["Requests/sec","2,400","41,000"]]}'::jsonb),
        (v_cl_blog1_en, 'heading',   8, '{"level":2,"text":"What I Learned"}'::jsonb),
        (v_cl_blog1_en, 'paragraph', 9, '{"text":"Rust doesn''t make you a better programmer by magic. It makes you a better programmer by refusing to compile your bad decisions."}'::jsonb);

    -- Blog photos for blog 1
    INSERT INTO blog_photos (blog_id, media_file_id, display_order) VALUES
        (v_blog1, v_media_blog1_cover, 0);

    -- ========================================================================
    -- BLOG 2 — "Privacy Is Not a Feature — It's Architecture"
    -- (published, featured, 21 days ago)
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by, updated_by)
    VALUES (v_et_blog, v_env_dev, 'privacy-is-not-a-feature', 'published', NOW() - INTERVAL '21 days', 1, v_user_admin, v_user_admin)
    RETURNING id INTO v_content_blog2;

    INSERT INTO content_sites (content_id, site_id, is_owner, is_featured) VALUES (v_content_blog2, v_site1, TRUE, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, excerpt, meta_title, meta_description, body, translation_status)
    VALUES (v_content_blog2, v_locale_en,
        'Privacy Is Not a Feature — It''s Architecture',
        'What happens when you build a CMS that genuinely doesn''t track anyone',
        'Every website hits you with a cookie consent popup. What if the CMS just didn''t need to track anyone?',
        'Privacy Is Not a Feature — It''s Architecture | John Forja',
        'How Forja achieves privacy-first analytics without cookies, PII, or consent banners.',
        E'## The Cookie Banner Industrial Complex\n\nEvery website you visit hits you with a cookie consent popup. "We value your privacy," they say, while loading 47 tracking scripts behind the banner. This isn''t privacy — it''s privacy theater.\n\nWhen I started building Forja, I asked a simple question: **what if the CMS just didn''t need to track anyone?**\n\n### What "Privacy by Design" Actually Means\n\nMost CMS platforms treat GDPR as a compliance checkbox. They add a cookie banner, write a privacy policy, and call it done. But the tracking is still there — baked into the analytics, the session management, the third-party integrations.\n\nForja takes a different approach. Here''s what our analytics system looks like:\n\n```\nTraditional CMS Analytics:\n  -> Store IP address X\n  -> Store User-Agent X\n  -> Set tracking cookies X\n  -> Create user profiles X\n  -> Share data with third parties X\n\nForja Analytics:\n  -> Count page views Y\n  -> Track referrer domains (not full URLs) Y\n  -> Daily-rotating visitor hash (cannot be tracked across days) Y\n  -> Aggregate daily stats Y\n  -> That''s it. Y\n```\n\n### The Visitor Hash Trick\n\nWe still want to know how many *unique* visitors a page gets. But we don''t want to know *who* they are. Here''s how:\n\nWe hash a combination of the visitor''s IP + a daily-rotating salt. The result is a string that:\n- Is different every day (so you can''t track someone across days)\n- Is the same within a day (so we can count uniques)\n- Cannot be reversed to reveal the IP\n\nNo cookies needed. No PII stored. No consent required.\n\n### Why Competitors Can''t Copy This\n\n"Just remove the tracking" sounds easy. But most CMS platforms have analytics deeply woven into their architecture — their dashboards depend on user-level data, their recommendation engines need browsing history, their A/B testing requires persistent identifiers.\n\nForja was built from day one with the assumption that we would **never** have any of that data. Our entire feature set works without knowing anything about individual users. That''s not a feature — it''s an architectural decision that''s nearly impossible to retrofit.\n\n### The Business Case for Privacy\n\n"But how do you know what content performs well?"\n\nYou count page views and referrer domains. That''s what actually matters. Knowing that a blog post got 10,000 views from Hacker News is actionable. Knowing that user_47832 from Munich read it at 2:47 PM on their iPhone is creepy and useless.\n\nGDPR enforcement is accelerating. Fines are growing. The EU isn''t going to relax these rules — they''re going to tighten them. Building privacy into your architecture today means you won''t be scrambling to rip out tracking tomorrow.',
        'approved')
    RETURNING id INTO v_cl_blog2_en;

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, excerpt, body, translation_status)
    VALUES (v_content_blog2, v_locale_de,
        'Datenschutz ist kein Feature — es ist Architektur',
        'Was passiert, wenn ein CMS wirklich niemanden trackt',
        'Jede Website nervt dich mit einem Cookie-Banner. Was waere, wenn das CMS einfach niemanden tracken muesste?',
        E'## Die Cookie-Banner-Industrie\n\nJede Website begruesst dich mit einem Cookie-Consent-Popup. "Wir schaetzen Ihre Privatsphaere," sagen sie, waehrend 47 Tracking-Skripte im Hintergrund laden. Das ist kein Datenschutz — das ist Datenschutz-Theater.\n\nAls ich Forja gebaut habe, stellte ich eine einfache Frage: **Was waere, wenn das CMS einfach niemanden tracken muesste?**\n\n### Was "Privacy by Design" wirklich bedeutet\n\nDie meisten CMS-Plattformen behandeln die DSGVO als Compliance-Checkbox. Forja wurde von Tag eins mit der Annahme gebaut, dass wir **niemals** personenbezogene Daten haben wuerden.\n\n### Der Besucher-Hash-Trick\n\nWir hashen die IP des Besuchers mit einem taeglich rotierenden Salt. Das Ergebnis kann nicht ueber Tage hinweg verfolgt werden und die IP kann nicht zurueckgerechnet werden. Keine Cookies noetig. Keine personenbezogenen Daten gespeichert. Keine Einwilligung erforderlich.',
        'approved')
    RETURNING id INTO v_cl_blog2_de;

    INSERT INTO blogs (content_id, author, published_date, reading_time_minutes, cover_image_id, is_featured)
    VALUES (v_content_blog2, 'John Forja', (NOW() - INTERVAL '21 days')::DATE, 6, v_media_blog2_cover, TRUE)
    RETURNING id INTO v_blog2;

    INSERT INTO content_tags (content_id, tag_id) VALUES
        (v_content_blog2, v_tag_privacy), (v_content_blog2, v_tag_gdpr), (v_content_blog2, v_tag_analytics);
    INSERT INTO content_categories (content_id, category_id, is_primary) VALUES
        (v_content_blog2, v_cat_privacy, TRUE);

    -- Content blocks for blog 2 EN
    INSERT INTO content_blocks (content_localization_id, block_type, block_order, block_data) VALUES
        (v_cl_blog2_en, 'heading',   0, '{"level":2,"text":"The Cookie Banner Industrial Complex"}'::jsonb),
        (v_cl_blog2_en, 'paragraph', 1, '{"text":"Every website you visit hits you with a cookie consent popup. This isn''t privacy — it''s privacy theater."}'::jsonb),
        (v_cl_blog2_en, 'heading',   2, '{"level":3,"text":"What Privacy by Design Actually Means"}'::jsonb),
        (v_cl_blog2_en, 'paragraph', 3, '{"text":"Most CMS platforms treat GDPR as a compliance checkbox. Forja takes a different approach."}'::jsonb),
        (v_cl_blog2_en, 'heading',   4, '{"level":3,"text":"The Visitor Hash Trick"}'::jsonb),
        (v_cl_blog2_en, 'paragraph', 5, '{"text":"We hash a combination of the visitor''s IP + a daily-rotating salt. No cookies needed. No PII stored."}'::jsonb),
        (v_cl_blog2_en, 'heading',   6, '{"level":3,"text":"The Business Case for Privacy"}'::jsonb),
        (v_cl_blog2_en, 'paragraph', 7, '{"text":"GDPR enforcement is accelerating. Building privacy into your architecture today means you won''t be scrambling to rip out tracking tomorrow."}'::jsonb);

    -- Blog photos for blog 2
    INSERT INTO blog_photos (blog_id, media_file_id, display_order) VALUES
        (v_blog2, v_media_blog2_cover, 0);

    -- ========================================================================
    -- BLOG 3 — "I Deleted 2,000 Lines of Code and the Product Got Better"
    -- (published, 14 days ago)
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by, updated_by)
    VALUES (v_et_blog, v_env_dev, 'deleted-2000-lines-product-got-better', 'published', NOW() - INTERVAL '14 days', 1, v_user_admin, v_user_admin)
    RETURNING id INTO v_content_blog3;

    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_blog3, v_site1, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, excerpt, meta_title, meta_description, body, translation_status)
    VALUES (v_content_blog3, v_locale_en,
        'I Deleted 2,000 Lines of Code and the Product Got Better',
        'Why removing the ActivityPub module was the best product decision I made',
        'Last month I removed the entire ActivityPub federation module from Forja. It was some of the best code I''d ever written. And deleting it was the best product decision I''ve made.',
        'I Deleted 2,000 Lines of Code | John Forja',
        'Why I removed ActivityPub federation from Forja and how saying no made the product better.',
        E'## The Hardest Feature to Ship Is "No"\n\nLast month I removed the entire ActivityPub federation module from Forja. Twelve API endpoints. Nine database tables. RSA signing logic. A delivery queue with retry semantics. A comment moderation system. Gone.\n\nIt was some of the best code I''d ever written. And deleting it was the best product decision I''ve made.\n\n### Why I Built It\n\nThe idea was seductive: your blog posts automatically syndicate to Mastodon and the Fediverse. Followers on Mastodon could comment on your posts. Your CMS becomes part of the decentralized web. *How cool is that?*\n\nI spent three weeks building it. HTTP signatures, ActivityPub inbox/outbox, WebFinger discovery, HTML sanitization for incoming comments, instance blocking, actor blocking. It worked beautifully.\n\n### Why I Killed It\n\nThree reasons:\n\n**1. Nobody asked for it.** I built federation because *I* thought it was cool, not because users needed it. When I listed Forja''s features for potential users, nobody''s eyes lit up at "ActivityPub federation." They lit up at "multi-tenancy" and "no cookie banners."\n\n**2. It expanded the attack surface.** Accepting arbitrary HTTP POST requests from the internet, parsing and sanitizing untrusted HTML, storing remote actor profiles — each of these is a security surface I''d need to maintain forever. For a feature nobody asked for.\n\n**3. Maintenance cost is forever.** The ActivityPub spec evolves. Mastodon changes its implementation. Every hour I spend maintaining federation is an hour I''m not spending on the features that actually differentiate Forja.\n\n### The Aftermath\n\nAfter deleting federation, I could:\n- Simplify the deployment (no RSA key generation, no delivery workers)\n- Remove 4 dependencies from Cargo.toml\n- Focus the product positioning on what actually matters: privacy and multi-tenancy\n\nThe codebase went from "impressive but sprawling" to "focused and sharp."\n\n### The Lesson\n\nAs a solo developer with a kid, a job, and university courses, every hour matters. The question isn''t "can I build this?" — it''s "should this exist in my product?"\n\nIf a feature doesn''t serve your core users, it''s not a feature. It''s a distraction wearing a feature''s clothes.\n\nThe 2,000 lines I deleted are still in git history. If federation ever makes sense for Forja, I can bring them back. But I suspect they''ll stay deleted.',
        'approved')
    RETURNING id INTO v_cl_blog3_en;

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, excerpt, body, translation_status)
    VALUES (v_content_blog3, v_locale_de,
        'Ich habe 2.000 Zeilen Code geloescht und das Produkt wurde besser',
        'Warum das Entfernen des ActivityPub-Moduls die beste Produktentscheidung war',
        'Letzten Monat habe ich das gesamte ActivityPub-Federationsmodul aus Forja entfernt. Es war einer der besten Codes, die ich je geschrieben habe. Und das Loeschen war die beste Produktentscheidung.',
        E'## Das schwierigste Feature ist "Nein"\n\nLetzten Monat habe ich das gesamte ActivityPub-Federationsmodul aus Forja entfernt. Zwoelf API-Endpunkte. Neun Datenbanktabellen. RSA-Signierlogik. Eine Zustellwarteschlange mit Retry-Semantik. Alles weg.\n\n### Warum ich es gebaut habe\n\nDie Idee war verfuehrerisch: Blog-Posts werden automatisch an Mastodon und das Fediverse syndiziert. Aber niemand hat danach gefragt.\n\n### Warum ich es geloescht habe\n\nDrei Gruende: Niemand hat danach gefragt, es vergroesserte die Angriffsflaeche, und die Wartungskosten sind fuer immer. Als Solo-Entwickler mit Kind, Job und Studium zaehlt jede Stunde.\n\n### Die Lektion\n\nWenn ein Feature deinen Kernnutzern nicht dient, ist es kein Feature. Es ist eine Ablenkung im Feature-Kostuem.',
        'approved')
    RETURNING id INTO v_cl_blog3_de;

    INSERT INTO blogs (content_id, author, published_date, reading_time_minutes, cover_image_id)
    VALUES (v_content_blog3, 'John Forja', (NOW() - INTERVAL '14 days')::DATE, 5, v_media_blog3_cover)
    RETURNING id INTO v_blog3;

    INSERT INTO content_tags (content_id, tag_id) VALUES
        (v_content_blog3, v_tag_scope), (v_content_blog3, v_tag_architecture), (v_content_blog3, v_tag_opensource);
    INSERT INTO content_categories (content_id, category_id, is_primary) VALUES
        (v_content_blog3, v_cat_product, TRUE);

    -- Content blocks for blog 3 EN
    INSERT INTO content_blocks (content_localization_id, block_type, block_order, block_data) VALUES
        (v_cl_blog3_en, 'heading',   0, '{"level":2,"text":"The Hardest Feature to Ship Is No"}'::jsonb),
        (v_cl_blog3_en, 'paragraph', 1, '{"text":"Last month I removed the entire ActivityPub federation module from Forja. It was some of the best code I''d ever written."}'::jsonb),
        (v_cl_blog3_en, 'heading',   2, '{"level":3,"text":"Why I Built It"}'::jsonb),
        (v_cl_blog3_en, 'paragraph', 3, '{"text":"The idea was seductive: your blog posts automatically syndicate to Mastodon and the Fediverse."}'::jsonb),
        (v_cl_blog3_en, 'heading',   4, '{"level":3,"text":"Why I Killed It"}'::jsonb),
        (v_cl_blog3_en, 'paragraph', 5, '{"text":"Nobody asked for it. It expanded the attack surface. Maintenance cost is forever."}'::jsonb),
        (v_cl_blog3_en, 'heading',   6, '{"level":3,"text":"The Lesson"}'::jsonb),
        (v_cl_blog3_en, 'paragraph', 7, '{"text":"If a feature doesn''t serve your core users, it''s not a feature. It''s a distraction wearing a feature''s clothes."}'::jsonb);

    -- Blog photos for blog 3
    INSERT INTO blog_photos (blog_id, media_file_id, display_order) VALUES
        (v_blog3, v_media_blog3_cover, 0);

    -- ========================================================================
    -- BLOG 4 — "One Binary, Twenty Sites: How Multi-Tenancy Actually Works"
    -- (published, 7 days ago)
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by, updated_by)
    VALUES (v_et_blog, v_env_dev, 'one-binary-twenty-sites-multi-tenancy', 'published', NOW() - INTERVAL '7 days', 1, v_user_admin, v_user_admin)
    RETURNING id INTO v_content_blog4;

    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_blog4, v_site1, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, excerpt, meta_title, meta_description, body, translation_status)
    VALUES (v_content_blog4, v_locale_en,
        'One Binary, Twenty Sites: How Multi-Tenancy Actually Works',
        'The architecture that lets one Forja instance serve twenty different websites',
        'If you''re a web agency managing 20 client websites, most CMS platforms make you run 20 separate instances. Forja runs everything from a single binary.',
        'One Binary, Twenty Sites: Multi-Tenancy | John Forja',
        'How Forja achieves multi-tenancy with site_id scoping, isolated content, and optional content sharing.',
        E'## The Problem with "One Instance Per Client"\n\nIf you''re a web agency managing 20 client websites, most CMS platforms make you run 20 separate instances. That''s 20 databases to back up, 20 servers to patch, 20 deployments to manage, and 20 bills to pay.\n\nContentful charges EUR300/month just for the entry-level plan. Sanity charges $1,400/month for SSO alone. For an agency with 20 clients, the infrastructure costs add up fast.\n\nForja runs everything from a single instance.\n\n### How It Works\n\nThe core idea is simple: every table has a `site_id` column. Every query filters by it. Every permission check scopes to it.\n\n```sql\n-- Every content query is site-scoped\nSELECT c.*, cl.title, cl.body\nFROM contents c\nJOIN content_sites cs ON c.id = cs.content_id\nJOIN content_localizations cl ON c.id = cl.content_id\nWHERE cs.site_id = $1\n  AND c.status = ''published''\n  AND cl.locale_id = $2\nORDER BY c.published_at DESC;\n```\n\nBut the implementation has subtleties that make it hard to bolt onto an existing CMS:\n\n### 1. Isolated Everything\n\nEach site gets its own:\n- Content (blogs, pages, media, navigation)\n- Users and roles (RBAC with 6 levels)\n- API keys with independent rate limits\n- Webhooks and delivery queues\n- Analytics data\n- Audit logs\n- Settings and themes\n\n### 2. Optional Content Sharing\n\nSometimes you want to share content across sites — a legal document that applies to all client sites, or a media asset used everywhere. Forja supports this through the `is_owner` flag on the `content_sites` junction table:\n\n```\nSite A (owner) --owns--> Blog Post\nSite B         --shares-> Blog Post (read-only)\n```\n\n### 3. Site-Scoped Slugs\n\nThe same slug can exist on different sites. `/about` on Site A and `/about` on Site B are different pages with different content. This is handled by `site_specific_slug` in the `content_sites` table.\n\n### Why Competitors Can''t Add This Later\n\nMulti-tenancy isn''t a feature you add — it''s a foundation you build on. To retrofit it, you''d need to:\n\n1. Add `site_id` to every table (50+ tables in Forja''s case)\n2. Update every query to filter by site\n3. Update every permission check to scope by site\n4. Migrate all existing data into a "default" site\n5. Test every endpoint with multi-site scenarios\n6. Handle edge cases like cross-site content sharing\n\nFor a CMS with existing users and data, this is essentially a rewrite. For Forja, it was a design decision made on day one.\n\n### The Performance Question\n\n"Doesn''t filtering by site_id slow things down?"\n\nNo. PostgreSQL B-tree indexes on `site_id` make these lookups essentially free. And because Forja is written in Rust, the overhead of checking site scope on every request is measured in microseconds, not milliseconds.\n\nA single Forja instance on a $20/month VPS comfortably serves 20 sites. Try doing that with 20 Strapi instances.',
        'approved')
    RETURNING id INTO v_cl_blog4_en;

    INSERT INTO blogs (content_id, author, published_date, reading_time_minutes, cover_image_id)
    VALUES (v_content_blog4, 'John Forja', (NOW() - INTERVAL '7 days')::DATE, 10, v_media_blog4_cover)
    RETURNING id INTO v_blog4;

    INSERT INTO content_tags (content_id, tag_id) VALUES
        (v_content_blog4, v_tag_rust), (v_content_blog4, v_tag_multitenancy), (v_content_blog4, v_tag_performance);
    INSERT INTO content_categories (content_id, category_id, is_primary) VALUES
        (v_content_blog4, v_cat_architecture, TRUE);

    -- Content blocks for blog 4 EN
    INSERT INTO content_blocks (content_localization_id, block_type, block_order, block_data) VALUES
        (v_cl_blog4_en, 'heading',   0, '{"level":2,"text":"The Problem with One Instance Per Client"}'::jsonb),
        (v_cl_blog4_en, 'paragraph', 1, '{"text":"If you''re a web agency managing 20 client websites, most CMS platforms make you run 20 separate instances."}'::jsonb),
        (v_cl_blog4_en, 'heading',   2, '{"level":3,"text":"How It Works"}'::jsonb),
        (v_cl_blog4_en, 'code',      3, '{"language":"sql","code":"SELECT c.*, cl.title, cl.body\nFROM contents c\nJOIN content_sites cs ON c.id = cs.content_id\nWHERE cs.site_id = $1\n  AND c.status = ''published''\nORDER BY c.published_at DESC;"}'::jsonb),
        (v_cl_blog4_en, 'heading',   4, '{"level":3,"text":"1. Isolated Everything"}'::jsonb),
        (v_cl_blog4_en, 'paragraph', 5, '{"text":"Each site gets its own content, users, API keys, webhooks, analytics, audit logs, and themes."}'::jsonb),
        (v_cl_blog4_en, 'heading',   6, '{"level":3,"text":"Why Competitors Can''t Add This Later"}'::jsonb),
        (v_cl_blog4_en, 'paragraph', 7, '{"text":"Multi-tenancy isn''t a feature you add — it''s a foundation you build on."}'::jsonb),
        (v_cl_blog4_en, 'heading',   8, '{"level":3,"text":"The Performance Question"}'::jsonb),
        (v_cl_blog4_en, 'paragraph', 9, '{"text":"PostgreSQL B-tree indexes on site_id make these lookups essentially free."}'::jsonb);

    -- Blog photos for blog 4
    INSERT INTO blog_photos (blog_id, media_file_id, display_order) VALUES
        (v_blog4, v_media_blog4_cover, 0);

    -- ========================================================================
    -- BLOG 5 — "The 8-Week Launch Plan"
    -- (published, 2 days ago)
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by, updated_by)
    VALUES (v_et_blog, v_env_dev, 'eight-week-launch-plan', 'published', NOW() - INTERVAL '2 days', 1, v_user_admin, v_user_admin)
    RETURNING id INTO v_content_blog5;

    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_blog5, v_site1, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, excerpt, meta_title, meta_description, body, translation_status)
    VALUES (v_content_blog5, v_locale_en,
        'The 8-Week Launch Plan (Or: How to Ship a Product with a Full-Time Job and a Toddler)',
        'Turning a side project into a real product with 10-15 hours per week',
        'After building Forja for months, I had to ask myself an uncomfortable question: is this a product or a hobby?',
        'The 8-Week Launch Plan | John Forja',
        'My plan to ship Forja as a real product with 10-15 hours per week while working full-time and raising a toddler.',
        E'## The Moment of Truth\n\nAfter building Forja for months, I had to ask myself an uncomfortable question: is this a product or a hobby?\n\nThe code is solid. The test suite has 109 end-to-end scenarios. The admin dashboard supports 11 languages. The API has 200+ endpoints with OpenAPI documentation. But zero people are using it besides me.\n\nA product without users is just a well-documented side project.\n\n### The Constraints\n\nI''m 37. I have a toddler who thinks sleep is optional. I work full-time. I''m finishing my degree. I have maybe 10-15 hours a week for Forja, and some of those hours happen at 11 PM when my brain is running on caffeine and stubbornness.\n\nSo the plan has to be ruthless about scope.\n\n### The 8-Week Plan\n\n**Weeks 1-2: Stop building, start polishing.**\nFix the bugs I''ve been ignoring. Run the full test suite. Make sure the happy path works perfectly: create a site -> write a post -> publish -> see it on the frontend.\n\n**Weeks 3-4: Add billing and go open-source.**\nIntegrate Clerk Billing (I already use Clerk for auth). Define three tiers: Free (self-hosted), Starter (EUR19/month), Pro (EUR49/month). Make the GitHub repo public.\n\n**Weeks 5-6: Tell the story.**\nBuild a landing page. Write a launch blog post. Submit to Hacker News. Post on Reddit. The positioning: "The privacy-first CMS built in Rust."\n\n**Weeks 7-8: Find 10 humans.**\nOffer free managed hosting to 10 beta users. Get feedback. Learn what actually matters versus what I think matters.\n\n### The Decision Point\n\nAfter 8 weeks, either people are paying for Forja Cloud or they''re not. If yes, I keep going. If no, it stays as an impressive open-source portfolio piece and I move on with zero financial loss.\n\nThe beauty of the open-core model: the worst case is still a win.\n\n### What I''m NOT Doing\n\n- Not adding more features (I have too many already)\n- Not building a mobile app\n- Not trying to compete with WordPress\n- Not quitting my job (yet)\n- Not working past midnight anymore (the toddler wins every negotiation anyway)\n\n### The Bet\n\nEvery headless CMS on the market is built on Node.js. None of them put privacy at their core. None of them offer affordable multi-tenancy. If that gap is real, Forja fills it. If it''s not, I''ll have learned more about Rust, product development, and marketing than any course could teach me.\n\nEither way, I ship in 8 weeks.',
        'approved')
    RETURNING id INTO v_cl_blog5_en;

    INSERT INTO blogs (content_id, author, published_date, reading_time_minutes, cover_image_id)
    VALUES (v_content_blog5, 'John Forja', (NOW() - INTERVAL '2 days')::DATE, 7, v_media_blog5_cover)
    RETURNING id INTO v_blog5;

    INSERT INTO content_tags (content_id, tag_id) VALUES
        (v_content_blog5, v_tag_opensource), (v_content_blog5, v_tag_startup);
    INSERT INTO content_categories (content_id, category_id, is_primary) VALUES
        (v_content_blog5, v_cat_product, TRUE);

    -- Content blocks for blog 5 EN
    INSERT INTO content_blocks (content_localization_id, block_type, block_order, block_data) VALUES
        (v_cl_blog5_en, 'heading',   0, '{"level":2,"text":"The Moment of Truth"}'::jsonb),
        (v_cl_blog5_en, 'paragraph', 1, '{"text":"After building Forja for months, I had to ask myself an uncomfortable question: is this a product or a hobby?"}'::jsonb),
        (v_cl_blog5_en, 'heading',   2, '{"level":3,"text":"The Constraints"}'::jsonb),
        (v_cl_blog5_en, 'paragraph', 3, '{"text":"I''m 37. I have a toddler who thinks sleep is optional. I have maybe 10-15 hours a week for Forja."}'::jsonb),
        (v_cl_blog5_en, 'heading',   4, '{"level":3,"text":"The 8-Week Plan"}'::jsonb),
        (v_cl_blog5_en, 'paragraph', 5, '{"text":"Weeks 1-2: Stop building, start polishing. Weeks 3-4: Add billing and go open-source. Weeks 5-6: Tell the story. Weeks 7-8: Find 10 humans."}'::jsonb),
        (v_cl_blog5_en, 'heading',   6, '{"level":3,"text":"The Bet"}'::jsonb),
        (v_cl_blog5_en, 'paragraph', 7, '{"text":"Every headless CMS on the market is built on Node.js. None of them put privacy at their core. Either way, I ship in 8 weeks."}'::jsonb);

    -- Blog photos for blog 5
    INSERT INTO blog_photos (blog_id, media_file_id, display_order) VALUES
        (v_blog5, v_media_blog5_cover, 0);

    -- ========================================================================
    -- BLOG 6 — "Draft: Writing a TypeScript SDK That Developers Actually Want to Use"
    -- (draft, not published)
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, current_version, created_by, updated_by)
    VALUES (v_et_blog, v_env_dev, 'typescript-sdk-developers-want-to-use', 'draft', 1, v_user_admin, v_user_admin)
    RETURNING id INTO v_content_blog6;

    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_blog6, v_site1, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, excerpt, body, translation_status)
    VALUES (v_content_blog6, v_locale_en,
        'Draft: Writing a TypeScript SDK That Developers Actually Want to Use',
        'Why @forjacms/client exists before the landing page',
        'Your API could be perfectly designed, but if the developer experience of calling it sucks, nobody will use it.',
        E'## Why SDKs Matter More Than APIs\n\n*This is a draft — I''m still collecting feedback from early SDK users.*\n\nYour API could be perfectly designed, but if the developer experience of calling it sucks, nobody will use it. That''s why I built `@forjacms/client` before I built the landing page.\n\n### The Principles\n\n1. **Full type safety** — every method returns typed data, every parameter is validated at compile time\n2. **Discoverable** — autocomplete should teach you the API\n3. **Zero config** — `new ForjaClient({ apiKey, siteId })` and you''re done\n4. **Tree-shakeable** — import only what you use\n\n```typescript\nimport { ForjaClient } from ''@forjacms/client'';\n\nconst client = new ForjaClient({\n  apiKey: ''dk_live_...'',\n  siteId: ''your-site-id'',\n});\n\n// Full autocomplete, typed responses\nconst posts = await client.blogs.listPublished({ locale: ''en'', limit: 10 });\nconst page = await client.pages.getByRoute(''/about'');\n```\n\n### Error Handling\n\nBad error handling is the #1 SDK complaint. Forja''s client throws typed errors...\n\n*[to be continued]*',
        'pending')
    RETURNING id INTO v_cl_blog6_en;

    INSERT INTO blogs (content_id, author, published_date, reading_time_minutes, cover_image_id)
    VALUES (v_content_blog6, 'John Forja', CURRENT_DATE, 12, v_media_blog6_cover)
    RETURNING id INTO v_blog6;

    INSERT INTO content_tags (content_id, tag_id) VALUES
        (v_content_blog6, v_tag_typescript), (v_content_blog6, v_tag_opensource);
    INSERT INTO content_categories (content_id, category_id, is_primary) VALUES
        (v_content_blog6, v_cat_engineering, TRUE);

    -- Content blocks for blog 6 EN
    INSERT INTO content_blocks (content_localization_id, block_type, block_order, block_data) VALUES
        (v_cl_blog6_en, 'heading',   0, '{"level":2,"text":"Why SDKs Matter More Than APIs"}'::jsonb),
        (v_cl_blog6_en, 'paragraph', 1, '{"text":"Your API could be perfectly designed, but if the developer experience of calling it sucks, nobody will use it."}'::jsonb),
        (v_cl_blog6_en, 'heading',   2, '{"level":3,"text":"The Principles"}'::jsonb),
        (v_cl_blog6_en, 'code',      3, '{"language":"typescript","code":"import { ForjaClient } from ''@forjacms/client'';\n\nconst client = new ForjaClient({\n  apiKey: ''dk_live_...'',\n  siteId: ''your-site-id'',\n});\n\nconst posts = await client.blogs.listPublished({ locale: ''en'', limit: 10 });"}'::jsonb),
        (v_cl_blog6_en, 'heading',   4, '{"level":3,"text":"Error Handling"}'::jsonb),
        (v_cl_blog6_en, 'paragraph', 5, '{"text":"Bad error handling is the #1 SDK complaint. Forja''s client throws typed errors... [to be continued]"}'::jsonb);

    -- Blog links
    INSERT INTO blog_links (blog_id, url, title, display_order) VALUES
        (v_blog1, 'https://rocket.rs', 'Rocket Web Framework', 0),
        (v_blog1, 'https://doc.rust-lang.org/book/', 'The Rust Programming Language', 1);

    -- ========================================================================
    -- BLOG 7 — "158 Error Codes and Why Every One Matters" (in_review)
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, current_version, created_by, updated_by)
    VALUES (v_et_blog, v_env_dev, '158-error-codes-why-every-one-matters', 'in_review', 1, v_user_admin, v_user_admin)
    RETURNING id INTO v_content_blog7;

    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_blog7, v_site1, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, excerpt, body, translation_status)
    VALUES (v_content_blog7, v_locale_en,
        '158 Error Codes and Why Every One Matters',
        'How RFC 7807 Problem Details changed how I think about API errors',
        'Most APIs return generic 500 errors. Forja has 158 unique error codes. Here''s why that matters for developer experience.',
        E'## The "500 Internal Server Error" Problem\n\nYou call an API. Something goes wrong. You get back:\n\n```json\n{"error": "Internal server error"}\n```\n\nGreat. Now what? Was it your fault? The server''s fault? A temporary blip? You have no idea. You''re reduced to guessing, re-reading docs, or — worst case — emailing support.\n\n### How Forja Handles Errors\n\nEvery Forja error returns RFC 7807 Problem Details:\n\n```json\n{\n  "type": "https://forja.dev/errors/BLOG_SLUG_TAKEN",\n  "status": 409,\n  "title": "Blog slug already exists",\n  "detail": "The slug ''my-first-post'' is already used by another blog on this site.",\n  "error_code": "BLOG_SLUG_TAKEN",\n  "field_errors": {\n    "slug": "already taken"\n  }\n}\n```\n\nYou know *exactly* what went wrong and how to fix it.\n\n### The Error Code Registry\n\nForja has 158 named error codes. Every one follows the pattern `{DOMAIN}_{ACTION}_{REASON}`:\n\n| Code | Status | Meaning |\n|------|--------|---------|\n| BLOG_NOT_FOUND | 404 | Blog post doesn''t exist |\n| BLOG_SLUG_TAKEN | 409 | Slug already in use |\n| API_KEY_RATE_LIMITED | 429 | Too many requests |\n| CONTENT_PUBLISH_DATE_INVALID | 400 | Publish date is in the past |\n| SITE_STORAGE_EXCEEDED | 403 | Storage quota reached |\n\n### Why It''s Worth the Effort\n\nIs maintaining 158 error codes more work than returning generic errors? Yes. But the alternative is support tickets, confused developers, and integration failures that take hours to debug.\n\nGood error messages are documentation that shows up exactly when you need it.\n\n*Submitting this for review — want to add the error builder pattern section before publishing.*',
        'pending')
    RETURNING id INTO v_cl_blog7_en;

    INSERT INTO blogs (content_id, author, published_date, reading_time_minutes, cover_image_id)
    VALUES (v_content_blog7, 'John Forja', CURRENT_DATE - 1, 7, v_media_blog7_cover)
    RETURNING id INTO v_blog7;

    INSERT INTO content_tags (content_id, tag_id) VALUES
        (v_content_blog7, v_tag_rust), (v_content_blog7, v_tag_architecture);
    INSERT INTO content_categories (content_id, category_id, is_primary) VALUES
        (v_content_blog7, v_cat_engineering, TRUE);

    INSERT INTO content_blocks (content_localization_id, block_type, block_order, block_data) VALUES
        (v_cl_blog7_en, 'heading',   0, '{"level":2,"text":"The 500 Internal Server Error Problem"}'::jsonb),
        (v_cl_blog7_en, 'paragraph', 1, '{"text":"You call an API. Something goes wrong. You get back a generic error. Now what?"}'::jsonb),
        (v_cl_blog7_en, 'code',      2, '{"language":"json","code":"{\n  \"type\": \"https://forja.dev/errors/BLOG_SLUG_TAKEN\",\n  \"status\": 409,\n  \"title\": \"Blog slug already exists\",\n  \"error_code\": \"BLOG_SLUG_TAKEN\"\n}"}'::jsonb),
        (v_cl_blog7_en, 'table',     3, '{"headers":["Code","Status","Meaning"],"rows":[["BLOG_NOT_FOUND","404","Blog doesn''t exist"],["BLOG_SLUG_TAKEN","409","Slug in use"],["API_KEY_RATE_LIMITED","429","Too many requests"]]}'::jsonb);

    -- ========================================================================
    -- BLOG 8 — "AI Content Assist: Help Without Surveillance"
    -- (scheduled — publish_start 7 days from now)
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, publish_start, current_version, created_by, updated_by)
    VALUES (v_et_blog, v_env_dev, 'ai-content-assist-without-surveillance', 'scheduled', NULL, NOW() + INTERVAL '7 days', 1, v_user_admin, v_user_admin)
    RETURNING id INTO v_content_blog8;

    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_blog8, v_site1, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, excerpt, body, translation_status)
    VALUES (v_content_blog8, v_locale_en,
        'AI Content Assist: Help Without Surveillance',
        'How Forja uses LLMs to help writers without harvesting their content',
        'Most AI writing tools send your content to the cloud and train on it. Forja''s AI assist works differently.',
        E'## The AI Writing Tool Dilemma\n\nAI writing assistants are everywhere. They help with headlines, SEO descriptions, and even full drafts. But most of them have a dirty secret: **your content is their training data.**\n\nWhen you paste your draft into ChatGPT or Jasper, that text goes to someone else''s server, gets processed, and potentially contributes to future model training. For a privacy-first CMS, that''s a non-starter.\n\n### How Forja''s AI Assist Works\n\nForja supports multiple LLM providers (OpenAI, Anthropic) configured **per site**. The key difference:\n\n1. **Your API key, your terms** — You bring your own API key. Forja never sees it (it''s stored encrypted).\n2. **No training opt-in** — OpenAI''s API doesn''t train on your data (unlike ChatGPT). Same for Anthropic''s API.\n3. **Prompt injection defense** — We use the sandwich technique to prevent prompt injection in user content.\n4. **Configurable per-site** — Each site can use a different provider, model, temperature, and max tokens.\n\n### What It Can Do\n\n- Generate SEO meta titles and descriptions from your blog content\n- Suggest blog post titles from a draft\n- Auto-generate alt text for images\n- Translate content between languages\n- Suggest tags based on content analysis\n\n### What It Can''t Do (By Design)\n\n- Write entire blog posts (that''s your job)\n- Access content from other sites (tenant isolation)\n- Send content anywhere without your explicit API key configuration\n- Work at all if you don''t configure it (it''s opt-in, not opt-out)\n\n### The Privacy Guarantee\n\nWhen you use Forja''s AI assist:\n- Your content goes from Forja → your chosen LLM provider → back to Forja\n- No intermediary servers\n- No logging of prompts or responses on Forja''s side\n- No training on your content (API terms, not Forja''s promise)\n\nAI should be a tool you control, not a pipeline that harvests your work.\n\n*Scheduled for next week — coincides with the AI features documentation going live.*',
        'approved')
    RETURNING id INTO v_cl_blog8_en;

    INSERT INTO blogs (content_id, author, published_date, reading_time_minutes, cover_image_id)
    VALUES (v_content_blog8, 'John Forja', CURRENT_DATE + 7, 8, v_media_blog8_cover)
    RETURNING id INTO v_blog8;

    INSERT INTO content_tags (content_id, tag_id) VALUES
        (v_content_blog8, v_tag_privacy), (v_content_blog8, v_tag_architecture);
    INSERT INTO content_categories (content_id, category_id, is_primary) VALUES
        (v_content_blog8, v_cat_privacy, TRUE);

    INSERT INTO content_blocks (content_localization_id, block_type, block_order, block_data) VALUES
        (v_cl_blog8_en, 'heading',   0, '{"level":2,"text":"The AI Writing Tool Dilemma"}'::jsonb),
        (v_cl_blog8_en, 'paragraph', 1, '{"text":"Most AI writing tools send your content to the cloud and train on it. Forja''s AI assist works differently."}'::jsonb),
        (v_cl_blog8_en, 'heading',   2, '{"level":3,"text":"How Forja''s AI Assist Works"}'::jsonb),
        (v_cl_blog8_en, 'paragraph', 3, '{"text":"You bring your own API key. Forja never sees it. No training opt-in. Prompt injection defense built in."}'::jsonb),
        (v_cl_blog8_en, 'heading',   4, '{"level":3,"text":"The Privacy Guarantee"}'::jsonb),
        (v_cl_blog8_en, 'paragraph', 5, '{"text":"Your content goes from Forja to your chosen LLM provider and back. No intermediary. No logging. No training."}'::jsonb);

    -- ========================================================================
    -- PAGE: Home — landing page with sections
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_page, v_env_dev, 'home', 'published', NOW() - INTERVAL '30 days', 1, v_user_admin)
    RETURNING id INTO v_content_page_home;

    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_page_home, v_site1, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, meta_title, meta_description, translation_status)
    VALUES (v_content_page_home, v_locale_en,
        'Home', 'I build software that respects your users.',
        'John Forja — Privacy-First CMS Developer', 'The personal blog and portfolio of John Forja, a privacy-obsessed developer from Vienna building a CMS in Rust.',
        'approved')
    RETURNING id INTO v_cl_home_en;

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, translation_status)
    VALUES (v_content_page_home, v_locale_de,
        'Startseite', 'Ich baue Software, die deine Nutzer respektiert.', 'approved')
    RETURNING id INTO v_cl_home_de;

    INSERT INTO pages (content_id, route, page_type, is_in_navigation, navigation_order)
    VALUES (v_content_page_home, '/', 'landing', TRUE, 0)
    RETURNING id INTO v_page_home;

    -- Landing page sections: Hero
    INSERT INTO page_sections (page_id, section_type, display_order, cover_image_id, call_to_action_route, settings)
    VALUES (v_page_home, 'hero', 0, v_media_hero, '/blog', '{"fullWidth":true}'::jsonb)
    RETURNING id INTO v_section_hero;

    INSERT INTO page_section_localizations (page_section_id, locale_id, title, text, button_text) VALUES
        (v_section_hero, v_locale_en, 'I build software that respects your users.', 'Privacy-first CMS developer from Vienna. I believe your tools shouldn''t track the people who use them.', 'Read the Blog'),
        (v_section_hero, v_locale_de, 'Ich baue Software, die deine Nutzer respektiert.', 'Privacy-first CMS-Entwickler aus Wien. Ich glaube, dass deine Werkzeuge die Menschen, die sie nutzen, nicht tracken sollten.', 'Zum Blog');

    -- Landing page sections: Features
    INSERT INTO page_sections (page_id, section_type, display_order, settings)
    VALUES (v_page_home, 'features', 1, '{"columns":3}'::jsonb)
    RETURNING id INTO v_section_feat;

    INSERT INTO page_section_localizations (page_section_id, locale_id, title, text) VALUES
        (v_section_feat, v_locale_en, 'What I Care About', 'Privacy by design. Performance by default. Simplicity by choice.'),
        (v_section_feat, v_locale_de, 'Was mir wichtig ist', 'Datenschutz durch Design. Performance als Standard. Einfachheit aus Ueberzeugung.');

    -- Landing page sections: CTA
    INSERT INTO page_sections (page_id, section_type, display_order, call_to_action_route)
    VALUES (v_page_home, 'cta', 2, 'https://github.com/forja-cms')
    RETURNING id INTO v_section_cta;

    INSERT INTO page_section_localizations (page_section_id, locale_id, title, text, button_text) VALUES
        (v_section_cta, v_locale_en, 'Forja is Open Source', 'The CMS I built is free to self-host, privacy-first by architecture, and powered by Rust. Give it a try.', 'View on GitHub'),
        (v_section_cta, v_locale_de, 'Forja ist Open Source', 'Das CMS, das ich gebaut habe, ist kostenlos self-hostbar, privacy-first in der Architektur und in Rust geschrieben.', 'Auf GitHub ansehen');

    -- ========================================================================
    -- PAGE: About
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_page, v_env_dev, 'about', 'published', NOW() - INTERVAL '30 days', 1, v_user_admin)
    RETURNING id INTO v_content_page_about;

    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_page_about, v_site1, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, body, translation_status)
    VALUES (v_content_page_about, v_locale_en,
        'About Me',
        E'## About John Forja\n\nI''m a developer based in Vienna, Austria, obsessed with building software that respects its users. I believe the best tools are the ones that work for you without working against the people who use them.\n\n### Background\n\nI spent five years building privacy compliance tools at DataGuard, watching companies scramble to retrofit GDPR compliance into systems that were never designed for it. That experience taught me a simple lesson: **privacy isn''t something you add later — it''s something you design from day one.**\n\n### Why Forja\n\nI built Forja because every CMS I evaluated for my own projects tracked users by default. Cookie banners, session recording, behavioral analytics — all baked in. I wanted a CMS that simply didn''t need any of that. So I built one.\n\n### Philosophy\n\n- **Privacy is architecture, not a feature** — if your system doesn''t need PII, it can''t leak PII\n- **Rust for correctness** — the compiler catches bugs before users do\n- **Ship small, ship often** — a focused product beats a feature-packed one\n- **Open source by default** — the best code is code that can be audited',
        'approved')
    RETURNING id INTO v_cl_about_en;

    INSERT INTO content_localizations (content_id, locale_id, title, body, translation_status)
    VALUES (v_content_page_about, v_locale_de,
        'Ueber mich',
        E'## Ueber John Forja\n\nIch bin Entwickler aus Wien, besessen davon, Software zu bauen, die ihre Nutzer respektiert. Ich glaube, die besten Werkzeuge sind die, die fuer dich arbeiten, ohne gegen die Menschen zu arbeiten, die sie nutzen.\n\n### Hintergrund\n\nFuenf Jahre lang habe ich bei DataGuard Privacy-Compliance-Tools gebaut und beobachtet, wie Unternehmen versuchen, DSGVO-Konformitaet nachtraeglich in Systeme einzubauen, die nie dafuer konzipiert waren.\n\n### Philosophie\n\n- **Datenschutz ist Architektur, kein Feature**\n- **Rust fuer Korrektheit**\n- **Klein und oft ausliefern**\n- **Open Source als Standard**',
        'approved')
    RETURNING id INTO v_cl_about_de;

    INSERT INTO pages (content_id, route, page_type, is_in_navigation, navigation_order)
    VALUES (v_content_page_about, '/about', 'static', TRUE, 2)
    RETURNING id INTO v_page_about;

    -- About page sections: Hero
    INSERT INTO page_sections (page_id, section_type, display_order, cover_image_id, settings)
    VALUES (v_page_about, 'hero', 0, v_media_avatar, '{"fullWidth":false}'::jsonb)
    RETURNING id INTO v_tmp_id;
    INSERT INTO page_section_localizations (page_section_id, locale_id, title, text) VALUES
        (v_tmp_id, v_locale_en, 'About Me', 'Privacy-obsessed developer from Vienna building a CMS in Rust.'),
        (v_tmp_id, v_locale_de, 'Ueber mich', 'Privacy-besessener Entwickler aus Wien, der ein CMS in Rust baut.');

    -- About page sections: Skills
    INSERT INTO page_sections (page_id, section_type, display_order, settings)
    VALUES (v_page_about, 'features', 1, '{"columns":3}'::jsonb)
    RETURNING id INTO v_tmp_id;
    INSERT INTO page_section_localizations (page_section_id, locale_id, title, text) VALUES
        (v_tmp_id, v_locale_en, 'What I Work With', 'Rust, TypeScript, React, PostgreSQL, Docker, Astro, and SQLx.'),
        (v_tmp_id, v_locale_de, 'Womit ich arbeite', 'Rust, TypeScript, React, PostgreSQL, Docker, Astro und SQLx.');

    -- ========================================================================
    -- PAGE: Contact
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_page, v_env_dev, 'contact', 'published', NOW() - INTERVAL '30 days', 1, v_user_admin)
    RETURNING id INTO v_content_page_contact;

    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_page_contact, v_site1, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, body, translation_status)
    VALUES (v_content_page_contact, v_locale_en,
        'Contact',
        E'## Get in Touch\n\nFeel free to reach out via email or connect on social media.\n\n**Email:** hello@forja.dev\n**Location:** Vienna, Austria\n**GitHub:** github.com/forja-cms',
        'approved')
    RETURNING id INTO v_cl_contact_en;

    INSERT INTO pages (content_id, route, page_type, is_in_navigation, navigation_order)
    VALUES (v_content_page_contact, '/contact', 'contact', TRUE, 3)
    RETURNING id INTO v_page_contact;

    -- Contact page sections
    INSERT INTO page_sections (page_id, section_type, display_order)
    VALUES (v_page_contact, 'contact', 0)
    RETURNING id INTO v_tmp_id;
    INSERT INTO page_section_localizations (page_section_id, locale_id, title, text) VALUES
        (v_tmp_id, v_locale_en, 'Get in Touch', 'Have a question about Forja or want to collaborate? Drop me a message.'),
        (v_tmp_id, v_locale_de, 'Kontakt aufnehmen', 'Hast du eine Frage zu Forja oder moechtest zusammenarbeiten? Schreib mir.');

    -- ========================================================================
    -- CV ENTRIES (3 total)
    -- ========================================================================
    -- Entry 1: Current role — Founder at Forja
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_cv, v_env_dev, 'cv-forja-founder', 'published', NOW(), 1, v_user_admin)
    RETURNING id INTO v_content_cv1;
    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_cv1, v_site1, TRUE);

    INSERT INTO cv_entries (content_id, company, company_url, location, start_date, is_current, entry_type, display_order)
    VALUES (v_content_cv1, 'Forja', 'https://github.com/forja-cms', 'Vienna, Austria', '2025-01-01', TRUE, 'work', 0)
    RETURNING id INTO v_cv1;

    INSERT INTO cv_entry_localizations (cv_entry_id, locale_id, position, description, achievements) VALUES
        (v_cv1, v_locale_en, 'Founder & Developer',
         'Building an open-source, privacy-first CMS in Rust. Solo developer, full stack — from database migrations to React components to Docker deployment.',
         '["Built a multi-tenant CMS handling 41,000 req/sec on a single instance","Implemented privacy-first analytics with zero cookies or PII storage","Created a typed TypeScript SDK with 94.85% test coverage"]'::jsonb),
        (v_cv1, v_locale_de, 'Gruender & Entwickler',
         'Entwicklung eines Open-Source, Privacy-First CMS in Rust. Solo-Entwickler, Full Stack — von Datenbankmigrationen bis React-Komponenten bis Docker-Deployment.',
         '["Multi-Tenant-CMS mit 41.000 Anfragen/Sek auf einer einzelnen Instanz gebaut","Privacy-First-Analytics ohne Cookies oder personenbezogene Daten implementiert","Typisiertes TypeScript-SDK mit 94,85% Testabdeckung erstellt"]'::jsonb);

    INSERT INTO cv_entry_skills (cv_entry_id, skill_id, relevance_score) VALUES
        (v_cv1, v_skill_rust, 5), (v_cv1, v_skill_ts, 5), (v_cv1, v_skill_react, 4), (v_cv1, v_skill_postgres, 5), (v_cv1, v_skill_docker, 4);

    -- Entry 2: Previous role — Senior Full-Stack at DataGuard
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_cv, v_env_dev, 'cv-dataguard', 'published', NOW(), 1, v_user_admin)
    RETURNING id INTO v_content_cv2;
    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_cv2, v_site1, TRUE);

    INSERT INTO cv_entries (content_id, company, company_url, location, start_date, end_date, entry_type, display_order)
    VALUES (v_content_cv2, 'DataGuard GmbH', 'https://www.dataguard.de', 'Munich, Germany', '2020-01-01', '2025-01-01', 'work', 1)
    RETURNING id INTO v_cv2;

    INSERT INTO cv_entry_localizations (cv_entry_id, locale_id, position, description, achievements) VALUES
        (v_cv2, v_locale_en, 'Senior Full-Stack Engineer',
         'Led the frontend team building privacy compliance tools for enterprise clients.',
         '["Migrated legacy PHP dashboard to React + TypeScript","Reduced page load time by 60% through code splitting and lazy loading","Mentored 3 junior developers"]'::jsonb),
        (v_cv2, v_locale_de, 'Senior Full-Stack-Entwickler',
         'Leitung des Frontend-Teams fuer Privacy-Compliance-Tools fuer Unternehmenskunden.',
         '["Legacy-PHP-Dashboard auf React + TypeScript migriert","Seitenladezeit um 60% durch Code-Splitting und Lazy Loading reduziert","3 Junior-Entwickler betreut"]'::jsonb);

    INSERT INTO cv_entry_skills (cv_entry_id, skill_id, relevance_score) VALUES
        (v_cv2, v_skill_ts, 5), (v_cv2, v_skill_react, 5), (v_cv2, v_skill_docker, 3);

    -- Entry 3: Education — MSc at TU Wien
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_cv, v_env_dev, 'cv-tu-wien', 'published', NOW(), 1, v_user_admin)
    RETURNING id INTO v_content_cv3;
    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_cv3, v_site1, TRUE);

    INSERT INTO cv_entries (content_id, company, company_url, location, start_date, end_date, entry_type, display_order)
    VALUES (v_content_cv3, 'TU Wien', 'https://www.tuwien.at', 'Vienna, Austria', '2015-10-01', '2020-06-30', 'education', 2)
    RETURNING id INTO v_cv3;

    INSERT INTO cv_entry_localizations (cv_entry_id, locale_id, position, description) VALUES
        (v_cv3, v_locale_en, 'MSc Computer Science', 'Focus on distributed systems and software architecture. Thesis on real-time data processing in privacy-preserving systems.'),
        (v_cv3, v_locale_de, 'MSc Informatik', 'Schwerpunkt verteilte Systeme und Softwarearchitektur. Masterarbeit ueber Echtzeit-Datenverarbeitung in datenschutzfreundlichen Systemen.');

    -- ========================================================================
    -- PORTFOLIO PROJECTS (3 projects)
    -- ========================================================================

    -- Project 1: Forja CMS (the main product, featured, ongoing)
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_project, v_env_dev, 'forja-cms', 'published', NOW() - INTERVAL '60 days', 1, v_user_admin)
    RETURNING id INTO v_content_project1;
    INSERT INTO content_sites (content_id, site_id, is_owner, is_featured) VALUES (v_content_project1, v_site1, TRUE, TRUE);

    INSERT INTO projects (content_id, slug, display_order, is_featured, start_date, is_ongoing)
    VALUES (v_content_project1, 'forja-cms', 0, TRUE, '2025-09-01', TRUE)
    RETURNING id INTO v_project1;

    INSERT INTO project_localizations (project_id, locale_id, title, short_description, description) VALUES
        (v_project1, v_locale_en, 'Forja CMS',
         'Privacy-first, Rust-powered headless CMS with multi-tenancy.',
         E'A full-featured content management system built from scratch in Rust. Forja manages multiple websites from a single instance, tracks zero user data, and deploys as a single binary.\n\n**Key Features:**\n- Multi-tenant architecture (one instance, unlimited sites)\n- Privacy-first analytics (no cookies, no PII, GDPR by design)\n- 200+ API endpoints with OpenAPI documentation\n- Typed TypeScript SDK (@forjacms/client)\n- 11-language admin dashboard\n- AI content assist (bring your own API key)\n- Rich block editor (Tiptap)\n\n**Tech Stack:** Rust (Rocket), PostgreSQL, Redis, React 19, TypeScript, Astro'),
        (v_project1, v_locale_de, 'Forja CMS',
         'Privacy-first, Rust-basiertes Headless CMS mit Multi-Tenancy.',
         E'Ein vollstaendiges Content-Management-System, von Grund auf in Rust gebaut. Forja verwaltet mehrere Websites von einer einzigen Instanz aus, speichert keine Nutzerdaten und wird als einzelne Binary deployed.');

    INSERT INTO project_links (project_id, label, url, link_type, icon, display_order) VALUES
        (v_project1, 'Source Code', 'https://github.com/forja-cms/forja', 'source', 'github', 0),
        (v_project1, 'Live Demo', 'https://demo.forja.dev', 'demo', 'external-link', 1),
        (v_project1, 'Documentation', 'https://forja-docs.dorfstetter.at', 'documentation', 'book', 2);

    INSERT INTO project_skills (project_id, skill_id) VALUES
        (v_project1, v_skill_rust), (v_project1, v_skill_ts), (v_project1, v_skill_react),
        (v_project1, v_skill_postgres), (v_project1, v_skill_docker), (v_project1, v_skill_sqlx);

    INSERT INTO project_media (project_id, media_id, display_order, is_cover) VALUES
        (v_project1, v_media_hero, 0, TRUE);

    -- Project 2: @forjacms/client SDK (published, featured)
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_project, v_env_dev, 'forja-client-sdk', 'published', NOW() - INTERVAL '30 days', 1, v_user_admin)
    RETURNING id INTO v_content_project2;
    INSERT INTO content_sites (content_id, site_id, is_owner, is_featured) VALUES (v_content_project2, v_site1, TRUE, TRUE);

    INSERT INTO projects (content_id, slug, display_order, is_featured, start_date, is_ongoing)
    VALUES (v_content_project2, 'forja-client-sdk', 1, TRUE, '2026-01-15', TRUE)
    RETURNING id INTO v_project2;

    INSERT INTO project_localizations (project_id, locale_id, title, short_description, description) VALUES
        (v_project2, v_locale_en, '@forjacms/client',
         'Typed TypeScript SDK for the Forja content API.',
         E'A fully typed TypeScript SDK that makes integrating with Forja effortless. Works in Node.js, browsers, and edge runtimes (Cloudflare Workers, Vercel Edge).\n\n**Highlights:**\n- 145 tests, 94.85% code coverage\n- Typed resources: blogs, pages, navigation, taxonomy, analytics, CV, legal, media, projects\n- Custom error types: ForjaAuthError, ForjaRateLimitError, ForjaValidationError\n- Framework integration examples for React, Angular, and vanilla TypeScript\n\n```typescript\nconst client = new ForjaClient({ apiKey, siteId });\nconst posts = await client.blogs.listPublished({ locale: ''en'' });\n```'),
        (v_project2, v_locale_de, '@forjacms/client',
         'Typisiertes TypeScript SDK fuer die Forja Content API.',
         'Ein vollstaendig typisiertes TypeScript SDK, das die Integration mit Forja muehelos macht. Funktioniert in Node.js, Browsern und Edge-Runtimes.');

    INSERT INTO project_links (project_id, label, url, link_type, icon, display_order) VALUES
        (v_project2, 'npm Package', 'https://www.npmjs.com/package/@forjacms/client', 'website', 'package', 0),
        (v_project2, 'Source Code', 'https://github.com/forja-cms/forja/tree/main/libs/client', 'source', 'github', 1);

    INSERT INTO project_skills (project_id, skill_id) VALUES
        (v_project2, v_skill_ts);

    -- Project 3: @forjacms/analytics (published)
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_project, v_env_dev, 'forja-analytics', 'published', NOW() - INTERVAL '45 days', 1, v_user_admin)
    RETURNING id INTO v_content_project3;
    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_project3, v_site1, TRUE);

    INSERT INTO projects (content_id, slug, display_order, is_featured, start_date, is_ongoing)
    VALUES (v_content_project3, 'forja-analytics', 2, FALSE, '2026-02-01', TRUE)
    RETURNING id INTO v_project3;

    INSERT INTO project_localizations (project_id, locale_id, title, short_description, description) VALUES
        (v_project3, v_locale_en, '@forjacms/analytics',
         'Privacy-first analytics tracker. Zero cookies, zero PII.',
         E'A lightweight analytics tracker that counts page views without tracking users. Designed for GDPR compliance from day one.\n\n**How it works:**\n- No cookies set\n- No IP addresses stored\n- No user-agent tracking\n- Daily-rotating visitor hashes for unique counts\n- Works with React, Vue, Angular, Astro, or vanilla JS\n\n```typescript\nimport { init, autoTrack } from ''@forjacms/analytics'';\ninit({ siteId: ''your-site'' });\nautoTrack(); // tracks SPA route changes\n```'),
        (v_project3, v_locale_de, '@forjacms/analytics',
         'Privacy-first Analytics-Tracker. Keine Cookies, keine personenbezogenen Daten.',
         'Ein leichtgewichtiger Analytics-Tracker, der Seitenaufrufe zaehlt ohne Nutzer zu tracken. Von Tag eins fuer DSGVO-Konformitaet konzipiert.');

    INSERT INTO project_links (project_id, label, url, link_type, icon, display_order) VALUES
        (v_project3, 'npm Package', 'https://www.npmjs.com/package/@forjacms/analytics', 'website', 'package', 0),
        (v_project3, 'Source Code', 'https://github.com/forja-cms/forja/tree/main/libs/analytics', 'source', 'github', 1);

    INSERT INTO project_skills (project_id, skill_id) VALUES
        (v_project3, v_skill_ts);

    -- ========================================================================
    -- LEGAL DOCUMENTS (4 documents: cookie consent, privacy, imprint, ToS)
    -- ========================================================================

    -- Cookie Consent
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_legal, v_env_dev, 'cookie-consent', 'published', NOW() - INTERVAL '30 days', 1, v_user_admin)
    RETURNING id INTO v_content_legal_cookie;
    INSERT INTO content_sites (content_id, site_id, is_owner, site_specific_slug) VALUES (v_content_legal_cookie, v_site1, TRUE, 'cookie-consent');

    INSERT INTO legal_documents (content_id, cookie_name, document_type)
    VALUES (v_content_legal_cookie, 'cookie_consent', 'cookie_consent')
    RETURNING id INTO v_legal_cookie;

    INSERT INTO legal_document_localizations (legal_document_id, locale_id, title, intro) VALUES
        (v_legal_cookie, v_locale_en, 'Cookie Settings', 'Forja uses only essential cookies. No tracking, no analytics cookies, no third-party cookies.'),
        (v_legal_cookie, v_locale_de, 'Cookie-Einstellungen', 'Forja verwendet nur essenzielle Cookies. Kein Tracking, keine Analyse-Cookies, keine Drittanbieter-Cookies.');

    INSERT INTO legal_groups (legal_document_id, cookie_name, display_order, is_required, default_enabled)
    VALUES (v_legal_cookie, 'essential', 0, TRUE, TRUE)
    RETURNING id INTO v_lg_essential;

    INSERT INTO legal_group_localizations (legal_group_id, locale_id, title, description) VALUES
        (v_lg_essential, v_locale_en, 'Essential Cookies', 'Required for the website to function. Cannot be disabled. That''s it — we don''t have any other cookie categories because we don''t track you.'),
        (v_lg_essential, v_locale_de, 'Essenzielle Cookies', 'Fuer die Funktion der Website erforderlich. Kann nicht deaktiviert werden. Das war''s — wir haben keine anderen Cookie-Kategorien, weil wir dich nicht tracken.');

    INSERT INTO legal_items (legal_group_id, cookie_name, display_order, is_required)
    VALUES (v_lg_essential, 'session_id', 0, TRUE)
    RETURNING id INTO v_li_session;

    INSERT INTO legal_item_localizations (legal_item_id, locale_id, title, content) VALUES
        (v_li_session, v_locale_en, 'Session Cookie', '[{"type":"paragraph","text":"Maintains your session while browsing. Expires when you close your browser."}]'::jsonb),
        (v_li_session, v_locale_de, 'Session-Cookie', '[{"type":"paragraph","text":"Erhaelt Ihre Sitzung beim Surfen. Laeuft ab wenn Sie den Browser schliessen."}]'::jsonb);

    -- Privacy Policy
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_legal, v_env_dev, 'privacy-policy', 'published', NOW() - INTERVAL '30 days', 1, v_user_admin)
    RETURNING id INTO v_content_legal_privacy;
    INSERT INTO content_sites (content_id, site_id, is_owner, site_specific_slug) VALUES (v_content_legal_privacy, v_site1, TRUE, 'privacy-policy');

    INSERT INTO legal_documents (content_id, cookie_name, document_type)
    VALUES (v_content_legal_privacy, 'privacy_policy', 'privacy_policy')
    RETURNING id INTO v_legal_privacy;

    INSERT INTO legal_document_localizations (legal_document_id, locale_id, title, intro) VALUES
        (v_legal_privacy, v_locale_en, 'Privacy Policy', E'This privacy policy explains what we collect (almost nothing) and what we don''t (everything else).\n\n## What We Don''t Collect\n\n- IP addresses\n- User agents\n- Tracking cookies\n- Behavioral data\n- Personal profiles\n\n## What We Do Collect\n\n- Aggregate page view counts\n- Referrer domains (not full URLs)\n- Daily unique visitor count via rotating hash (cannot identify individuals)'),
        (v_legal_privacy, v_locale_de, 'Datenschutzerklaerung', E'Diese Datenschutzerklaerung erlaeutert, was wir erheben (fast nichts) und was nicht (alles andere).\n\n## Was wir nicht erheben\n\n- IP-Adressen\n- User Agents\n- Tracking-Cookies\n- Verhaltensdaten\n- Persoenliche Profile');

    -- Imprint
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_legal, v_env_dev, 'imprint', 'published', NOW() - INTERVAL '30 days', 1, v_user_admin)
    RETURNING id INTO v_content_legal_imprint;
    INSERT INTO content_sites (content_id, site_id, is_owner, site_specific_slug) VALUES (v_content_legal_imprint, v_site1, TRUE, 'imprint');

    INSERT INTO legal_documents (content_id, cookie_name, document_type)
    VALUES (v_content_legal_imprint, 'imprint_main', 'imprint')
    RETURNING id INTO v_legal_imprint;

    INSERT INTO legal_document_localizations (legal_document_id, locale_id, title, intro) VALUES
        (v_legal_imprint, v_locale_en, 'Imprint', E'## Site Operator\n\nJohn Forja\nMusterstrasse 42\n1010 Vienna, Austria\n\n**Email:** hello@forja.dev\n\n## Disclaimer\n\nThe contents of this website have been created with the utmost care. However, no guarantee can be given for the correctness, completeness, and timeliness of the content.'),
        (v_legal_imprint, v_locale_de, 'Impressum', E'## Betreiber\n\nJohn Forja\nMusterstrasse 42\n1010 Wien, Oesterreich\n\n**E-Mail:** hello@forja.dev\n\n## Haftungsausschluss\n\nDie Inhalte dieser Website wurden mit groesster Sorgfalt erstellt. Fuer die Richtigkeit, Vollstaendigkeit und Aktualitaet der Inhalte kann jedoch keine Gewaehr uebernommen werden.');

    -- Terms of Service
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_legal, v_env_dev, 'terms-of-service', 'published', NOW() - INTERVAL '30 days', 1, v_user_admin)
    RETURNING id INTO v_content_legal_tos;
    INSERT INTO content_sites (content_id, site_id, is_owner, site_specific_slug) VALUES (v_content_legal_tos, v_site1, TRUE, 'terms-of-service');

    INSERT INTO legal_documents (content_id, cookie_name, document_type)
    VALUES (v_content_legal_tos, 'terms_of_service', 'terms_of_service')
    RETURNING id INTO v_legal_tos;

    INSERT INTO legal_document_localizations (legal_document_id, locale_id, title, intro) VALUES
        (v_legal_tos, v_locale_en, 'Terms of Service', E'## Terms of Service\n\nBy using this website, you agree to these terms.\n\n### Your Content\n\nYou own everything you create. Forja does not claim any rights to your content. If you leave, you can export all your data.\n\n### Our Service\n\nWe provide a content management platform. We will not sell your data, show you ads, or track your behavior. We charge a fair price for hosting and that is our entire business model.\n\n### Acceptable Use\n\nDon''t use Forja to host illegal content, spam, or malware. Don''t attempt to access other users'' data. Be a good citizen.\n\n### Liability\n\nForja is provided as-is. We do our best to keep the service running and your data safe, but we cannot guarantee 100% uptime or zero data loss. Back up your important content.\n\n### Changes\n\nWe may update these terms. We will notify you via email before any material changes take effect.'),
        (v_legal_tos, v_locale_de, 'Nutzungsbedingungen', E'## Nutzungsbedingungen\n\nMit der Nutzung dieser Website stimmen Sie diesen Bedingungen zu.\n\n### Ihre Inhalte\n\nSie besitzen alles, was Sie erstellen. Forja beansprucht keine Rechte an Ihren Inhalten.\n\n### Unser Service\n\nWir bieten eine Content-Management-Plattform. Wir verkaufen Ihre Daten nicht, zeigen Ihnen keine Werbung und tracken Ihr Verhalten nicht.\n\n### Haftung\n\nForja wird ohne Gewaehr bereitgestellt. Wir tun unser Bestes, aber koennen keine 100% Verfuegbarkeit garantieren.');

    -- ========================================================================
    -- SOCIAL LINKS
    -- ========================================================================
    INSERT INTO social_links (site_id, title, url, icon, alt_text, display_order) VALUES
        (v_site1, 'GitHub',    'https://github.com/forja-cms',           'github',    'GitHub profile',     0),
        (v_site1, 'Mastodon',  'https://mastodon.social/@johnforja',     'mastodon',  'Mastodon profile',   1),
        (v_site1, 'Email',     'mailto:hello@forja.dev',                 'mail',      'Send email',         2);

    -- ========================================================================
    -- WEBHOOKS
    -- ========================================================================
    INSERT INTO webhooks (site_id, url, secret, description, events, is_active)
    VALUES (v_site1, 'https://hooks.example.com/cms/john-forja', 'whsec_s1_dev_00000000', 'Deploy trigger for john-forja', ARRAY['content.published','content.updated'], TRUE)
    RETURNING id INTO v_webhook1;

    INSERT INTO webhooks (site_id, url, secret, description, events, is_active)
    VALUES (v_site1, 'https://hooks.example.com/cms/john-forja-slack', 'whsec_s1_slack_00000000', 'Slack notification for john-forja', ARRAY['blog.published'], TRUE)
    RETURNING id INTO v_webhook2;

    -- Webhook deliveries
    INSERT INTO webhook_deliveries (webhook_id, event_type, payload, status_code, response_body, attempt_number, delivered_at) VALUES
        (v_webhook1, 'content.published', '{"content_id":"00000000-0000-0000-0000-000000000001","slug":"why-i-quit-nodejs-rewrote-in-rust","type":"blog"}'::jsonb, 200, '{"ok":true}', 1, NOW() - INTERVAL '30 days'),
        (v_webhook1, 'content.published', '{"content_id":"00000000-0000-0000-0000-000000000002","slug":"privacy-is-not-a-feature","type":"blog"}'::jsonb, 200, '{"ok":true}', 1, NOW() - INTERVAL '21 days'),
        (v_webhook2, 'blog.published',    '{"content_id":"00000000-0000-0000-0000-000000000005","slug":"eight-week-launch-plan","type":"blog"}'::jsonb, 200, '{"ok":true,"channel":"#content"}', 1, NOW() - INTERVAL '2 days'),
        (v_webhook1, 'content.updated',   '{"content_id":"00000000-0000-0000-0000-000000000004","slug":"one-binary-twenty-sites-multi-tenancy","type":"blog"}'::jsonb, NULL, NULL, 1, NOW() - INTERVAL '1 day');

    -- ========================================================================
    -- REDIRECTS
    -- ========================================================================
    INSERT INTO redirects (site_id, source_path, destination_path, status_code, is_active, description) VALUES
        (v_site1, '/posts',      '/blog',  301, TRUE,  'Old posts path redirect'),
        (v_site1, '/about-me',   '/about', 301, TRUE,  'Consolidated about pages'),
        (v_site1, '/portfolio',  '/cv',    302, TRUE,  'Portfolio redirects to CV');

    -- ========================================================================
    -- NOTIFICATIONS
    -- ========================================================================
    INSERT INTO notifications (site_id, recipient_clerk_id, actor_clerk_id, notification_type, entity_type, entity_id, title, message, is_read, read_at, created_at) VALUES
        (v_site1, 'user_3A5ITrl5uemDUIc1phImRReouHw', NULL, 'system', 'blog', v_content_blog1, 'Blog post published successfully', 'Your blog post "Why I Quit Node.js and Rewrote Everything in Rust" is now live.', TRUE, NOW() - INTERVAL '29 days', NOW() - INTERVAL '30 days'),
        (v_site1, 'user_3A5ITrl5uemDUIc1phImRReouHw', NULL, 'system', 'site', v_site1, 'Welcome to Forja!', 'Welcome to Forja! Start by creating your first blog post.', FALSE, NULL, NOW() - INTERVAL '35 days'),
        (v_site1, 'user_3A5ITrl5uemDUIc1phImRReouHw', NULL, 'system', 'site', v_site1, 'Your site is live and ready for content.', 'Your site john-forja is live and ready for content. Start writing!', TRUE, NOW() - INTERVAL '28 days', NOW() - INTERVAL '30 days');

    -- ========================================================================
    -- NAVIGATION MENUS
    -- ========================================================================
    INSERT INTO navigation_menus (site_id, slug, description, max_depth)
    VALUES (v_site1, 'primary', 'Primary navigation menu', 3) RETURNING id INTO v_menu_primary;
    INSERT INTO navigation_menu_localizations (navigation_menu_id, locale_id, name) VALUES
        (v_menu_primary, v_locale_en, 'Primary'), (v_menu_primary, v_locale_de, 'Hauptmenue');

    INSERT INTO navigation_menus (site_id, slug, description, max_depth)
    VALUES (v_site1, 'footer', 'Footer navigation links', 1) RETURNING id INTO v_menu_footer;
    INSERT INTO navigation_menu_localizations (navigation_menu_id, locale_id, name) VALUES
        (v_menu_footer, v_locale_en, 'Footer'), (v_menu_footer, v_locale_de, 'Fusszeile');

    -- ========================================================================
    -- NAVIGATION ITEMS (Primary Menu)
    -- ========================================================================
    INSERT INTO navigation_items (site_id, menu_id, page_id, display_order)
    VALUES (v_site1, v_menu_primary, v_page_home, 0) RETURNING id INTO v_nav_home;
    INSERT INTO navigation_item_localizations (navigation_item_id, locale_id, title) VALUES
        (v_nav_home, v_locale_en, 'Home'), (v_nav_home, v_locale_de, 'Start');

    INSERT INTO navigation_items (site_id, menu_id, external_url, icon, display_order)
    VALUES (v_site1, v_menu_primary, '/blog', 'book-open', 1) RETURNING id INTO v_nav_blog;
    INSERT INTO navigation_item_localizations (navigation_item_id, locale_id, title) VALUES
        (v_nav_blog, v_locale_en, 'Blog'), (v_nav_blog, v_locale_de, 'Blog');

    INSERT INTO navigation_items (site_id, menu_id, page_id, display_order)
    VALUES (v_site1, v_menu_primary, v_page_about, 2) RETURNING id INTO v_nav_about;
    INSERT INTO navigation_item_localizations (navigation_item_id, locale_id, title) VALUES
        (v_nav_about, v_locale_en, 'About'), (v_nav_about, v_locale_de, 'Ueber mich');

    INSERT INTO navigation_items (site_id, menu_id, page_id, display_order)
    VALUES (v_site1, v_menu_primary, v_page_contact, 3) RETURNING id INTO v_nav_contact;
    INSERT INTO navigation_item_localizations (navigation_item_id, locale_id, title) VALUES
        (v_nav_contact, v_locale_en, 'Contact'), (v_nav_contact, v_locale_de, 'Kontakt');

    -- Navigation Items (Footer Menu) — legal links are first-class references,
    -- resolved to the chain root's slug by the public tree endpoint
    INSERT INTO navigation_items (site_id, menu_id, legal_document_id, display_order)
    VALUES (v_site1, v_menu_footer, v_legal_privacy, 0) RETURNING id INTO v_tmp_id;
    INSERT INTO navigation_item_localizations (navigation_item_id, locale_id, title) VALUES
        (v_tmp_id, v_locale_en, 'Privacy Policy'), (v_tmp_id, v_locale_de, 'Datenschutz');

    INSERT INTO navigation_items (site_id, menu_id, legal_document_id, display_order)
    VALUES (v_site1, v_menu_footer, v_legal_imprint, 1) RETURNING id INTO v_tmp_id;
    INSERT INTO navigation_item_localizations (navigation_item_id, locale_id, title) VALUES
        (v_tmp_id, v_locale_en, 'Imprint'), (v_tmp_id, v_locale_de, 'Impressum');

    INSERT INTO navigation_items (site_id, menu_id, external_url, display_order)
    VALUES (v_site1, v_menu_footer, '/rss', 2) RETURNING id INTO v_tmp_id;
    INSERT INTO navigation_item_localizations (navigation_item_id, locale_id, title) VALUES
        (v_tmp_id, v_locale_en, 'RSS Feed'), (v_tmp_id, v_locale_de, 'RSS-Feed');

    INSERT INTO navigation_items (site_id, menu_id, external_url, open_in_new_tab, icon, display_order)
    VALUES (v_site1, v_menu_footer, 'https://github.com/forja-cms', TRUE, 'github', 3) RETURNING id INTO v_tmp_id;
    INSERT INTO navigation_item_localizations (navigation_item_id, locale_id, title) VALUES
        (v_tmp_id, v_locale_en, 'GitHub'), (v_tmp_id, v_locale_de, 'GitHub');

    -- ========================================================================
    -- MEDIA FOLDERS
    -- ========================================================================
    INSERT INTO media_folders (site_id, name, display_order)
    VALUES (v_site1, 'Blog Covers', 0)
    RETURNING id INTO v_mfolder_covers;

    INSERT INTO media_folders (site_id, name, display_order)
    VALUES (v_site1, 'Branding', 1)
    RETURNING id INTO v_mfolder_branding;

    -- Assign existing media to folders
    UPDATE media_files SET folder_id = v_mfolder_covers WHERE id IN (v_media_blog1_cover, v_media_blog2_cover, v_media_blog3_cover, v_media_blog4_cover, v_media_blog5_cover, v_media_blog6_cover, v_media_blog7_cover, v_media_blog8_cover);
    UPDATE media_files SET folder_id = v_mfolder_branding WHERE id IN (v_media_logo, v_media_avatar, v_media_hero);

    -- ========================================================================
    -- DOCUMENT FOLDERS (2 folders)
    -- ========================================================================
    INSERT INTO document_folders (site_id, name, display_order)
    VALUES (v_site1, 'Guides & Tutorials', 0)
    RETURNING id INTO v_doc_folder_guides;

    INSERT INTO document_folders (site_id, name, display_order)
    VALUES (v_site1, 'Specifications & Standards', 1)
    RETURNING id INTO v_doc_folder_specs;

    -- ========================================================================
    -- DOCUMENTS (6 links across 2 folders)
    -- ========================================================================
    INSERT INTO documents (site_id, folder_id, url, document_type, display_order)
    VALUES (v_site1, v_doc_folder_guides, 'https://doc.rust-lang.org/book/', 'link', 0)
    RETURNING id INTO v_doc_rust_book;

    INSERT INTO document_localizations (document_id, locale_id, name, description) VALUES
        (v_doc_rust_book, v_locale_en, 'The Rust Programming Language', 'Official Rust book — a comprehensive guide to learning Rust from scratch.'),
        (v_doc_rust_book, v_locale_de, 'Die Programmiersprache Rust', 'Offizielles Rust-Buch — ein umfassender Leitfaden zum Erlernen von Rust.');

    INSERT INTO documents (site_id, folder_id, url, document_type, display_order)
    VALUES (v_site1, v_doc_folder_guides, 'https://rocket.rs/guide/', 'link', 1)
    RETURNING id INTO v_doc_rocket;

    INSERT INTO document_localizations (document_id, locale_id, name, description) VALUES
        (v_doc_rocket, v_locale_en, 'Rocket Web Framework Guide', 'The web framework Forja is built on — type-safe, async, and fast.'),
        (v_doc_rocket, v_locale_de, 'Rocket Web Framework Anleitung', 'Das Web-Framework, auf dem Forja aufgebaut ist — typsicher, async und schnell.');

    INSERT INTO documents (site_id, folder_id, url, document_type, display_order)
    VALUES (v_site1, v_doc_folder_guides, 'https://github.com/launchbadge/sqlx', 'link', 2)
    RETURNING id INTO v_doc_sqlx;

    INSERT INTO document_localizations (document_id, locale_id, name, description) VALUES
        (v_doc_sqlx, v_locale_en, 'SQLx — Async Rust SQL Toolkit', 'Compile-time checked SQL queries without an ORM. The database layer behind Forja.'),
        (v_doc_sqlx, v_locale_de, 'SQLx — Async Rust SQL Toolkit', 'Zur Kompilierzeit geprueft SQL-Abfragen ohne ORM. Die Datenbankschicht hinter Forja.');

    INSERT INTO documents (site_id, folder_id, url, document_type, display_order)
    VALUES (v_site1, v_doc_folder_guides, 'https://clerk.com/docs', 'link', 3)
    RETURNING id INTO v_doc_clerk;

    INSERT INTO document_localizations (document_id, locale_id, name, description) VALUES
        (v_doc_clerk, v_locale_en, 'Clerk Authentication Docs', 'Authentication provider used by Forja for user management and JWT tokens.'),
        (v_doc_clerk, v_locale_de, 'Clerk Authentifizierungsdokumentation', 'Von Forja verwendeter Authentifizierungsanbieter fuer Benutzerverwaltung und JWT-Tokens.');

    INSERT INTO documents (site_id, folder_id, url, document_type, display_order)
    VALUES (v_site1, v_doc_folder_guides, 'https://docs.astro.build', 'link', 4)
    RETURNING id INTO v_doc_astro;

    INSERT INTO document_localizations (document_id, locale_id, name, description) VALUES
        (v_doc_astro, v_locale_en, 'Astro Documentation', 'The frontend framework used for Forja''s blog template. SSR-capable, fast, and content-focused.'),
        (v_doc_astro, v_locale_de, 'Astro Dokumentation', 'Das Frontend-Framework fuer Forjas Blog-Template. SSR-faehig, schnell und inhaltsorientiert.');

    INSERT INTO documents (site_id, folder_id, url, document_type, display_order)
    VALUES (v_site1, v_doc_folder_specs, 'https://gdpr.eu', 'link', 0)
    RETURNING id INTO v_doc_gdpr;

    INSERT INTO document_localizations (document_id, locale_id, name, description) VALUES
        (v_doc_gdpr, v_locale_en, 'GDPR Full Text', 'The complete text of the EU General Data Protection Regulation — the regulation that shaped Forja''s architecture.'),
        (v_doc_gdpr, v_locale_de, 'DSGVO Volltext', 'Der vollstaendige Text der EU-Datenschutz-Grundverordnung — die Verordnung, die Forjas Architektur geformt hat.');

    -- Sample uploaded document (text file)
    INSERT INTO documents (site_id, folder_id, url, document_type, display_order,
                           file_data, file_name, file_size, mime_type)
    VALUES (v_site1, v_doc_folder_specs, NULL, 'other', 1,
            E'\\x466f726a6120415049204b657920526566657265636e63650a0a4d6173746572202d2046756c6c206163636573730a41646d696e20202d2046756c6c20435255440a577269746520202d204372656174652f557064617465206f6e6c790a5265616420202020202d20526561642d6f6e6c79',
            'api-key-reference.txt', 104, 'text/plain')
    RETURNING id INTO v_tmp_id;

    INSERT INTO document_localizations (document_id, locale_id, name, description) VALUES
        (v_tmp_id, v_locale_en, 'API Key Permission Reference', 'Quick reference for Forja API key permission levels.');

    -- ========================================================================
    -- BLOG <-> DOCUMENT ATTACHMENTS
    -- ========================================================================
    INSERT INTO blog_documents (blog_id, document_id, display_order) VALUES
        (v_blog1, v_doc_rust_book, 0),
        (v_blog1, v_doc_rocket, 1),
        (v_blog2, v_doc_gdpr, 0),
        (v_blog4, v_doc_sqlx, 0);

    -- ========================================================================
    -- BULK GENERATION — Pagination test data
    -- ========================================================================
    -- Adds gen-* prefixed rows to push every paginated entity past page_size=25

    -- Tags (28 more -> 39 total)
    FOR v_i IN 1..28 LOOP
        INSERT INTO tags (slug, is_global) VALUES (
            (ARRAY['nextjs','python','kubernetes','terraform','graphql','svelte','vue','angular',
                   'redis','mongodb','elasticsearch','nginx','linux','git','aws-lambda','vercel',
                   'cloudflare','tailwind','sass','webpack','vite','esbuild','pnpm','bun',
                   'deno','htmx','astro','solid'])[v_i],
            v_i % 5 = 0
        ) RETURNING id INTO v_tmp_id;
        INSERT INTO tag_sites (tag_id, site_id) VALUES (v_tmp_id, v_site1) ON CONFLICT DO NOTHING;
        INSERT INTO tag_localizations (tag_id, locale_id, name)
        VALUES (v_tmp_id, v_locale_en,
            (ARRAY['Next.js','Python','Kubernetes','Terraform','GraphQL','Svelte','Vue','Angular',
                   'Redis','MongoDB','Elasticsearch','Nginx','Linux','Git','AWS Lambda','Vercel',
                   'Cloudflare','Tailwind CSS','Sass','Webpack','Vite','esbuild','pnpm','Bun',
                   'Deno','htmx','Astro','SolidJS'])[v_i]
        ) ON CONFLICT (tag_id, locale_id) DO NOTHING;
    END LOOP;

    -- Categories (26 more -> 30 total)
    FOR v_i IN 1..26 LOOP
        INSERT INTO categories (slug, is_global) VALUES (
            (ARRAY['cloud','security','performance-cat','testing','systems','mobile',
                   'data-science','machine-learning','oss-community','tooling','career',
                   'databases','networking','web-standards','accessibility','design-systems',
                   'api-design','observability','edge-computing','serverless','low-level',
                   'embedded','game-dev','blockchain','platform-engineering','developer-experience'])[v_i],
            v_i % 7 = 0
        ) RETURNING id INTO v_tmp_id;
        INSERT INTO category_sites (category_id, site_id) VALUES (v_tmp_id, v_site1) ON CONFLICT DO NOTHING;
        INSERT INTO category_localizations (category_id, locale_id, name, description)
        VALUES (v_tmp_id, v_locale_en,
            (ARRAY['Cloud','Security','Performance','Testing','Systems','Mobile',
                   'Data Science','Machine Learning','Open Source','Tooling','Career',
                   'Databases','Networking','Web Standards','Accessibility','Design Systems',
                   'API Design','Observability','Edge Computing','Serverless','Low-Level',
                   'Embedded','Game Dev','Blockchain','Platform Engineering','Developer Experience'])[v_i],
            (ARRAY['Cloud platforms, services, and infrastructure','Application and infrastructure security',
                   'Optimization, profiling, and benchmarking','Unit, integration, and E2E testing strategies',
                   'Software design patterns and system architecture','iOS, Android, and cross-platform development',
                   'Data analysis, visualization, and pipelines','Neural networks, NLP, and AI applications',
                   'Contributing to and maintaining open-source projects','Developer tools, editors, and productivity',
                   'Career growth, interviews, and team dynamics','SQL, NoSQL, and data modeling',
                   'Protocols, DNS, HTTP, and distributed networking','HTML, CSS, and browser APIs',
                   'Building inclusive and accessible web experiences','Component libraries and design tokens',
                   'REST, GraphQL, gRPC, and API best practices','Logging, monitoring, and tracing',
                   'CDN, edge functions, and distributed computing','FaaS, Lambda, and event-driven architecture',
                   'Systems programming, memory management, and OS internals','IoT, microcontrollers, and hardware interfaces',
                   'Game engines, rendering, and real-time systems','Distributed ledger and smart contract technologies',
                   'Internal platforms, CI/CD, and developer productivity','Improving workflows, DX, and developer happiness'])[v_i]
        ) ON CONFLICT (category_id, locale_id) DO NOTHING;
    END LOOP;

    -- Skills (28 more -> 35 total)
    FOR v_i IN 1..28 LOOP
        INSERT INTO skills (name, slug, category, proficiency_level, is_global) VALUES (
            (ARRAY['Python','Java','C#','Kotlin','Swift','Vue.js','Angular','Svelte',
                   'Redis','MongoDB','Kubernetes','Terraform','Nginx','Linux','GraphQL','Tailwind CSS',
                   'Next.js','Vite','Git','CI/CD','Playwright','Jest','gRPC','WebSockets',
                   'Figma','Prometheus','Grafana','Elasticsearch'])[v_i],
            (ARRAY['python','java','csharp','kotlin','swift','vuejs','angular','svelte',
                   'redis','mongodb','kubernetes','terraform','nginx','linux','graphql','tailwindcss',
                   'nextjs','vite','git','ci-cd','playwright','jest','grpc','websockets',
                   'figma','prometheus','grafana','elasticsearch'])[v_i],
            (ARRAY['programming','programming','programming','programming','programming',
                   'framework','framework','framework',
                   'database','database','devops','devops','devops','devops',
                   'framework','framework','framework','devops','devops','devops',
                   'framework','framework','framework','framework',
                   'devops','devops','devops','database'])[v_i]::skill_category,
            (v_i % 5) + 1,
            v_i % 8 = 0
        ) RETURNING id INTO v_tmp_id;
        INSERT INTO skill_sites (skill_id, site_id) VALUES (v_tmp_id, v_site1) ON CONFLICT DO NOTHING;
        INSERT INTO skill_localizations (skill_id, locale_id, display_name, description)
        VALUES (v_tmp_id, v_locale_en,
            (ARRAY['Python','Java','C#','Kotlin','Swift','Vue.js','Angular','Svelte',
                   'Redis','MongoDB','Kubernetes','Terraform','Nginx','Linux','GraphQL','Tailwind CSS',
                   'Next.js','Vite','Git','CI/CD','Playwright','Jest','gRPC','WebSockets',
                   'Figma','Prometheus','Grafana','Elasticsearch'])[v_i],
            (ARRAY['General-purpose language for scripting, data, and backend services',
                   'Enterprise-grade JVM language for large-scale applications',
                   'Cross-platform language for .NET and Unity development',
                   'Modern JVM language for Android and server-side development',
                   'Native language for iOS, macOS, and Apple platforms',
                   'Progressive JavaScript framework for building UIs',
                   'Full-featured TypeScript framework by Google',
                   'Compiler-first UI framework with minimal runtime',
                   'In-memory data store for caching and message brokering',
                   'Document-oriented NoSQL database for flexible schemas',
                   'Container orchestration platform for production workloads',
                   'Infrastructure as code for cloud provisioning',
                   'High-performance reverse proxy and web server',
                   'Open-source operating system and server administration',
                   'Query language and runtime for API data fetching',
                   'Utility-first CSS framework for rapid UI styling',
                   'React meta-framework with SSR, SSG, and routing',
                   'Fast build tool and dev server for modern web projects',
                   'Distributed version control and collaboration',
                   'Continuous integration and deployment pipeline automation',
                   'End-to-end browser testing framework by Microsoft',
                   'JavaScript testing framework with snapshot support',
                   'High-performance RPC framework by Google',
                   'Full-duplex communication protocol for real-time features',
                   'Collaborative design tool for UI/UX prototyping',
                   'Time-series monitoring and alerting toolkit',
                   'Visualization and dashboarding for metrics data',
                   'Distributed search and analytics engine'])[v_i]
        ) ON CONFLICT (skill_id, locale_id) DO NOTHING;
    END LOOP;

    -- Media files (32 more -> 43 total)
    FOR v_i IN 1..32 LOOP
        INSERT INTO media_files (
            filename, original_filename, mime_type, file_size,
            storage_provider, storage_path, public_url,
            width, height, uploaded_by, environment_id, is_global
        ) VALUES (
            'gen-media-' || v_i || '.webp',
            'generated-' || v_i || '.webp',
            'image/webp',
            50000 + (v_i * 1000),
            'local',
            '/media/gen-media-' || v_i || '.webp',
            'https://placehold.co/800x450/64748b/white?text=Gen+' || v_i,
            800, 450,
            v_user_admin,
            v_env_dev,
            v_i % 10 = 0
        ) RETURNING id INTO v_tmp_id;
        INSERT INTO media_sites (media_file_id, site_id) VALUES (v_tmp_id, v_site1);
        INSERT INTO media_metadata (media_file_id, locale_id, alt_text, title)
        VALUES (v_tmp_id, v_locale_en, 'Generated media ' || v_i, 'Media ' || v_i);
    END LOOP;

    -- Documents (26 more -> 33 total)
    FOR v_i IN 1..26 LOOP
        INSERT INTO documents (site_id, url, document_type, display_order) VALUES (
            v_site1,
            'https://example.com/docs/gen-doc-' || v_i,
            'link',
            v_i + 10
        ) RETURNING id INTO v_tmp_id;
        INSERT INTO document_localizations (document_id, locale_id, name, description)
        VALUES (v_tmp_id, v_locale_en, 'Document ' || v_i, 'Auto-generated document for pagination testing');
    END LOOP;

    -- Blogs (28 more -> 36 total for site 1)
    FOR v_i IN 1..28 LOOP
        INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by, updated_by)
        VALUES (
            v_et_blog, v_env_dev,
            (ARRAY[
                'async-rust-patterns-web-servers','postgresql-window-functions-cheatsheet',
                'type-safe-api-clients-openapi','building-cli-tools-rust-clap',
                'react-server-components-guide','deploying-rust-services-fly-io',
                'sqlx-vs-diesel-rust-orm','e2e-testing-playwright-ci',
                'understanding-rust-lifetimes','migrating-monolith-microservices',
                'websocket-realtime-nextjs','structured-logging-tracing-rust',
                'custom-react-hook-library','container-security-best-practices',
                'advanced-async-rust-tokio','postgresql-ctes-recursive-queries',
                'openapi-codegen-fullstack-workflow','rust-cli-cross-compilation',
                'react-server-actions-forms','fly-io-postgres-global-deployment',
                'diesel-migrations-best-practices','playwright-visual-regression-testing',
                'rust-lifetime-elision-rules','strangler-fig-pattern-practice',
                'server-sent-events-nextjs','opentelemetry-rust-distributed-tracing',
                'react-hooks-testing-patterns','docker-distroless-production'
            ])[v_i],
            (CASE
                WHEN v_i % 7 = 0 THEN 'draft'
                WHEN v_i % 11 = 0 THEN 'in_review'
                WHEN v_i % 13 = 0 THEN 'archived'
                WHEN v_i % 17 = 0 THEN 'scheduled'
                ELSE 'published'
            END)::content_status,
            CASE
                WHEN v_i % 7 = 0 THEN NULL  -- drafts have no published_at
                WHEN v_i % 17 = 0 THEN NULL -- scheduled have no published_at
                ELSE NOW() - (v_i || ' days')::INTERVAL
            END,
            1, v_user_admin, v_user_admin
        ) RETURNING id INTO v_tmp_content;
        INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_tmp_content, v_site1, TRUE);
        INSERT INTO content_localizations (content_id, locale_id, title, excerpt, body, translation_status)
        VALUES (v_tmp_content, v_locale_en,
            CASE (v_i - 1) % 14
                WHEN 0  THEN 'Async Rust Patterns for Web Servers'
                WHEN 1  THEN 'PostgreSQL Window Functions Cheat Sheet'
                WHEN 2  THEN 'Type-Safe API Clients with OpenAPI and TypeScript'
                WHEN 3  THEN 'Building CLI Tools in Rust with Clap'
                WHEN 4  THEN 'React Server Components: A Practical Guide'
                WHEN 5  THEN 'Deploying Rust Services on Fly.io'
                WHEN 6  THEN 'SQLx vs Diesel: Choosing a Rust ORM'
                WHEN 7  THEN 'End-to-End Testing with Playwright and CI'
                WHEN 8  THEN 'Understanding Rust Lifetimes Once and For All'
                WHEN 9  THEN 'Migrating a Monolith to Microservices'
                WHEN 10 THEN 'WebSocket Real-Time Updates in Next.js'
                WHEN 11 THEN 'Structured Logging with tracing in Rust'
                WHEN 12 THEN 'Building a Custom React Hook Library'
                ELSE         'Container Security Best Practices for Developers'
            END,
            CASE (v_i - 1) % 14
                WHEN 0  THEN 'Explore common async patterns for building performant Rust web servers.'
                WHEN 1  THEN 'A quick reference for PostgreSQL window functions with practical examples.'
                WHEN 2  THEN 'Generate fully typed API clients from your OpenAPI spec.'
                WHEN 3  THEN 'Build powerful command-line tools with Rust and the Clap library.'
                WHEN 4  THEN 'Hands-on guide to React Server Components and streaming SSR.'
                WHEN 5  THEN 'Deploy your Rust web services globally with Fly.io in minutes.'
                WHEN 6  THEN 'A comparison of the two most popular Rust database libraries.'
                WHEN 7  THEN 'Set up reliable E2E tests with Playwright running in your CI pipeline.'
                WHEN 8  THEN 'Demystify Rust lifetimes with clear examples and mental models.'
                WHEN 9  THEN 'Practical strategies for breaking apart a monolithic application.'
                WHEN 10 THEN 'Add real-time features to your Next.js app with WebSockets.'
                WHEN 11 THEN 'Implement structured, filterable logging in Rust using the tracing crate.'
                WHEN 12 THEN 'Package and publish reusable React hooks for your team.'
                ELSE         'Harden your containers against common security vulnerabilities.'
            END,
            CASE (v_i - 1) % 14
                WHEN 0  THEN E'## Async Rust Patterns\n\nAsync Rust is notoriously tricky. In this post I walk through the patterns I reach for most often when building web servers with Tokio.\n\n### Spawning vs. Awaiting\n\nNot every future needs `tokio::spawn`. If you can `await` inline, do it — spawning has overhead.\n\n```rust\n// Prefer this when sequential is fine\nlet user = get_user(id).await?;\nlet orders = get_orders(user.id).await?;\n```'
                WHEN 1  THEN E'## Window Functions\n\nPostgreSQL window functions are one of SQL''s best-kept secrets. They let you compute running totals, rankings, and moving averages without subqueries.\n\n```sql\nSELECT name, salary,\n       RANK() OVER (ORDER BY salary DESC) as rank,\n       AVG(salary) OVER () as company_avg\nFROM employees;\n```\n\n### ROW_NUMBER vs RANK vs DENSE_RANK\n\nThese three look similar but behave differently with ties.'
                WHEN 2  THEN E'## Type-Safe API Clients\n\nManually writing fetch calls is error-prone. With OpenAPI codegen, your API client is always in sync with the backend.\n\n### The Workflow\n\n1. Backend exports an OpenAPI spec\n2. `openapi-typescript-codegen` generates typed client\n3. Frontend imports and uses — full IntelliSense, zero guesswork\n\n```bash\nnpx openapi-typescript-codegen --input ./openapi.json --output ./src/api\n```'
                WHEN 3  THEN E'## CLI Tools in Rust\n\nRust is a fantastic language for CLI tools. With Clap v4, argument parsing is declarative and type-safe.\n\n```rust\nuse clap::Parser;\n\n#[derive(Parser)]\n#[command(name = "migrate", about = "Run database migrations")]\nstruct Cli {\n    #[arg(short, long, default_value = "postgres://localhost/app")]\n    database_url: String,\n}\n```\n\n### Distribution\n\nCompile to a single static binary — no runtime needed.'
                WHEN 4  THEN E'## React Server Components\n\nRSC fundamentally changes how we think about data fetching in React. Components can run on the server, fetch data directly, and send rendered HTML to the client.\n\n### The Mental Model\n\n- **Server Components**: fetch data, access backend resources, zero bundle size\n- **Client Components**: handle interactivity, state, browser APIs\n\n```tsx\n// This runs on the server — never ships to the browser\nexport default async function BlogList() {\n  const posts = await db.query("SELECT * FROM posts");\n  return <ul>{posts.map(p => <li key={p.id}>{p.title}</li>)}</ul>;\n}\n```'
                WHEN 5  THEN E'## Deploying on Fly.io\n\nFly.io makes deploying Rust services globally surprisingly simple. Your app runs in lightweight VMs close to your users.\n\n### Setup\n\n```bash\nfly launch --name my-rust-api\nfly deploy\n```\n\nThat''s it. Fly detects the Dockerfile, builds it, and distributes it across edge regions.\n\n### Scaling\n\nScale to multiple regions with a single command:\n```bash\nfly scale count 3 --region iad,cdg,nrt\n```'
                WHEN 6  THEN E'## SQLx vs Diesel\n\nChoosing between Rust''s two main database libraries? Here''s my take after using both in production.\n\n### SQLx: Compile-Time Checked SQL\n\n```rust\nlet user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", id)\n    .fetch_one(&pool).await?;\n```\n\nPros: raw SQL, async-native, compile-time verification\nCons: no schema DSL, migrations are plain SQL files\n\n### Diesel: Full ORM\n\nPros: type-safe query builder, schema inference\nCons: sync only (needs `spawn_blocking`), steeper learning curve'
                WHEN 7  THEN E'## E2E Testing\n\nPlaywright makes end-to-end testing reliable. Unlike Selenium, it handles modern SPAs with auto-waiting and multi-browser support.\n\n```typescript\ntest("user can log in", async ({ page }) => {\n  await page.goto("/login");\n  await page.fill("[name=email]", "user@test.com");\n  await page.fill("[name=password]", "password");\n  await page.click("button[type=submit]");\n  await expect(page).toHaveURL("/dashboard");\n});\n```\n\n### Running in CI\n\nPlaywright includes a Docker image with all browsers pre-installed.'
                WHEN 8  THEN E'## Rust Lifetimes\n\nLifetimes are Rust''s way of ensuring references are always valid. They look scary at first, but the rules are simple.\n\n### The Core Rule\n\nA reference cannot outlive the data it points to.\n\n```rust\nfn longest<''a>(x: &''a str, y: &''a str) -> &''a str {\n    if x.len() > y.len() { x } else { y }\n}\n```\n\n### When You Need Annotations\n\nMost of the time, the compiler infers lifetimes. You only need explicit annotations when a function returns a reference and the compiler can''t determine which input it came from.'
                WHEN 9  THEN E'## Monolith to Microservices\n\nMigrating a monolith is a marathon, not a sprint. Here are the strategies that worked for us.\n\n### The Strangler Fig Pattern\n\nDon''t rewrite everything at once. Instead:\n1. Identify a bounded context (e.g., "billing")\n2. Build the new service alongside the monolith\n3. Route traffic gradually using a facade\n4. Decommission the old code once traffic is fully migrated\n\n### Common Pitfalls\n\n- **Distributed monolith**: services that must deploy together aren''t microservices\n- **Shared databases**: each service should own its data'
                WHEN 10 THEN E'## WebSocket Updates\n\nAdding real-time features to Next.js requires a separate WebSocket server, since Vercel''s serverless model doesn''t support long-lived connections.\n\n### Architecture\n\n```\nBrowser <--ws--> WS Server <--redis pub/sub--> API Server\n```\n\n### Client Hook\n\n```typescript\nfunction useRealtimeUpdates(channel: string) {\n  const [data, setData] = useState(null);\n  useEffect(() => {\n    const ws = new WebSocket(`wss://ws.example.com/${channel}`);\n    ws.onmessage = (e) => setData(JSON.parse(e.data));\n    return () => ws.close();\n  }, [channel]);\n  return data;\n}\n```'
                WHEN 11 THEN E'## Structured Logging\n\nThe `tracing` crate gives Rust applications structured, context-rich logging that''s far more useful than plain `println!`.\n\n```rust\nuse tracing::{info, instrument};\n\n#[instrument(skip(pool))]\nasync fn get_user(pool: &PgPool, id: Uuid) -> Result<User> {\n    info!("fetching user");\n    // The span automatically includes the `id` parameter\n    sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", id)\n        .fetch_one(pool).await.map_err(Into::into)\n}\n```\n\n### Filtering\n\nUse `RUST_LOG=my_app=debug,tower_http=trace` to control verbosity per crate.'
                WHEN 12 THEN E'## Custom React Hooks\n\nPackaging logic into custom hooks makes components cleaner and logic reusable.\n\n### Example: useLocalStorage\n\n```typescript\nfunction useLocalStorage<T>(key: string, initial: T) {\n  const [value, setValue] = useState<T>(() => {\n    const stored = localStorage.getItem(key);\n    return stored ? JSON.parse(stored) : initial;\n  });\n  useEffect(() => {\n    localStorage.setItem(key, JSON.stringify(value));\n  }, [key, value]);\n  return [value, setValue] as const;\n}\n```\n\n### Publishing\n\nBundle with `tsup`, add a `package.json` with proper `exports`, and publish to npm.'
                ELSE         E'## Container Security\n\nContainers aren''t inherently secure. Here are the practices every developer should follow.\n\n### Use Minimal Base Images\n\n```dockerfile\nFROM rust:1.77 AS builder\nRUN cargo build --release\n\nFROM gcr.io/distroless/cc-debian12\nCOPY --from=builder /app/target/release/server /\nCMD ["/server"]\n```\n\nDistroless images have no shell, no package manager — minimal attack surface.\n\n### Never Run as Root\n\n```dockerfile\nRUN adduser --disabled-password --no-create-home appuser\nUSER appuser\n```'
            END,
            'approved');
        INSERT INTO blogs (content_id, author, published_date, reading_time_minutes, is_featured) VALUES (
            v_tmp_content,
            'John Forja',
            ('2026-01-01'::DATE + (v_i || ' days')::INTERVAL)::DATE,
            (v_i % 15) + 2,
            v_i % 10 = 0
        );
    END LOOP;

    -- ========================================================================
    -- FORMS (2 sample forms — contact + newsletter signup)
    -- ========================================================================
    DECLARE
        v_form_contact UUID;
        v_form_newsletter UUID;
    BEGIN
        -- Form 1: Contact form (text + email + textarea + consent)
        INSERT INTO forms (site_id, name, slug, description, is_active,
                           consent_required, consent_text, bot_protection,
                           storage_mode)
        VALUES (v_site1, 'Contact Us', 'contact',
                'Get in touch with the Forja team.', TRUE,
                TRUE,
                'I agree to be contacted about my inquiry. My data will not be shared with third parties.',
                'none', 'queryable')
        RETURNING id INTO v_form_contact;

        INSERT INTO form_fields (form_id, label, field_type, placeholder, help_text,
                                 validation, is_required, display_order)
        VALUES
            (v_form_contact, 'Name', 'text', 'Jane Doe', NULL,
             '{"min_length":2,"max_length":100}'::jsonb, TRUE, 0),
            (v_form_contact, 'Email', 'email', 'jane@example.com',
             'We''ll only use this to reply to your message.',
             '{}'::jsonb, TRUE, 1),
            (v_form_contact, 'Subject', 'text', 'How can we help?', NULL,
             '{"max_length":200}'::jsonb, FALSE, 2),
            (v_form_contact, 'Message', 'textarea', 'Tell us a bit about what you''re looking for…',
             'Up to 2000 characters.',
             '{"min_length":10,"max_length":2000}'::jsonb, TRUE, 3);

        -- Form 2: Newsletter signup (minimal — just email + consent)
        INSERT INTO forms (site_id, name, slug, description, is_active,
                           consent_required, consent_text, bot_protection,
                           storage_mode)
        VALUES (v_site1, 'Newsletter Signup', 'newsletter',
                'Quarterly update on new features and releases.', TRUE,
                TRUE,
                'I agree to receive the Forja newsletter. I can unsubscribe at any time.',
                'none', 'simple')
        RETURNING id INTO v_form_newsletter;

        INSERT INTO form_fields (form_id, label, field_type, placeholder,
                                 validation, is_required, display_order)
        VALUES
            (v_form_newsletter, 'Email', 'email', 'jane@example.com',
             '{}'::jsonb, TRUE, 0);

        -- ====================================================================
        -- FORM SUBMISSIONS (10 across all 4 statuses for triage-UI testing)
        -- ====================================================================
        -- Contact form: 3 new (recent inquiries), 2 in_review (mid-triage,
        -- with status-log entries), 2 resolved (closed, full transition
        -- history + notes), 1 archived (old, with note). Newsletter: 2 new.
        -- Reference codes are deterministic placeholders against the
        -- ABCDEFGHJKLMNPQRSTUVWXYZ23456789 alphabet (no I/O/0/1).
        DECLARE
            v_sub_new1     UUID := gen_random_uuid();
            v_sub_new2     UUID := gen_random_uuid();
            v_sub_new3     UUID := gen_random_uuid();
            v_sub_review1  UUID := gen_random_uuid();
            v_sub_review2  UUID := gen_random_uuid();
            v_sub_resolv1  UUID := gen_random_uuid();
            v_sub_resolv2  UUID := gen_random_uuid();
            v_sub_arch1    UUID := gen_random_uuid();
            v_sub_news1    UUID := gen_random_uuid();
            v_sub_news2    UUID := gen_random_uuid();
            v_admin        TEXT := 'user_demo_admin_clerk_id';
            v_consent_contact TEXT := 'I agree to be contacted about my inquiry. My data will not be shared with third parties.';
            v_consent_news    TEXT := 'I agree to receive the Forja newsletter. I can unsubscribe at any time.';
        BEGIN
            -- ── 'new' (3 unread inquiries, 1–5 days old) ────────────────────
            INSERT INTO form_submissions
                (id, form_id, reference_code, data, consent_given,
                 consent_text_at_submission, status, created_at, updated_at)
            VALUES
                (v_sub_new1, v_form_contact, 'ABCD-EFGH-JKLM',
                 jsonb_build_object(
                    'Name',    'Sarah Mueller',
                    'Email',   'sarah.mueller@beispiel.de',
                    'Subject', 'Multi-site setup for our agency',
                    'Message', 'Hi! We run 12 client sites and are evaluating Forja. Could we set up a 30-min call to walk through the multi-site features?'),
                 TRUE, v_consent_contact, 'new',
                 NOW() - INTERVAL '1 day 4 hours', NOW() - INTERVAL '1 day 4 hours'),
                (v_sub_new2, v_form_contact, 'BCDE-FGHJ-KLMN',
                 jsonb_build_object(
                    'Name',    'Tomáš Novák',
                    'Email',   't.novak@example.cz',
                    'Subject', 'Self-hosting on Hetzner',
                    'Message', 'Looking at deploying Forja on a Hetzner VPS. Any docs on the production install? Also curious about the Rust binary size and memory footprint.'),
                 TRUE, v_consent_contact, 'new',
                 NOW() - INTERVAL '2 days 11 hours', NOW() - INTERVAL '2 days 11 hours'),
                (v_sub_new3, v_form_contact, 'CDEF-GHJK-LMNP',
                 jsonb_build_object(
                    'Name',    'Aiko Tanaka',
                    'Email',   'aiko@designstudio.example',
                    'Subject', '',
                    'Message', 'Does Forja support custom field types? We need a colour-picker field for our marketing landing pages.'),
                 TRUE, v_consent_contact, 'new',
                 NOW() - INTERVAL '5 days 2 hours', NOW() - INTERVAL '5 days 2 hours');

            -- ── 'in_review' (2 mid-triage, 6–10 days old, with log) ─────────
            INSERT INTO form_submissions
                (id, form_id, reference_code, data, consent_given,
                 consent_text_at_submission, status, created_at, updated_at)
            VALUES
                (v_sub_review1, v_form_contact, 'DEFG-HJKL-MNPQ',
                 jsonb_build_object(
                    'Name',    'Marek Wójcik',
                    'Email',   'marek@studio.pl',
                    'Subject', 'GDPR / consent audit',
                    'Message', 'Our compliance team needs documentation on how Forja handles consent capture and the analytics visitor-hash design. Could you point me to the right resources?'),
                 TRUE, v_consent_contact, 'in_review',
                 NOW() - INTERVAL '7 days', NOW() - INTERVAL '3 days'),
                (v_sub_review2, v_form_contact, 'EFGH-JKLM-NPQR',
                 jsonb_build_object(
                    'Name',    'Elena García',
                    'Email',   'elena@cooperativa.example',
                    'Subject', 'Pricing for non-profits',
                    'Message', 'We''re a small worker co-op running 3 sites. Is there a non-profit / co-op pricing tier? Happy to share more context if useful.'),
                 TRUE, v_consent_contact, 'in_review',
                 NOW() - INTERVAL '10 days', NOW() - INTERVAL '4 days');

            INSERT INTO form_submission_status_log
                (submission_id, from_status, to_status, changed_by, created_at)
            VALUES
                (v_sub_review1, 'new', 'in_review', v_admin, NOW() - INTERVAL '3 days'),
                (v_sub_review2, 'new', 'in_review', v_admin, NOW() - INTERVAL '4 days');

            -- ── 'resolved' (2 closed, 14–21 days old, full history) ─────────
            INSERT INTO form_submissions
                (id, form_id, reference_code, data, consent_given,
                 consent_text_at_submission, status, created_at, updated_at)
            VALUES
                (v_sub_resolv1, v_form_contact, 'FGHJ-KLMN-PQRS',
                 jsonb_build_object(
                    'Name',    'Lukas Bauer',
                    'Email',   'lukas.bauer@kanzlei.example.at',
                    'Subject', 'Imprint / legal page templates',
                    'Message', 'Looking for an Austrian-law-compliant imprint template. Does Forja ship one out of the box?'),
                 TRUE, v_consent_contact, 'resolved',
                 NOW() - INTERVAL '14 days', NOW() - INTERVAL '11 days'),
                (v_sub_resolv2, v_form_contact, 'GHJK-LMNP-QRST',
                 jsonb_build_object(
                    'Name',    'Priya Shah',
                    'Email',   'priya@example.com',
                    'Subject', 'Webhook delivery retries',
                    'Message', 'How does Forja handle webhook delivery to a flaky endpoint? Is the retry curve configurable per webhook?'),
                 TRUE, v_consent_contact, 'resolved',
                 NOW() - INTERVAL '21 days', NOW() - INTERVAL '18 days');

            INSERT INTO form_submission_status_log
                (submission_id, from_status, to_status, changed_by, created_at)
            VALUES
                (v_sub_resolv1, 'new',       'in_review', v_admin, NOW() - INTERVAL '13 days'),
                (v_sub_resolv1, 'in_review', 'resolved',  v_admin, NOW() - INTERVAL '11 days'),
                (v_sub_resolv2, 'new',       'in_review', v_admin, NOW() - INTERVAL '20 days'),
                (v_sub_resolv2, 'in_review', 'resolved',  v_admin, NOW() - INTERVAL '18 days');

            INSERT INTO submission_notes (submission_id, author_id, body, created_at)
            VALUES
                (v_sub_resolv1, v_admin,
                 'Replied with the legal/imprint template doc — confirmed it covers AT § 5 ECG requirements.',
                 NOW() - INTERVAL '11 days'),
                (v_sub_resolv2, v_admin,
                 'Pointed Priya at the webhook_retry_worker config (3 retries, exponential backoff). She''s evaluating.',
                 NOW() - INTERVAL '19 days'),
                (v_sub_resolv2, v_admin,
                 'Closed — confirmed retry behaviour matched her expectations.',
                 NOW() - INTERVAL '18 days');

            -- ── 'archived' (1 old, 30 days, with note) ──────────────────────
            INSERT INTO form_submissions
                (id, form_id, reference_code, data, consent_given,
                 consent_text_at_submission, status, created_at, updated_at)
            VALUES
                (v_sub_arch1, v_form_contact, 'HJKL-MNPQ-RSTU',
                 jsonb_build_object(
                    'Name',    'Generic Outreach Bot',
                    'Email',   'sales-pitch@cold-outreach.example',
                    'Subject', 'Exclusive partnership opportunity',
                    'Message', 'We''re reaching out to discuss a strategic partnership that could 10x your reach…'),
                 TRUE, v_consent_contact, 'archived',
                 NOW() - INTERVAL '32 days', NOW() - INTERVAL '30 days');

            INSERT INTO form_submission_status_log
                (submission_id, from_status, to_status, changed_by, created_at)
            VALUES
                (v_sub_arch1, 'new', 'archived', v_admin, NOW() - INTERVAL '30 days');

            INSERT INTO submission_notes (submission_id, author_id, body, created_at)
            VALUES
                (v_sub_arch1, v_admin,
                 'Cold-outreach spam — archiving without reply.',
                 NOW() - INTERVAL '30 days');

            -- ── Newsletter signups (2 'new', last week) ─────────────────────
            INSERT INTO form_submissions
                (id, form_id, reference_code, data, consent_given,
                 consent_text_at_submission, status, created_at, updated_at)
            VALUES
                (v_sub_news1, v_form_newsletter, 'JKLM-NPQR-STUV',
                 jsonb_build_object('Email', 'newsubscriber@example.com'),
                 TRUE, v_consent_news, 'new',
                 NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
                (v_sub_news2, v_form_newsletter, 'KLMN-PQRS-TUVW',
                 jsonb_build_object('Email', 'reader@example.org'),
                 TRUE, v_consent_news, 'new',
                 NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days');
        END;
    END;

    -- ========================================================================
    -- ANALYTICS (90 days of synthetic raw pageviews)
    -- ========================================================================
    -- The dashboard's "Trend" chart and "Top Content" table both query
    -- `analytics_pageviews` directly (NOT the aggregated
    -- `analytics_daily_stats`). Generate raw events with realistic shape:
    --
    --   - Weekday baseline ~280 views/day, weekend dip to ~60%
    --   - Deterministic per-date noise (±25%) so days vary visibly
    --   - Three "viral spike" days where a single blog post pops (+150%)
    --   - Path-weighted: home 35%, /blog 22%, two top posts 12%/9%,
    --     /about 8%, /portfolio 7%, /blog/* trickle 7%
    --   - Time-of-day distribution: peak around 10:00 / 16:00 UTC
    --   - Visitor hashes: 60% repeat-visit pattern (some hashes reused
    --     within a session window) — same visitor ratio as prod analytics
    --   - Referrer mix: ~55% direct (NULL), 18% google, 9% github,
    --     8% news.ycombinator, 5% twitter, 5% reddit
    --
    -- Deterministic via setseed() at the start so the same date range
    -- produces the same charts across re-seeds.
    DECLARE
        v_day_offset    INTEGER;
        v_date          DATE;
        v_is_weekend    BOOLEAN;
        v_day_factor    NUMERIC;
        v_noise         NUMERIC;
        v_is_spike_day  BOOLEAN;
        v_spike_path    TEXT;
        v_events_today  INTEGER;
        v_path          TEXT;
        v_visitor_hash  TEXT;
        v_referrer      TEXT;
        v_hour          INTEGER;
        v_minute        INTEGER;
        v_rand          NUMERIC;
        v_paths         TEXT[] := ARRAY[
            '/',
            '/blog',
            '/blog/why-forja-exists',
            '/blog/multi-site-architecture',
            '/about',
            '/portfolio',
            '/blog/the-privacy-first-cms-thesis'
        ];
        v_cumweights    NUMERIC[] := ARRAY[0.35, 0.57, 0.69, 0.78, 0.86, 0.93, 1.00];
        v_referrers     TEXT[] := ARRAY[NULL, 'google.com', 'github.com',
                                        'news.ycombinator.com', 'twitter.com', 'reddit.com'];
        v_ref_cum       NUMERIC[] := ARRAY[0.55, 0.73, 0.82, 0.90, 0.95, 1.00];
        v_path_idx      INTEGER;
        v_ref_idx       INTEGER;
    BEGIN
        -- Deterministic randomness — fixed seed gives the same charts on
        -- every re-seed (modulo the date roll-forward).
        PERFORM setseed(0.42);

        -- "Viral" spike days: pick 3 dates in the 90-day window where one
        -- blog post pops (referrals from HN / reddit, +150% traffic).
        FOR v_day_offset IN 0..89 LOOP
            v_date := CURRENT_DATE - v_day_offset;
            v_is_weekend := EXTRACT(DOW FROM v_date) IN (0, 6);
            v_is_spike_day := v_day_offset IN (12, 47, 71);
            v_spike_path := CASE v_day_offset
                WHEN 12 THEN '/blog/why-forja-exists'
                WHEN 47 THEN '/blog/multi-site-architecture'
                WHEN 71 THEN '/blog/the-privacy-first-cms-thesis'
                ELSE NULL
            END;

            -- Day factor: weekday 1.0, weekend 0.6, ±20% deterministic noise.
            -- `abs(hashtext())` keeps the mod positive — PostgreSQL's `%`
            -- preserves the sign of the dividend, so a negative
            -- hashtext() can otherwise produce a negative remainder and
            -- push the factor below zero (floored to the minimum).
            v_day_factor := CASE WHEN v_is_weekend THEN 0.6 ELSE 1.0 END;
            v_noise := ((abs(hashtext(v_date::text))::bigint % 41) - 20) / 100.0;
            v_day_factor := v_day_factor + v_noise;
            IF v_is_spike_day THEN
                v_day_factor := v_day_factor * 2.5;
            END IF;

            -- ~280 events/day on a peak weekday. Floor of 60 prevents
            -- the chart from showing flat zero-runs on negative-noise
            -- weekend days while keeping the weekend dip visible.
            v_events_today := GREATEST(60, (280 * v_day_factor)::INTEGER);

            FOR v_i IN 1..v_events_today LOOP
                -- Pick path via cumulative weights
                v_rand := random();
                IF v_is_spike_day AND v_rand < 0.45 THEN
                    -- On a spike day, ~45% of traffic goes to the spike post
                    v_path := v_spike_path;
                ELSE
                    FOR v_path_idx IN 1..array_length(v_paths, 1) LOOP
                        IF v_rand <= v_cumweights[v_path_idx] THEN
                            v_path := v_paths[v_path_idx];
                            EXIT;
                        END IF;
                    END LOOP;
                END IF;

                -- Pick referrer via cumulative weights, biased to HN/reddit
                -- on spike days
                v_rand := random();
                IF v_is_spike_day THEN
                    v_referrer := CASE
                        WHEN v_rand < 0.5 THEN 'news.ycombinator.com'
                        WHEN v_rand < 0.75 THEN 'reddit.com'
                        WHEN v_rand < 0.85 THEN 'twitter.com'
                        ELSE NULL
                    END;
                ELSE
                    FOR v_ref_idx IN 1..array_length(v_referrers, 1) LOOP
                        IF v_rand <= v_ref_cum[v_ref_idx] THEN
                            v_referrer := v_referrers[v_ref_idx];
                            EXIT;
                        END IF;
                    END LOOP;
                END IF;

                -- Visitor hash: 60% chance of being a "fresh" visitor,
                -- 40% chance of being a returning one (picks from a pool
                -- of 40 per day). Gives ~65% unique-visitor ratio.
                IF random() < 0.6 THEN
                    v_visitor_hash := substr(md5(v_date::text || v_path || v_i::text || random()::text), 1, 16);
                ELSE
                    v_visitor_hash := substr(md5(v_date::text || (v_i % 40)::text), 1, 16);
                END IF;

                -- Time of day: bimodal around 10:00 and 16:00 UTC
                v_rand := random();
                IF v_rand < 0.5 THEN
                    v_hour := 8 + (random() * 4)::INTEGER;   -- 8-12
                ELSE
                    v_hour := 14 + (random() * 5)::INTEGER;  -- 14-19
                END IF;
                v_minute := (random() * 60)::INTEGER;

                INSERT INTO analytics_pageviews (site_id, path, referrer_domain, visitor_hash, created_at)
                VALUES (
                    v_site1,
                    v_path,
                    v_referrer,
                    v_visitor_hash,
                    v_date + (v_hour * INTERVAL '1 hour') + (v_minute * INTERVAL '1 minute')
                );
            END LOOP;
        END LOOP;

        -- Also populate analytics_daily_stats with the same shape, so any
        -- code path that reads the aggregated table sees consistent
        -- numbers. The usage-aggregation worker would do this in prod;
        -- for the demo we pre-aggregate from the raw events just inserted.
        INSERT INTO analytics_daily_stats (site_id, path, date, view_count, unique_visitors)
        SELECT
            site_id,
            path,
            created_at::DATE AS date,
            COUNT(*) AS view_count,
            COUNT(DISTINCT visitor_hash) AS unique_visitors
        FROM analytics_pageviews
        WHERE site_id = v_site1
        GROUP BY site_id, path, created_at::DATE
        ON CONFLICT (site_id, path, date) DO UPDATE
            SET view_count = EXCLUDED.view_count,
                unique_visitors = EXCLUDED.unique_visitors;
    END;

    RAISE NOTICE 'Demo seed complete (v%) — 1 site (john-forja), 36 blogs (8 hand-crafted + 28 bulk), 3 pages, 3 CV entries, 4 legal docs, 39 tags, 30 categories, 35 skills, 43 media, 33 documents, 3 social links, 8 nav items, 2 webhooks, 3 redirects, 3 notifications, 2 media folders, 2 doc folders, 2 forms (contact + newsletter), 10 form submissions (3 new / 2 in_review / 2 resolved / 1 archived + 2 newsletter), 90 days of analytics.', v_seed_version;
EXCEPTION
    -- Catch *any* error inside the seed body. PL/pgSQL exception handlers
    -- run inside an implicit savepoint — when this fires, every change
    -- since the `BEGIN` at the top of this DO block is rolled back, and
    -- the outer SQL transaction remains in a valid state. Without this,
    -- a failure (e.g. duplicate-key violation on re-seed if a prior run
    -- left orphan rows) propagates out of the DO block, marks the outer
    -- transaction as aborted, and poisons the connection — every
    -- subsequent acquirer of that connection from the sqlx pool then
    -- sees `current transaction is aborted, commands ignored until end
    -- of transaction block` until the connection ages out. The seed is
    -- best-effort by design; logging + clean failure is the right shape.
    WHEN OTHERS THEN
        RAISE WARNING 'Demo seed failed (rolled back): % %', SQLSTATE, SQLERRM;
END $$;

COMMIT;
