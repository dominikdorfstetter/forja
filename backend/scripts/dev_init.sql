-- ============================================================================
-- Development Seed Script
-- ============================================================================
-- Cleans all data and inserts a rich dev dataset for 2 sites.
--
-- Usage:
--   psql -U openyapper -d openyapper -f backend/scripts/dev_init.sql
--
-- IMPORTANT: DO NOT use in production. Contains known API key values.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CLEAN ALL DATA (respects FK order via CASCADE)
-- ============================================================================

TRUNCATE
    api_key_ip_rules,
    api_key_usage_daily,
    api_key_usage,
    api_keys,
    audit_logs,
    change_history,
    content_tags,
    content_categories,
    blog_documents,
    blog_attachments,
    blog_links,
    blog_photos,
    blogs,
    redirects,
    webhook_deliveries,
    webhooks,
    notifications,
    document_localizations,
    documents,
    document_folders,
    page_section_localizations,
    page_sections,
    pages,
    cv_entry_skills,
    cv_entry_localizations,
    cv_entries,
    legal_item_localizations,
    legal_items,
    legal_group_localizations,
    legal_groups,
    legal_document_localizations,
    legal_documents,
    navigation_item_localizations,
    navigation_items,
    navigation_menu_localizations,
    navigation_menus,
    social_links,
    tag_localizations,
    tag_sites,
    tags,
    category_localizations,
    category_sites,
    categories,
    skill_localizations,
    skill_sites,
    skills,
    content_blocks,
    content_localizations,
    content_versions,
    content_sites,
    contents,
    media_metadata,
    media_variants,
    media_sites,
    media_folders,
    media_files,
    site_memberships,
    system_admins,
    site_settings,
    site_locales,
    site_domains,
    sites
CASCADE;

-- Environments, locales, entity_types are seeded by migrations — leave them.

-- ============================================================================
-- 2. MAIN SEED BLOCK
-- ============================================================================

DO $$
DECLARE
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

    -- Sites
    v_site1      UUID;  -- Personal portfolio
    v_site2      UUID;  -- Tech magazine

    -- User placeholders (fake UUIDs for orphaned created_by/uploaded_by columns)
    v_user_admin UUID;
    v_user_editor UUID;

    -- Media
    v_media_avatar     UUID;
    v_media_hero       UUID;
    v_media_blog1_cover UUID;
    v_media_blog2_cover UUID;
    v_media_blog3_cover UUID;
    v_media_blog4_cover UUID;
    v_media_logo1      UUID;
    v_media_logo2      UUID;
    v_media_blog5_cover UUID;
    v_media_blog6_cover UUID;
    v_media_blog7_cover UUID;
    v_media_blog8_cover UUID;

    -- Content IDs
    v_content_blog1    UUID;
    v_content_blog2    UUID;
    v_content_blog3    UUID;
    v_content_blog4    UUID;
    v_content_blog5    UUID;
    v_content_blog6    UUID;
    v_content_blog7    UUID;
    v_content_blog8    UUID;
    v_content_page_home1 UUID;
    v_content_page_about1 UUID;
    v_content_page_contact1 UUID;
    v_content_page_home2 UUID;
    v_content_page_blog_idx2 UUID;
    v_content_cv1      UUID;
    v_content_cv2      UUID;
    v_content_cv3      UUID;
    v_content_cv4      UUID;
    v_content_legal_cookie1 UUID;
    v_content_legal_privacy1 UUID;
    v_content_legal_cookie2 UUID;

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
    v_page_home1    UUID;
    v_page_about1   UUID;
    v_page_contact1 UUID;
    v_page_home2    UUID;
    v_page_blog_idx2 UUID;

    -- CV Entry IDs
    v_cv1 UUID;
    v_cv2 UUID;
    v_cv3 UUID;
    v_cv4 UUID;

    -- Legal IDs
    v_legal_cookie1  UUID;
    v_legal_privacy1 UUID;
    v_legal_cookie2  UUID;

    -- Content localization IDs (needed for content_blocks FK)
    v_cl_blog1_en UUID;
    v_cl_blog1_de UUID;
    v_cl_blog2_en UUID;
    v_cl_blog3_en UUID;
    v_cl_blog3_de UUID;
    v_cl_blog4_en UUID;
    v_cl_blog5_en UUID;
    v_cl_blog6_en UUID;
    v_cl_blog7_en UUID;
    v_cl_blog8_en UUID;
    v_cl_home1_en UUID;
    v_cl_home1_de UUID;
    v_cl_about1_en UUID;
    v_cl_about1_de UUID;
    v_cl_contact1_en UUID;
    v_cl_home2_en UUID;
    v_cl_blog_idx2_en UUID;

    -- Tags
    v_tag_rust UUID;
    v_tag_wasm UUID;
    v_tag_react UUID;
    v_tag_typescript UUID;
    v_tag_devops UUID;
    v_tag_ai UUID;
    v_tag_tutorial UUID;

    -- Categories
    v_cat_engineering UUID;
    v_cat_backend UUID;
    v_cat_frontend UUID;
    v_cat_opinions UUID;

    -- Skills
    v_skill_rust UUID;
    v_skill_ts UUID;
    v_skill_react UUID;
    v_skill_postgres UUID;
    v_skill_docker UUID;
    v_skill_aws UUID;
    v_skill_go UUID;

    -- Navigation Menus
    v_menu_primary1 UUID;
    v_menu_footer1 UUID;
    v_menu_primary2 UUID;

    -- Navigation Items
    v_nav_home1 UUID;
    v_nav_about1 UUID;
    v_nav_blog1 UUID;
    v_nav_contact1 UUID;
    v_nav_home2 UUID;
    v_nav_articles2 UUID;

    -- Page sections
    v_section_hero1   UUID;
    v_section_feat1   UUID;
    v_section_cta1    UUID;
    v_section_hero2   UUID;

    -- Legal groups / items
    v_lg_essential1 UUID;
    v_lg_analytics1 UUID;
    v_li_session1   UUID;
    v_li_ga1        UUID;
    v_lg_essential2 UUID;
    v_li_session2   UUID;

    -- Document folders
    v_doc_folder_guides1 UUID;
    v_doc_folder_specs1  UUID;

    -- Documents
    v_doc_rust_guide1   UUID;
    v_doc_wasm_spec1    UUID;
    v_doc_docker_cheat1 UUID;
    v_doc_sample_upload UUID;

    -- Media folders
    v_mfolder_covers1   UUID;
    v_mfolder_logos1    UUID;

    -- Webhook IDs
    v_webhook1 UUID;
    v_webhook2 UUID;
    v_webhook3 UUID;

    -- Bulk generation loop variables
    v_i                 INTEGER;
    v_tmp_content       UUID;
    v_tmp_id            UUID;
BEGIN

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

    -- ========================================================================
    -- SITES
    -- ========================================================================
    INSERT INTO sites (name, slug, description, default_locale_id, timezone, theme)
    VALUES (
        'John Doe', 'john-doe',
        'Personal portfolio, blog, and CV of John Doe — full-stack engineer from Vienna.',
        v_locale_en, 'Europe/Vienna',
        '{"primaryColor":"#2563eb","fontFamily":"Inter","mode":"dark"}'::jsonb
    ) RETURNING id INTO v_site1;

    INSERT INTO sites (name, slug, description, default_locale_id, timezone, theme)
    VALUES (
        'TechBites', 'techbites',
        'A snappy tech magazine covering engineering, DevOps, and frontend craft.',
        v_locale_en, 'UTC',
        '{"primaryColor":"#f97316","fontFamily":"JetBrains Mono","mode":"light"}'::jsonb
    ) RETURNING id INTO v_site2;

    -- Site domains
    INSERT INTO site_domains (site_id, domain, is_primary, environment) VALUES
        (v_site1, 'localhost:3000',            TRUE,  'development'),
        (v_site1, 'johndoe.dev',               TRUE,  'production'),
        (v_site2, 'localhost:3001',            TRUE,  'development'),
        (v_site2, 'techbites.io',              TRUE,  'production');

    -- Site locales
    INSERT INTO site_locales (site_id, locale_id, is_default, is_active, url_prefix) VALUES
        (v_site1, v_locale_en, TRUE,  TRUE, NULL),
        (v_site1, v_locale_de, FALSE, TRUE, 'de'),
        (v_site2, v_locale_en, TRUE,  TRUE, NULL),
        (v_site2, v_locale_es, FALSE, TRUE, 'es');

    -- Site settings
    INSERT INTO site_settings (site_id, setting_key, setting_value, is_sensitive) VALUES
        (v_site1, 'analytics_enabled',        'false'::jsonb,   FALSE),
        (v_site1, 'maintenance_mode',         'false'::jsonb,   FALSE),
        (v_site1, 'contact_email',            '"john@johndoe.dev"'::jsonb, FALSE),
        (v_site1, 'max_document_file_size',   '10485760'::jsonb, FALSE),
        (v_site1, 'max_media_file_size',      '52428800'::jsonb, FALSE),
        (v_site1, 'posts_per_page',           '10'::jsonb,      FALSE),
        (v_site2, 'analytics_enabled',        'true'::jsonb,    FALSE),
        (v_site2, 'posts_per_page',           '12'::jsonb,      FALSE),
        (v_site2, 'max_document_file_size',   '10485760'::jsonb, FALSE),
        (v_site2, 'max_media_file_size',      '52428800'::jsonb, FALSE);

    -- ========================================================================
    -- USERS (Clerk-based — fake UUIDs for created_by/uploaded_by columns)
    -- ========================================================================
    -- These UUIDs are deterministic placeholders for the orphaned created_by / uploaded_by
    -- columns that no longer have FK constraints (users table was dropped in migration 20).
    v_user_admin  := 'a0000000-0000-4000-8000-000000000001'::UUID;
    v_user_editor := 'a0000000-0000-4000-8000-000000000002'::UUID;

    -- System admin (Clerk user ID)
    INSERT INTO system_admins (clerk_user_id, granted_by) VALUES
        ('user_admin_clerk_id', NULL);

    -- Site memberships
    INSERT INTO site_memberships (clerk_user_id, site_id, role) VALUES
        ('user_admin_clerk_id',  v_site1, 'owner'),
        ('user_admin_clerk_id',  v_site2, 'admin'),
        ('user_editor_clerk_id', v_site2, 'editor');

    -- ========================================================================
    -- API KEYS
    -- ========================================================================
    -- Master key (scoped to site1): dk_devmast_00000000000000000000000000000000
    INSERT INTO api_keys (key_hash, key_prefix, name, description, permission, site_id, status,
        rate_limit_per_second, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day, user_id)
    VALUES (
        '2eb709dea8a8aae6af774a3fc19d52cad9436d0e79dce5a05f038658c1ab51f6',
        'dk_devmast', 'Dev Master Key', 'Full access — DO NOT USE IN PRODUCTION',
        'master', v_site1, 'active', 1000, 10000, 100000, 1000000, v_user_admin
    );

    -- Read key (scoped to site1): dk_devread_00000000000000000000000000000000
    INSERT INTO api_keys (key_hash, key_prefix, name, description, permission, site_id, status,
        rate_limit_per_second, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day)
    VALUES (
        'ad4cc042d4f77aaf1a9de399675d2cfb76999bba21754ef6861391ef835f1676',
        'dk_devread', 'Dev Read Key', 'Read-only for site1', 'read', v_site1, 'active',
        100, 1000, 10000, 100000
    );

    -- Write key (scoped to site2):
    INSERT INTO api_keys (key_hash, key_prefix, name, description, permission, site_id, status,
        rate_limit_per_second, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day)
    VALUES (
        'e186e80a3198eda56bfe629ef151373d4567088dac5762a5dfe5f7d4513c8437',
        'dk_devwrit', 'Dev Write Key', 'Write access for site2', 'write', v_site2, 'active',
        50, 500, 5000, 50000
    );

    -- ========================================================================
    -- MEDIA FILES (placeholders — no real binaries needed)
    -- ========================================================================
    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('avatar.webp','avatar.webp','image/webp',48000,'local','/media/avatar.webp','https://placehold.co/400x400/2563eb/white?text=JD',400,400,v_user_admin,v_env_dev,FALSE)
    RETURNING id INTO v_media_avatar;

    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('hero-bg.webp','hero-bg.webp','image/webp',320000,'local','/media/hero-bg.webp','https://placehold.co/1920x600/1e293b/white?text=Hero',1920,600,v_user_admin,v_env_dev,FALSE)
    RETURNING id INTO v_media_hero;

    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('rust-wasm.webp','rust-wasm.webp','image/webp',210000,'local','/media/rust-wasm.webp','https://placehold.co/800x450/b45309/white?text=Rust+WASM',800,450,v_user_admin,v_env_dev,FALSE)
    RETURNING id INTO v_media_blog1_cover;

    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('nextjs-isr.webp','nextjs-isr.webp','image/webp',195000,'local','/media/nextjs-isr.webp','https://placehold.co/800x450/0ea5e9/white?text=Next.js+ISR',800,450,v_user_admin,v_env_dev,FALSE)
    RETURNING id INTO v_media_blog2_cover;

    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('docker-compose.webp','docker-compose.webp','image/webp',185000,'local','/media/docker-compose.webp','https://placehold.co/800x450/059669/white?text=Docker',800,450,v_user_admin,v_env_dev,FALSE)
    RETURNING id INTO v_media_blog3_cover;

    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('ai-code-review.webp','ai-code-review.webp','image/webp',220000,'local','/media/ai-code-review.webp','https://placehold.co/800x450/7c3aed/white?text=AI+Code',800,450,v_user_editor,v_env_dev,FALSE)
    RETURNING id INTO v_media_blog4_cover;

    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('logo-jd.svg','logo-jd.svg','image/svg+xml',3200,'local','/media/logo-jd.svg','https://placehold.co/200x60/2563eb/white?text=JD',200,60,v_user_admin,v_env_dev,FALSE)
    RETURNING id INTO v_media_logo1;

    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('rust-zero-cost.webp','rust-zero-cost.webp','image/webp',198000,'local','/media/rust-zero-cost.webp','https://placehold.co/800x450/dc2626/white?text=Zero+Cost',800,450,v_user_admin,v_env_dev,FALSE)
    RETURNING id INTO v_media_blog5_cover;

    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('multi-tenant-db.webp','multi-tenant-db.webp','image/webp',205000,'local','/media/multi-tenant-db.webp','https://placehold.co/800x450/0891b2/white?text=Multi+Tenant',800,450,v_user_admin,v_env_dev,FALSE)
    RETURNING id INTO v_media_blog6_cover;

    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('edge-computing.webp','edge-computing.webp','image/webp',215000,'local','/media/edge-computing.webp','https://placehold.co/800x450/6366f1/white?text=Edge+Computing',800,450,v_user_admin,v_env_dev,FALSE)
    RETURNING id INTO v_media_blog7_cover;

    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('graphql-federation.webp','graphql-federation.webp','image/webp',192000,'local','/media/graphql-federation.webp','https://placehold.co/800x450/e11d48/white?text=GraphQL+Fed',800,450,v_user_admin,v_env_dev,FALSE)
    RETURNING id INTO v_media_blog8_cover;

    INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_provider, storage_path, public_url, width, height, uploaded_by, environment_id, is_global)
    VALUES ('logo-tb.svg','logo-tb.svg','image/svg+xml',2800,'local','/media/logo-tb.svg','https://placehold.co/200x60/f97316/white?text=TB',200,60,v_user_editor,v_env_dev,FALSE)
    RETURNING id INTO v_media_logo2;

    -- Media ↔ Site links
    INSERT INTO media_sites (media_file_id, site_id) VALUES
        (v_media_avatar,      v_site1),
        (v_media_hero,        v_site1),
        (v_media_blog1_cover, v_site1),
        (v_media_blog2_cover, v_site1),
        (v_media_blog3_cover, v_site2),
        (v_media_blog4_cover, v_site2),
        (v_media_blog5_cover, v_site1),
        (v_media_blog6_cover, v_site1),
        (v_media_blog7_cover, v_site1),
        (v_media_blog8_cover, v_site2),
        (v_media_logo1,       v_site1),
        (v_media_logo2,       v_site2);

    -- Media metadata (alt texts)
    INSERT INTO media_metadata (media_file_id, locale_id, alt_text, title) VALUES
        (v_media_avatar,      v_locale_en, 'John Doe portrait',   'Avatar'),
        (v_media_hero,        v_locale_en, 'Abstract hero background',       'Hero'),
        (v_media_blog1_cover, v_locale_en, 'Rust and WebAssembly logos',     'Rust + WASM'),
        (v_media_blog2_cover, v_locale_en, 'Next.js incremental builds',    'Next.js ISR'),
        (v_media_blog3_cover, v_locale_en, 'Docker containers illustration', 'Docker Compose'),
        (v_media_blog4_cover, v_locale_en, 'AI reviewing source code',      'AI Code Review'),
        (v_media_blog5_cover, v_locale_en, 'Rust zero-cost abstractions',   'Zero-Cost Abstractions'),
        (v_media_blog6_cover, v_locale_en, 'Multi-tenant database schema',  'Multi-Tenant DB'),
        (v_media_blog7_cover, v_locale_en, 'Edge computing network diagram', 'Edge Computing'),
        (v_media_blog8_cover, v_locale_en, 'GraphQL federation architecture', 'GraphQL Federation');

    -- Update site logos
    UPDATE sites SET logo_url = 'https://placehold.co/200x60/2563eb/white?text=JD', favicon_url = 'https://placehold.co/32x32/2563eb/white?text=J' WHERE id = v_site1;
    UPDATE sites SET logo_url = 'https://placehold.co/200x60/f97316/white?text=TB', favicon_url = 'https://placehold.co/32x32/f97316/white?text=T' WHERE id = v_site2;

    -- ========================================================================
    -- TAXONOMY — Tags
    -- ========================================================================
    INSERT INTO tags (slug, is_global) VALUES ('rust',       FALSE) RETURNING id INTO v_tag_rust;
    INSERT INTO tags (slug, is_global) VALUES ('wasm',       FALSE) RETURNING id INTO v_tag_wasm;
    INSERT INTO tags (slug, is_global) VALUES ('react',      FALSE) RETURNING id INTO v_tag_react;
    INSERT INTO tags (slug, is_global) VALUES ('typescript', FALSE) RETURNING id INTO v_tag_typescript;
    INSERT INTO tags (slug, is_global) VALUES ('devops',     FALSE) RETURNING id INTO v_tag_devops;
    INSERT INTO tags (slug, is_global) VALUES ('ai',         FALSE) RETURNING id INTO v_tag_ai;
    INSERT INTO tags (slug, is_global) VALUES ('tutorial',   TRUE)  RETURNING id INTO v_tag_tutorial;

    INSERT INTO tag_sites (tag_id, site_id) VALUES
        (v_tag_rust,       v_site1), (v_tag_wasm,       v_site1),
        (v_tag_react,      v_site1), (v_tag_typescript,  v_site1),
        (v_tag_devops,     v_site2), (v_tag_ai,          v_site2),
        (v_tag_tutorial,   v_site1), (v_tag_tutorial,    v_site2);

    INSERT INTO tag_localizations (tag_id, locale_id, name) VALUES
        (v_tag_rust,       v_locale_en, 'Rust'),
        (v_tag_rust,       v_locale_de, 'Rust'),
        (v_tag_wasm,       v_locale_en, 'WebAssembly'),
        (v_tag_wasm,       v_locale_de, 'WebAssembly'),
        (v_tag_react,      v_locale_en, 'React'),
        (v_tag_typescript, v_locale_en, 'TypeScript'),
        (v_tag_devops,     v_locale_en, 'DevOps'),
        (v_tag_ai,         v_locale_en, 'Artificial Intelligence'),
        (v_tag_ai,         v_locale_de, 'Künstliche Intelligenz'),
        (v_tag_tutorial,   v_locale_en, 'Tutorial'),
        (v_tag_tutorial,   v_locale_de, 'Anleitung');

    -- ========================================================================
    -- TAXONOMY — Categories
    -- ========================================================================
    INSERT INTO categories (slug, is_global) VALUES ('engineering', FALSE) RETURNING id INTO v_cat_engineering;
    INSERT INTO categories (parent_id, slug) VALUES (v_cat_engineering, 'backend')  RETURNING id INTO v_cat_backend;
    INSERT INTO categories (parent_id, slug) VALUES (v_cat_engineering, 'frontend') RETURNING id INTO v_cat_frontend;
    INSERT INTO categories (slug, is_global) VALUES ('opinions', FALSE) RETURNING id INTO v_cat_opinions;

    INSERT INTO category_sites (category_id, site_id) VALUES
        (v_cat_engineering, v_site1), (v_cat_engineering, v_site2),
        (v_cat_backend,     v_site1), (v_cat_backend,     v_site2),
        (v_cat_frontend,    v_site1), (v_cat_frontend,    v_site2),
        (v_cat_opinions,    v_site2);

    INSERT INTO category_localizations (category_id, locale_id, name, description) VALUES
        (v_cat_engineering, v_locale_en, 'Engineering',  'Software engineering topics'),
        (v_cat_engineering, v_locale_de, 'Technik',      'Software-Engineering Themen'),
        (v_cat_backend,     v_locale_en, 'Backend',      'Server-side and systems programming'),
        (v_cat_backend,     v_locale_de, 'Backend',      'Serverseitige Programmierung'),
        (v_cat_frontend,    v_locale_en, 'Frontend',     'UI, UX, and browser technologies'),
        (v_cat_frontend,    v_locale_de, 'Frontend',     'UI, UX und Browser-Technologien'),
        (v_cat_opinions,    v_locale_en, 'Opinions',     'Hot takes and editorials');

    -- ========================================================================
    -- SKILLS
    -- ========================================================================
    INSERT INTO skills (name, slug, category, proficiency_level, is_global) VALUES
        ('Rust',       'rust',       'programming', 4, FALSE) RETURNING id INTO v_skill_rust;
    INSERT INTO skills (name, slug, category, proficiency_level, is_global) VALUES
        ('TypeScript', 'typescript', 'programming', 5, FALSE) RETURNING id INTO v_skill_ts;
    INSERT INTO skills (name, slug, category, proficiency_level, is_global) VALUES
        ('React',      'react',      'framework',   5, FALSE) RETURNING id INTO v_skill_react;
    INSERT INTO skills (name, slug, category, proficiency_level, is_global) VALUES
        ('PostgreSQL', 'postgresql', 'database',    4, FALSE) RETURNING id INTO v_skill_postgres;
    INSERT INTO skills (name, slug, category, proficiency_level, is_global) VALUES
        ('Docker',     'docker',     'devops',      4, FALSE) RETURNING id INTO v_skill_docker;
    INSERT INTO skills (name, slug, category, proficiency_level, is_global) VALUES
        ('AWS',        'aws',        'devops',      3, FALSE) RETURNING id INTO v_skill_aws;
    INSERT INTO skills (name, slug, category, proficiency_level, is_global) VALUES
        ('Go',         'go',         'programming', 3, FALSE) RETURNING id INTO v_skill_go;

    INSERT INTO skill_sites (skill_id, site_id) VALUES
        (v_skill_rust,     v_site1), (v_skill_ts,       v_site1),
        (v_skill_react,    v_site1), (v_skill_postgres,  v_site1),
        (v_skill_docker,   v_site1), (v_skill_aws,       v_site1),
        (v_skill_go,       v_site1);

    INSERT INTO skill_localizations (skill_id, locale_id, display_name, description) VALUES
        (v_skill_rust,     v_locale_en, 'Rust',       'Systems programming language focused on safety and performance'),
        (v_skill_rust,     v_locale_de, 'Rust',       'Systemprogrammiersprache mit Fokus auf Sicherheit und Performance'),
        (v_skill_ts,       v_locale_en, 'TypeScript', 'Typed superset of JavaScript'),
        (v_skill_ts,       v_locale_de, 'TypeScript', 'Typisierte Erweiterung von JavaScript'),
        (v_skill_react,    v_locale_en, 'React',      'UI library for building component-based interfaces'),
        (v_skill_postgres, v_locale_en, 'PostgreSQL', 'Advanced open-source relational database'),
        (v_skill_docker,   v_locale_en, 'Docker',     'Container platform for application packaging'),
        (v_skill_aws,      v_locale_en, 'AWS',        'Amazon Web Services cloud platform'),
        (v_skill_go,       v_locale_en, 'Go',         'Compiled language built for concurrency');

    -- ========================================================================
    -- BLOG 1 — Site 1 — "Building a CMS in Rust + WASM" (EN + DE, published)
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by, updated_by)
    VALUES (v_et_blog, v_env_dev, 'building-cms-rust-wasm', 'published', NOW() - INTERVAL '14 days', 1, v_user_admin, v_user_admin)
    RETURNING id INTO v_content_blog1;

    INSERT INTO content_sites (content_id, site_id, is_owner, is_featured) VALUES (v_content_blog1, v_site1, TRUE, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, excerpt, meta_title, meta_description, body, translation_status)
    VALUES (v_content_blog1, v_locale_en,
        'Building a Headless CMS with Rust and WebAssembly',
        'From zero to production-ready in 6 weeks',
        'A deep-dive into how I built a multi-tenant CMS backend in Rust with a WASM-powered admin panel.',
        'Building a CMS in Rust + WASM | John Doe',
        'Learn how to build a headless CMS from scratch using Rust, Actix-web, and WebAssembly.',
        E'## Why Rust for a CMS?\n\nMost content management systems are built on PHP, Node.js, or Python. I wanted to explore whether Rust could deliver **better performance** with **fewer resources**.\n\n### The Architecture\n\nThe backend uses **Actix-web** with a PostgreSQL database. Every request is authenticated via API keys and scoped to a specific site.\n\n```rust\nasync fn get_blogs(pool: &PgPool, site_id: Uuid) -> Result<Vec<Blog>> {\n    sqlx::query_as!(Blog, "SELECT * FROM blogs WHERE site_id = $1", site_id)\n        .fetch_all(pool)\n        .await\n}\n```\n\n### WASM Admin Panel\n\nThe admin interface is compiled from Rust to WebAssembly using **Yew**. It communicates with the API via fetch calls and renders a full SPA.\n\n## Performance Results\n\n| Metric | Node.js CMS | Rust CMS |\n|--------|------------|----------|\n| p99 latency | 120ms | 8ms |\n| Memory usage | 180MB | 12MB |\n| Requests/sec | 2,400 | 38,000 |\n\nThe difference is staggering. Rust handles **15x more requests** with a fraction of the memory.\n\n## What I Learned\n\nRust''s ownership model forces you to think about data flow upfront, which results in **cleaner architecture** by default.',
        'approved')
    RETURNING id INTO v_cl_blog1_en;

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, excerpt, body, translation_status)
    VALUES (v_content_blog1, v_locale_de,
        'Ein Headless-CMS mit Rust und WebAssembly bauen',
        'Von Null auf produktionsreif in 6 Wochen',
        'Ein tiefer Einblick, wie ich ein Multi-Tenant-CMS-Backend in Rust mit einem WASM-Admin-Panel gebaut habe.',
        E'## Warum Rust für ein CMS?\n\nDie meisten Content-Management-Systeme basieren auf PHP, Node.js oder Python. Ich wollte herausfinden, ob Rust **bessere Performance** bei **weniger Ressourcen** liefern kann.\n\n### Die Architektur\n\nDas Backend nutzt **Actix-web** mit einer PostgreSQL-Datenbank. Jeder Request wird über API-Keys authentifiziert und ist auf eine bestimmte Site beschränkt.\n\n## Ergebnisse\n\nRust bewältigt **15x mehr Anfragen** bei einem Bruchteil des Speicherverbrauchs.',
        'approved')
    RETURNING id INTO v_cl_blog1_de;

    INSERT INTO blogs (content_id, author, published_date, reading_time_minutes, cover_image_id, is_featured)
    VALUES (v_content_blog1, 'John Doe', '2026-02-03', 8, v_media_blog1_cover, TRUE)
    RETURNING id INTO v_blog1;

    INSERT INTO content_tags (content_id, tag_id) VALUES
        (v_content_blog1, v_tag_rust), (v_content_blog1, v_tag_wasm);
    INSERT INTO content_categories (content_id, category_id, is_primary) VALUES
        (v_content_blog1, v_cat_backend, TRUE);

    -- Content blocks for blog 1 EN
    INSERT INTO content_blocks (content_localization_id, block_type, block_order, block_data) VALUES
        (v_cl_blog1_en, 'heading',   0, '{"level":2,"text":"Why Rust for a CMS?"}'::jsonb),
        (v_cl_blog1_en, 'paragraph', 1, '{"text":"Most content management systems are built on PHP, Node.js, or Python."}'::jsonb),
        (v_cl_blog1_en, 'code',      2, '{"language":"rust","code":"async fn get_blogs(pool: &PgPool) -> Result<Vec<Blog>> { ... }"}'::jsonb),
        (v_cl_blog1_en, 'table',     3, '{"headers":["Metric","Node.js","Rust"],"rows":[["p99","120ms","8ms"],["Memory","180MB","12MB"]]}'::jsonb);

    -- Blog link
    INSERT INTO blog_links (blog_id, url, title, display_order) VALUES
        (v_blog1, 'https://github.com/nickel-org/nickel.rs', 'Nickel.rs — Rust web framework', 0);

    -- ========================================================================
    -- BLOG 2 — Site 1 — "Next.js ISR Deep-Dive" (EN only, published)
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by, updated_by)
    VALUES (v_et_blog, v_env_dev, 'nextjs-isr-deep-dive', 'published', NOW() - INTERVAL '7 days', 1, v_user_admin, v_user_admin)
    RETURNING id INTO v_content_blog2;

    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_blog2, v_site1, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, excerpt, body, translation_status)
    VALUES (v_content_blog2, v_locale_en,
        'Next.js ISR Deep-Dive: Stale-While-Revalidate for the Jamstack',
        'How incremental static regeneration actually works under the hood',
        'A practical guide to ISR patterns, cache invalidation strategies, and when to choose ISR over SSR.',
        E'## What is ISR?\n\nIncremental Static Regeneration (ISR) lets you create or update static pages **after** you''ve built your site.\n\n### The Revalidation Flow\n\n1. User requests a page\n2. Next.js serves the cached static version\n3. In the background, it regenerates the page\n4. The next visitor gets the fresh version\n\n```typescript\nexport async function getStaticProps() {\n  const posts = await fetchPosts();\n  return {\n    props: { posts },\n    revalidate: 60, // seconds\n  };\n}\n```\n\n### On-Demand Revalidation\n\nSince Next.js 12.1 you can trigger revalidation via an API route:\n\n```typescript\nexport default async function handler(req, res) {\n  await res.revalidate(''/blog/my-post'');\n  return res.json({ revalidated: true });\n}\n```\n\n## When NOT to Use ISR\n\n- Real-time dashboards\n- User-specific content\n- Pages that change on every request',
        'approved')
    RETURNING id INTO v_cl_blog2_en;

    INSERT INTO blogs (content_id, author, published_date, reading_time_minutes, cover_image_id)
    VALUES (v_content_blog2, 'John Doe', '2026-02-10', 6, v_media_blog2_cover)
    RETURNING id INTO v_blog2;

    INSERT INTO content_tags (content_id, tag_id) VALUES
        (v_content_blog2, v_tag_react), (v_content_blog2, v_tag_typescript), (v_content_blog2, v_tag_tutorial);
    INSERT INTO content_categories (content_id, category_id, is_primary) VALUES
        (v_content_blog2, v_cat_frontend, TRUE);

    -- Content blocks for blog 2 EN (ISR)
    INSERT INTO content_blocks (content_localization_id, block_type, block_order, block_data) VALUES
        (v_cl_blog2_en, 'heading',   0, '{"level":2,"text":"What is ISR?"}'::jsonb),
        (v_cl_blog2_en, 'paragraph', 1, '{"text":"Incremental Static Regeneration lets you create or update static pages after you''ve built your site."}'::jsonb),
        (v_cl_blog2_en, 'code',      2, '{"language":"typescript","code":"export async function getStaticProps() {\n  const posts = await fetchPosts();\n  return { props: { posts }, revalidate: 60 };\n}"}'::jsonb),
        (v_cl_blog2_en, 'heading',   3, '{"level":3,"text":"On-Demand Revalidation"}'::jsonb),
        (v_cl_blog2_en, 'paragraph', 4, '{"text":"Since Next.js 12.1 you can trigger revalidation via an API route."}'::jsonb);

    -- Blog photos for blog 1 (Rust + WASM)
    INSERT INTO blog_photos (blog_id, media_file_id, display_order) VALUES
        (v_blog1, v_media_blog1_cover, 0),
        (v_blog1, v_media_hero, 1);

    -- Blog photos for blog 2 (ISR)
    INSERT INTO blog_photos (blog_id, media_file_id, display_order) VALUES
        (v_blog2, v_media_blog2_cover, 0);

    -- ========================================================================
    -- BLOG 3 — Site 2 — "Docker Compose for Local Dev" (EN + DE, published)
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by, updated_by)
    VALUES (v_et_blog, v_env_dev, 'docker-compose-local-dev', 'published', NOW() - INTERVAL '3 days', 1, v_user_editor, v_user_editor)
    RETURNING id INTO v_content_blog3;

    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_blog3, v_site2, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, excerpt, body, translation_status)
    VALUES (v_content_blog3, v_locale_en,
        'Docker Compose Recipes for Local Development',
        'Stop fighting with local installs — containerize everything',
        'Practical docker-compose patterns for Postgres, Redis, and local S3 that just work.',
        E'## The Problem with "Works on My Machine"\n\nEvery developer has been there: the app runs fine locally but breaks in CI because of a different Postgres version or missing Redis.\n\n### A Universal docker-compose.yml\n\n```yaml\nservices:\n  db:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_PASSWORD: dev\n    ports:\n      - "5432:5432"\n    volumes:\n      - pgdata:/var/lib/postgresql/data\n\n  redis:\n    image: redis:7-alpine\n    ports:\n      - "6379:6379"\n\n  minio:\n    image: minio/minio\n    command: server /data --console-address ":9001"\n    ports:\n      - "9000:9000"\n      - "9001:9001"\n\nvolumes:\n  pgdata:\n```\n\n### Health Checks Matter\n\nAlways add health checks so dependent services wait properly:\n\n```yaml\ndb:\n  healthcheck:\n    test: ["CMD-SHELL", "pg_isready -U postgres"]\n    interval: 5s\n    timeout: 5s\n    retries: 5\n```\n\n## Bonus: Make Targets\n\nWrap compose commands in a `Makefile` for team consistency.',
        'approved')
    RETURNING id INTO v_cl_blog3_en;

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, excerpt, body, translation_status)
    VALUES (v_content_blog3, v_locale_de,
        'Docker-Compose-Rezepte für die lokale Entwicklung',
        'Schluss mit lokalen Installationsproblemen',
        'Praktische Docker-Compose-Muster für Postgres, Redis und lokales S3.',
        E'## Das Problem mit "Läuft bei mir"\n\nJeder Entwickler kennt das: Die App läuft lokal, aber bricht in CI zusammen.\n\n### Eine universelle docker-compose.yml\n\nMit Docker Compose definiert man alle Abhängigkeiten deklarativ.\n\n## Bonus: Make-Targets\n\nCompose-Befehle in ein `Makefile` wrappen sorgt für Team-Konsistenz.',
        'in_progress')
    RETURNING id INTO v_cl_blog3_de;

    INSERT INTO blogs (content_id, author, published_date, reading_time_minutes, cover_image_id)
    VALUES (v_content_blog3, 'Sarah Chen', '2026-02-14', 5, v_media_blog3_cover)
    RETURNING id INTO v_blog3;

    INSERT INTO content_tags (content_id, tag_id) VALUES
        (v_content_blog3, v_tag_devops), (v_content_blog3, v_tag_tutorial);
    INSERT INTO content_categories (content_id, category_id, is_primary) VALUES
        (v_content_blog3, v_cat_backend, TRUE);

    -- Blog attachments for blog 3 (Docker Compose) — link to existing media
    INSERT INTO blog_attachments (blog_id, media_file_id, display_order) VALUES
        (v_blog3, v_media_blog3_cover, 0);

    -- ========================================================================
    -- BLOG 4 — Site 2 — "AI Code Review" (EN only, in_review)
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, current_version, created_by, updated_by)
    VALUES (v_et_blog, v_env_dev, 'ai-code-review-2026', 'in_review', 1, v_user_editor, v_user_editor)
    RETURNING id INTO v_content_blog4;

    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_blog4, v_site2, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, excerpt, body, translation_status)
    VALUES (v_content_blog4, v_locale_en,
        'AI-Powered Code Review: Hype or Game Changer?',
        'We tested 5 AI code review tools on real PRs',
        'An honest comparison of AI code review assistants and whether they actually catch real bugs.',
        E'## The Experiment\n\nWe took 50 real pull requests from open-source projects — each containing at least one known bug — and ran them through five AI code review tools.\n\n### Tools Tested\n\n1. **CodeRabbit** — AI PR reviewer\n2. **Sourcery** — Python-focused AI\n3. **Amazon CodeGuru** — AWS native\n4. **Claude Code** — Anthropic CLI\n5. **GitHub Copilot Chat** — inline reviews\n\n### Results\n\n| Tool | Bugs Found | False Positives | Time |\n|------|-----------|----------------|------|\n| CodeRabbit | 34/50 | 12 | 2min |\n| Claude Code | 41/50 | 6 | 3min |\n| Copilot Chat | 28/50 | 18 | 1min |\n\n## Verdict\n\nAI code review is **additive** — it catches things humans miss, but still misses architectural issues that require deep context. The sweet spot is using AI as a first pass before human review.\n\n*Draft — need to add Sourcery and CodeGuru results.*',
        'pending')
    RETURNING id INTO v_cl_blog4_en;

    INSERT INTO blogs (content_id, author, published_date, reading_time_minutes, cover_image_id)
    VALUES (v_content_blog4, 'Sarah Chen', '2026-02-17', 10, v_media_blog4_cover)
    RETURNING id INTO v_blog4;

    INSERT INTO content_tags (content_id, tag_id) VALUES
        (v_content_blog4, v_tag_ai);
    INSERT INTO content_categories (content_id, category_id, is_primary) VALUES
        (v_content_blog4, v_cat_opinions, TRUE);

    -- ========================================================================
    -- BLOG 5 — Site 1 — "Zero-Cost Abstractions in Rust" (EN only, published)
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by, updated_by)
    VALUES (v_et_blog, v_env_dev, 'zero-cost-abstractions-rust', 'published', NOW() - INTERVAL '5 days', 1, v_user_admin, v_user_admin)
    RETURNING id INTO v_content_blog5;

    INSERT INTO content_sites (content_id, site_id, is_owner, is_featured) VALUES (v_content_blog5, v_site1, TRUE, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, excerpt, meta_title, meta_description, body, translation_status)
    VALUES (v_content_blog5, v_locale_en,
        'Zero-Cost Abstractions in Rust: What They Are and Why They Matter',
        'Understanding the compiler magic behind Rust''s performance promises',
        'An exploration of how Rust delivers high-level ergonomics without sacrificing low-level performance through zero-cost abstractions.',
        'Zero-Cost Abstractions in Rust | John Doe',
        'Learn how Rust achieves zero-cost abstractions and why they matter for systems programming.',
        E'## The Promise\n\nRust''s core promise is that abstractions should compile down to the same code you''d write by hand. This is what Bjarne Stroustrup called **zero-overhead abstraction**.\n\n### Iterators vs. Loops\n\nConsider this comparison:\n\n```rust\n// Hand-written loop\nlet mut sum = 0;\nfor i in 0..data.len() {\n    sum += data[i] * 2;\n}\n\n// Iterator chain\nlet sum: i64 = data.iter().map(|x| x * 2).sum();\n```\n\nBoth compile to **identical assembly**. The iterator version is not just syntactic sugar — the compiler fully unrolls and optimizes it.\n\n### Trait Objects vs. Generics\n\nGenerics in Rust are monomorphized at compile time:\n\n```rust\nfn process<T: Display>(item: T) {\n    println!("{}", item);\n}\n```\n\nThe compiler generates a specialized version for each concrete type — no vtable lookup, no dynamic dispatch.\n\n### When There IS a Cost\n\nDynamic dispatch via `dyn Trait` does incur a small cost:\n\n```rust\nfn process(item: &dyn Display) {\n    println!("{}", item); // vtable lookup here\n}\n```\n\nBut Rust makes this **explicit** — you opt in with the `dyn` keyword.\n\n## Benchmarks\n\n| Pattern | Time (ns) | Allocations |\n|---------|-----------|-------------|\n| Manual loop | 45 | 0 |\n| Iterator chain | 45 | 0 |\n| dyn dispatch | 52 | 0 |\n| Box<dyn> | 68 | 1 |\n\n## Takeaway\n\nRust''s type system and ownership model enable the compiler to aggressively optimize without runtime cost. Write idiomatic Rust — the compiler will do the rest.',
        'approved')
    RETURNING id INTO v_cl_blog5_en;

    INSERT INTO blogs (content_id, author, published_date, reading_time_minutes, cover_image_id, is_featured)
    VALUES (v_content_blog5, 'John Doe', '2026-02-18', 7, v_media_blog5_cover, TRUE)
    RETURNING id INTO v_blog5;

    INSERT INTO content_tags (content_id, tag_id) VALUES
        (v_content_blog5, v_tag_rust);
    INSERT INTO content_categories (content_id, category_id, is_primary) VALUES
        (v_content_blog5, v_cat_backend, TRUE);

    -- Content blocks for blog 5 EN
    INSERT INTO content_blocks (content_localization_id, block_type, block_order, block_data) VALUES
        (v_cl_blog5_en, 'heading',   0, '{"level":2,"text":"The Promise"}'::jsonb),
        (v_cl_blog5_en, 'paragraph', 1, '{"text":"Rust''s core promise is that abstractions should compile down to the same code you''d write by hand."}'::jsonb),
        (v_cl_blog5_en, 'code',      2, '{"language":"rust","code":"let sum: i64 = data.iter().map(|x| x * 2).sum();"}'::jsonb),
        (v_cl_blog5_en, 'table',     3, '{"headers":["Pattern","Time (ns)","Allocations"],"rows":[["Manual loop","45","0"],["Iterator chain","45","0"],["dyn dispatch","52","0"]]}'::jsonb);

    -- ========================================================================
    -- BLOG 6 — Site 1 — "Designing a Multi-Tenant Database Schema" (EN only, published)
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by, updated_by)
    VALUES (v_et_blog, v_env_dev, 'multi-tenant-database-schema', 'published', NOW() - INTERVAL '2 days', 1, v_user_admin, v_user_admin)
    RETURNING id INTO v_content_blog6;

    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_blog6, v_site1, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, excerpt, meta_title, meta_description, body, translation_status)
    VALUES (v_content_blog6, v_locale_en,
        'Designing a Multi-Tenant Database Schema',
        'Shared tables, isolated data, and the trade-offs in between',
        'A practical guide to multi-tenancy patterns in PostgreSQL — from shared schemas to row-level security.',
        'Multi-Tenant Database Schema | John Doe',
        'Learn how to design a multi-tenant database schema in PostgreSQL with row-level security.',
        E'## Multi-Tenancy Strategies\n\nThere are three main approaches to multi-tenant databases:\n\n### 1. Database per Tenant\n\nEach tenant gets their own database. Maximum isolation, but operationally expensive.\n\n### 2. Schema per Tenant\n\nAll tenants share a database but have separate schemas. Good isolation with easier backups.\n\n### 3. Shared Schema with Tenant ID\n\nAll tenants share the same tables with a `tenant_id` discriminator column. This is what we use.\n\n```sql\nCREATE TABLE blogs (\n    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n    site_id UUID NOT NULL REFERENCES sites(id),\n    title TEXT NOT NULL,\n    -- site_id is the tenant discriminator\n);\n\nCREATE INDEX idx_blogs_site ON blogs(site_id);\n```\n\n### Row-Level Security\n\nPostgreSQL RLS lets you enforce tenant isolation at the database level:\n\n```sql\nALTER TABLE blogs ENABLE ROW LEVEL SECURITY;\n\nCREATE POLICY tenant_isolation ON blogs\n    USING (site_id = current_setting(''app.current_site_id'')::UUID);\n```\n\n## Performance Considerations\n\n| Strategy | Isolation | Complexity | Scale |\n|----------|-----------|-----------|-------|\n| DB per tenant | Excellent | High | 100s |\n| Schema per tenant | Good | Medium | 1000s |\n| Shared + RLS | Moderate | Low | 100000s |\n\n## What We Chose\n\nFor a headless CMS, shared schema with `site_id` columns gives us the best balance of simplicity and scalability. Combined with proper indexing and RLS policies, tenant data never leaks.',
        'approved')
    RETURNING id INTO v_cl_blog6_en;

    INSERT INTO blogs (content_id, author, published_date, reading_time_minutes, cover_image_id)
    VALUES (v_content_blog6, 'John Doe', '2026-02-21', 9, v_media_blog6_cover)
    RETURNING id INTO v_blog6;

    INSERT INTO content_tags (content_id, tag_id) VALUES
        (v_content_blog6, v_tag_rust), (v_content_blog6, v_tag_tutorial);
    INSERT INTO content_categories (content_id, category_id, is_primary) VALUES
        (v_content_blog6, v_cat_backend, TRUE);

    -- Content blocks for blog 6 EN
    INSERT INTO content_blocks (content_localization_id, block_type, block_order, block_data) VALUES
        (v_cl_blog6_en, 'heading',   0, '{"level":2,"text":"Multi-Tenancy Strategies"}'::jsonb),
        (v_cl_blog6_en, 'paragraph', 1, '{"text":"There are three main approaches to multi-tenant databases."}'::jsonb),
        (v_cl_blog6_en, 'code',      2, '{"language":"sql","code":"CREATE POLICY tenant_isolation ON blogs\n    USING (site_id = current_setting(''app.current_site_id'')::UUID);"}'::jsonb),
        (v_cl_blog6_en, 'table',     3, '{"headers":["Strategy","Isolation","Complexity","Scale"],"rows":[["DB per tenant","Excellent","High","100s"],["Schema per tenant","Good","Medium","1000s"],["Shared + RLS","Moderate","Low","100000s"]]}'::jsonb);

    -- ========================================================================
    -- BLOG 7 — Site 1 — "Edge Computing with WASM" (EN only, scheduled)
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, publish_start, current_version, created_by, updated_by)
    VALUES (v_et_blog, v_env_dev, 'edge-computing-wasm-workers', 'scheduled', NOW() + INTERVAL '7 days', 1, v_user_admin, v_user_admin)
    RETURNING id INTO v_content_blog7;

    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_blog7, v_site1, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, excerpt, meta_title, meta_description, body, translation_status)
    VALUES (v_content_blog7, v_locale_en,
        'Edge Computing with WebAssembly Workers',
        'Running Rust at the edge — no cold starts, no containers',
        'How WebAssembly is enabling a new generation of edge computing platforms with near-zero startup times.',
        'Edge Computing with WASM Workers | John Doe',
        'Explore how WebAssembly workers run Rust at the edge with near-zero cold starts.',
        E'## The Edge Revolution\n\nTraditional serverless platforms suffer from **cold start** latency — sometimes hundreds of milliseconds. WebAssembly workers change the game.\n\n### How WASM Workers Differ\n\nUnlike containers, WASM modules:\n- Start in **microseconds**, not milliseconds\n- Use a fraction of the memory\n- Run in a secure sandbox by default\n\n```rust\nuse worker::*;\n\n#[event(fetch)]\nasync fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {\n    let url = req.url()?;\n    Response::ok(format!("Hello from the edge! Path: {}", url.path()))\n}\n```\n\n### Platform Comparison\n\n| Platform | Runtime | Cold Start | Max Duration |\n|----------|---------|------------|-------------|\n| Cloudflare Workers | V8/WASM | <1ms | 30s (free) |\n| Fastly Compute | WASM | <1ms | 120s |\n| AWS Lambda | Container | 100-500ms | 15min |\n| Vercel Edge | V8 | ~5ms | 30s |\n\n### When to Use Edge Computing\n\n- **A/B testing** — route users at the edge before they hit origin\n- **Geolocation** — serve locale-specific content instantly\n- **Auth validation** — verify JWTs without a round-trip\n- **API gateways** — rate limiting and request transformation\n\n## The Trade-offs\n\nEdge workers have limited CPU time and no persistent connections to databases. You need to rethink your architecture around **stateless request handling** and **external data stores**.',
        'approved')
    RETURNING id INTO v_cl_blog7_en;

    INSERT INTO blogs (content_id, author, published_date, reading_time_minutes, cover_image_id)
    VALUES (v_content_blog7, 'John Doe', '2026-03-05', 7, v_media_blog7_cover)
    RETURNING id INTO v_blog7;

    INSERT INTO content_tags (content_id, tag_id) VALUES
        (v_content_blog7, v_tag_rust), (v_content_blog7, v_tag_wasm);
    INSERT INTO content_categories (content_id, category_id, is_primary) VALUES
        (v_content_blog7, v_cat_backend, TRUE);

    -- Content blocks for blog 7 EN
    INSERT INTO content_blocks (content_localization_id, block_type, block_order, block_data) VALUES
        (v_cl_blog7_en, 'heading',   0, '{"level":2,"text":"The Edge Revolution"}'::jsonb),
        (v_cl_blog7_en, 'paragraph', 1, '{"text":"Traditional serverless platforms suffer from cold start latency. WebAssembly workers change the game."}'::jsonb),
        (v_cl_blog7_en, 'code',      2, '{"language":"rust","code":"#[event(fetch)]\nasync fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {\n    Response::ok(\"Hello from the edge!\")\n}"}'::jsonb),
        (v_cl_blog7_en, 'table',     3, '{"headers":["Platform","Runtime","Cold Start"],"rows":[["Cloudflare Workers","V8/WASM","<1ms"],["AWS Lambda","Container","100-500ms"]]}'::jsonb);

    -- ========================================================================
    -- BLOG 8 — Site 2 — "GraphQL Federation" (EN only, archived)
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by, updated_by)
    VALUES (v_et_blog, v_env_dev, 'graphql-federation-guide', 'archived', NOW() - INTERVAL '90 days', 1, v_user_editor, v_user_editor)
    RETURNING id INTO v_content_blog8;

    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_blog8, v_site2, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, excerpt, body, translation_status)
    VALUES (v_content_blog8, v_locale_en,
        'A Practical Guide to GraphQL Federation',
        'Stitching microservice schemas into a unified graph',
        'How to use Apollo Federation to compose multiple GraphQL services into a single, coherent API.',
        E'## Why Federation?\n\nAs your application grows, a single monolithic GraphQL server becomes a bottleneck. **Federation** lets each team own their slice of the graph.\n\n### The Gateway Pattern\n\nA federation gateway composes subgraphs from multiple services:\n\n```graphql\n# Users subgraph\ntype User @key(fields: "id") {\n  id: ID!\n  name: String!\n  email: String!\n}\n\n# Orders subgraph\ntype Order @key(fields: "id") {\n  id: ID!\n  user: User!\n  total: Float!\n}\n\nextend type User @key(fields: "id") {\n  id: ID! @external\n  orders: [Order!]!\n}\n```\n\n### Key Concepts\n\n1. **Entities** — types that span multiple subgraphs (identified by `@key`)\n2. **References** — how one subgraph refers to an entity owned by another\n3. **Gateway** — the router that composes all subgraphs into one schema\n\n### Performance Tips\n\n| Optimization | Impact | Effort |\n|-------------|--------|--------|\n| DataLoader batching | High | Low |\n| Query planning cache | Medium | Low |\n| Subgraph colocation | High | High |\n| Persisted queries | Medium | Medium |\n\n## When NOT to Federate\n\n- Fewer than 3 services — overhead not worth it\n- Tight coupling between services — federation won''t fix bad boundaries\n- Team is small — a monolith graph is simpler\n\n*Note: This article covers Apollo Federation v1. See our updated guide for v2 changes.*',
        'approved')
    RETURNING id INTO v_cl_blog8_en;

    INSERT INTO blogs (content_id, author, published_date, reading_time_minutes, cover_image_id)
    VALUES (v_content_blog8, 'Sarah Chen', '2025-11-28', 8, v_media_blog8_cover)
    RETURNING id INTO v_blog8;

    INSERT INTO content_tags (content_id, tag_id) VALUES
        (v_content_blog8, v_tag_tutorial);
    INSERT INTO content_categories (content_id, category_id, is_primary) VALUES
        (v_content_blog8, v_cat_backend, TRUE);

    -- Content blocks for blog 8 EN
    INSERT INTO content_blocks (content_localization_id, block_type, block_order, block_data) VALUES
        (v_cl_blog8_en, 'heading',   0, '{"level":2,"text":"Why Federation?"}'::jsonb),
        (v_cl_blog8_en, 'paragraph', 1, '{"text":"As your application grows, a single monolithic GraphQL server becomes a bottleneck."}'::jsonb),
        (v_cl_blog8_en, 'code',      2, '{"language":"graphql","code":"type User @key(fields: \"id\") {\n  id: ID!\n  name: String!\n  email: String!\n}"}'::jsonb),
        (v_cl_blog8_en, 'table',     3, '{"headers":["Optimization","Impact","Effort"],"rows":[["DataLoader batching","High","Low"],["Query planning cache","Medium","Low"],["Persisted queries","Medium","Medium"]]}'::jsonb);

    -- ========================================================================
    -- PAGE: Home (Site 1) — landing page with sections
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_page, v_env_dev, 'home', 'published', NOW() - INTERVAL '30 days', 1, v_user_admin)
    RETURNING id INTO v_content_page_home1;

    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_page_home1, v_site1, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, meta_title, meta_description, translation_status)
    VALUES (v_content_page_home1, v_locale_en,
        'Home', 'Full-stack engineer crafting fast, beautiful software',
        'John Doe — Software Engineer', 'Portfolio and blog of John Doe, a Vienna-based full-stack engineer.',
        'approved')
    RETURNING id INTO v_cl_home1_en;

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, translation_status)
    VALUES (v_content_page_home1, v_locale_de,
        'Startseite', 'Full-Stack-Entwickler für schnelle, schöne Software', 'approved')
    RETURNING id INTO v_cl_home1_de;

    INSERT INTO pages (content_id, route, page_type, is_in_navigation, navigation_order)
    VALUES (v_content_page_home1, '/', 'landing', TRUE, 0)
    RETURNING id INTO v_page_home1;

    -- Landing page sections
    INSERT INTO page_sections (page_id, section_type, display_order, cover_image_id, call_to_action_route, settings)
    VALUES (v_page_home1, 'hero', 0, v_media_hero, '/about', '{"fullWidth":true}'::jsonb)
    RETURNING id INTO v_section_hero1;

    INSERT INTO page_section_localizations (page_section_id, locale_id, title, text, button_text) VALUES
        (v_section_hero1, v_locale_en, 'Hi, I''m John', 'I build fast, reliable web applications with Rust, TypeScript, and React.', 'Learn more'),
        (v_section_hero1, v_locale_de, 'Hallo, ich bin John', 'Ich baue schnelle, zuverlässige Webanwendungen mit Rust, TypeScript und React.', 'Mehr erfahren');

    INSERT INTO page_sections (page_id, section_type, display_order, settings)
    VALUES (v_page_home1, 'features', 1, '{"columns":3}'::jsonb)
    RETURNING id INTO v_section_feat1;

    INSERT INTO page_section_localizations (page_section_id, locale_id, title, text) VALUES
        (v_section_feat1, v_locale_en, 'What I Do', 'Backend systems, frontend interfaces, and everything in between.'),
        (v_section_feat1, v_locale_de, 'Was ich mache', 'Backend-Systeme, Frontend-Interfaces und alles dazwischen.');

    INSERT INTO page_sections (page_id, section_type, display_order, call_to_action_route)
    VALUES (v_page_home1, 'cta', 2, '/contact')
    RETURNING id INTO v_section_cta1;

    INSERT INTO page_section_localizations (page_section_id, locale_id, title, text, button_text) VALUES
        (v_section_cta1, v_locale_en, 'Let''s Work Together', 'Got a project in mind? I''d love to hear about it.', 'Get in touch'),
        (v_section_cta1, v_locale_de, 'Lass uns zusammenarbeiten', 'Hast du ein Projekt im Sinn? Ich freue mich von dir zu hören.', 'Kontakt');

    -- ========================================================================
    -- PAGE: About (Site 1)
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_page, v_env_dev, 'about', 'published', NOW() - INTERVAL '30 days', 1, v_user_admin)
    RETURNING id INTO v_content_page_about1;

    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_page_about1, v_site1, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, body, translation_status)
    VALUES (v_content_page_about1, v_locale_en,
        'About Me',
        E'## About John Doe\n\nI''m a full-stack software engineer based in Vienna, Austria, with a passion for building performant, type-safe web applications.\n\n### Background\n\nI''ve been writing code professionally for over 8 years, working across fintech, e-commerce, and developer tools. My current focus is on **Rust** for backend systems and **React/Next.js** for frontend applications.\n\n### Philosophy\n\n- **Ship fast, iterate faster** — working software beats perfect plans\n- **Type safety is a feature** — catch bugs before users do\n- **Performance is UX** — every millisecond matters',
        'approved')
    RETURNING id INTO v_cl_about1_en;

    INSERT INTO content_localizations (content_id, locale_id, title, body, translation_status)
    VALUES (v_content_page_about1, v_locale_de,
        'Über mich',
        E'## Über John Doe\n\nIch bin ein Full-Stack-Softwareentwickler aus Wien mit einer Leidenschaft für performante, typsichere Webanwendungen.\n\n### Hintergrund\n\nSeit über 8 Jahren schreibe ich professionell Code — in Fintech, E-Commerce und Developer Tools.',
        'approved')
    RETURNING id INTO v_cl_about1_de;

    INSERT INTO pages (content_id, route, page_type, is_in_navigation, navigation_order)
    VALUES (v_content_page_about1, '/about', 'static', TRUE, 1)
    RETURNING id INTO v_page_about1;

    -- About page sections
    INSERT INTO page_sections (page_id, section_type, display_order, cover_image_id, settings)
    VALUES (v_page_about1, 'hero', 0, v_media_avatar, '{"fullWidth":false}'::jsonb)
    RETURNING id INTO v_tmp_id;
    INSERT INTO page_section_localizations (page_section_id, locale_id, title, text) VALUES
        (v_tmp_id, v_locale_en, 'About Me', 'Full-stack engineer based in Vienna, building performant web apps with Rust and React.'),
        (v_tmp_id, v_locale_de, 'Über mich', 'Full-Stack-Entwickler aus Wien — ich baue performante Web-Apps mit Rust und React.');

    INSERT INTO page_sections (page_id, section_type, display_order, settings)
    VALUES (v_page_about1, 'features', 1, '{"columns":3}'::jsonb)
    RETURNING id INTO v_tmp_id;
    INSERT INTO page_section_localizations (page_section_id, locale_id, title, text) VALUES
        (v_tmp_id, v_locale_en, 'What I Work With', 'Rust, TypeScript, React, Next.js, PostgreSQL, Docker, and AWS.'),
        (v_tmp_id, v_locale_de, 'Womit ich arbeite', 'Rust, TypeScript, React, Next.js, PostgreSQL, Docker und AWS.');

    -- ========================================================================
    -- PAGE: Contact (Site 1)
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_page, v_env_dev, 'contact', 'published', NOW() - INTERVAL '30 days', 1, v_user_admin)
    RETURNING id INTO v_content_page_contact1;

    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_page_contact1, v_site1, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, body, translation_status)
    VALUES (v_content_page_contact1, v_locale_en,
        'Contact',
        E'## Get in Touch\n\nFeel free to reach out via email or connect with me on social media.\n\n**Email:** john@johndoe.dev\n**Location:** Vienna, Austria\n**Availability:** Open for freelance and consulting',
        'approved')
    RETURNING id INTO v_cl_contact1_en;

    INSERT INTO pages (content_id, route, page_type, is_in_navigation, navigation_order)
    VALUES (v_content_page_contact1, '/contact', 'contact', TRUE, 3)
    RETURNING id INTO v_page_contact1;

    -- Contact page sections
    INSERT INTO page_sections (page_id, section_type, display_order)
    VALUES (v_page_contact1, 'contact', 0)
    RETURNING id INTO v_tmp_id;
    INSERT INTO page_section_localizations (page_section_id, locale_id, title, text) VALUES
        (v_tmp_id, v_locale_en, 'Get in Touch', 'Have a question or want to work together? Drop me a message.'),
        (v_tmp_id, v_locale_de, 'Kontakt aufnehmen', 'Hast du eine Frage oder möchtest zusammenarbeiten? Schreib mir.');

    -- ========================================================================
    -- PAGE: Home (Site 2) — landing page
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_page, v_env_dev, 'home', 'published', NOW() - INTERVAL '20 days', 1, v_user_editor)
    RETURNING id INTO v_content_page_home2;

    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_page_home2, v_site2, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, subtitle, meta_title, meta_description, translation_status)
    VALUES (v_content_page_home2, v_locale_en,
        'TechBites', 'Byte-sized engineering insights',
        'TechBites — Engineering Blog', 'A snappy tech magazine covering backend, frontend, and DevOps.',
        'approved')
    RETURNING id INTO v_cl_home2_en;

    INSERT INTO pages (content_id, route, page_type, is_in_navigation, navigation_order)
    VALUES (v_content_page_home2, '/', 'landing', TRUE, 0)
    RETURNING id INTO v_page_home2;

    INSERT INTO page_sections (page_id, section_type, display_order, settings)
    VALUES (v_page_home2, 'hero', 0, '{"fullWidth":true,"gradient":"from-orange-500 to-amber-400"}'::jsonb)
    RETURNING id INTO v_section_hero2;

    INSERT INTO page_section_localizations (page_section_id, locale_id, title, text, button_text) VALUES
        (v_section_hero2, v_locale_en, 'TechBites', 'Fresh engineering articles, delivered weekly.', 'Read latest');

    -- ========================================================================
    -- PAGE: Blog Index (Site 2)
    -- ========================================================================
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_page, v_env_dev, 'articles', 'published', NOW() - INTERVAL '20 days', 1, v_user_editor)
    RETURNING id INTO v_content_page_blog_idx2;

    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_page_blog_idx2, v_site2, TRUE);

    INSERT INTO content_localizations (content_id, locale_id, title, meta_title, translation_status)
    VALUES (v_content_page_blog_idx2, v_locale_en, 'Articles', 'All Articles | TechBites', 'approved')
    RETURNING id INTO v_cl_blog_idx2_en;

    INSERT INTO pages (content_id, route, page_type, is_in_navigation, navigation_order)
    VALUES (v_content_page_blog_idx2, '/articles', 'blog_index', TRUE, 1)
    RETURNING id INTO v_page_blog_idx2;

    -- ========================================================================
    -- CV ENTRIES (Site 1)
    -- ========================================================================
    -- Entry 1: Current role
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_cv, v_env_dev, 'cv-acme-corp', 'published', NOW(), 1, v_user_admin)
    RETURNING id INTO v_content_cv1;
    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_cv1, v_site1, TRUE);

    INSERT INTO cv_entries (content_id, company, company_url, location, start_date, is_current, entry_type, display_order)
    VALUES (v_content_cv1, 'Acme Corp', 'https://acme.example.com', 'Vienna, Austria', '2023-06-01', TRUE, 'work', 0)
    RETURNING id INTO v_cv1;

    INSERT INTO cv_entry_localizations (cv_entry_id, locale_id, position, description, achievements) VALUES
        (v_cv1, v_locale_en, 'Senior Full-Stack Engineer',
         'Leading the migration from a monolithic PHP application to a microservices architecture using Rust and TypeScript.',
         '["Reduced API response times by 85% by rewriting critical paths in Rust","Led a team of 4 engineers to deliver the new checkout flow","Implemented CI/CD pipeline with 95% test coverage"]'::jsonb),
        (v_cv1, v_locale_de, 'Senior Full-Stack-Entwickler',
         'Leitung der Migration von einer monolithischen PHP-Anwendung zu einer Microservices-Architektur mit Rust und TypeScript.',
         '["API-Antwortzeiten um 85% reduziert durch Neuschreiben kritischer Pfade in Rust","4-köpfiges Team zum neuen Checkout-Flow geführt"]'::jsonb);

    INSERT INTO cv_entry_skills (cv_entry_id, skill_id, relevance_score) VALUES
        (v_cv1, v_skill_rust, 5), (v_cv1, v_skill_ts, 5), (v_cv1, v_skill_react, 4), (v_cv1, v_skill_postgres, 4), (v_cv1, v_skill_docker, 3);

    -- Entry 2: Previous role
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_cv, v_env_dev, 'cv-globex-inc', 'published', NOW(), 1, v_user_admin)
    RETURNING id INTO v_content_cv2;
    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_cv2, v_site1, TRUE);

    INSERT INTO cv_entries (content_id, company, company_url, location, start_date, end_date, entry_type, display_order)
    VALUES (v_content_cv2, 'Globex Inc.', 'https://globex.example.com', 'Munich, Germany', '2020-09-01', '2023-05-31', 'work', 1)
    RETURNING id INTO v_cv2;

    INSERT INTO cv_entry_localizations (cv_entry_id, locale_id, position, description, achievements) VALUES
        (v_cv2, v_locale_en, 'Frontend Engineer',
         'Built and maintained a React-based dashboard serving 50k+ daily active users.',
         '["Migrated codebase from JavaScript to TypeScript with zero downtime","Built real-time data visualization with D3.js and WebSockets","Mentored 2 junior developers"]'::jsonb),
        (v_cv2, v_locale_de, 'Frontend-Entwickler',
         'Entwicklung und Pflege eines React-Dashboards für über 50.000 tägliche Nutzer.',
         '["Codebase von JavaScript auf TypeScript migriert — ohne Ausfallzeit","Echtzeit-Datenvisualisierung mit D3.js und WebSockets gebaut"]'::jsonb);

    INSERT INTO cv_entry_skills (cv_entry_id, skill_id, relevance_score) VALUES
        (v_cv2, v_skill_ts, 5), (v_cv2, v_skill_react, 5), (v_cv2, v_skill_docker, 2);

    -- Entry 3: Education
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_cv, v_env_dev, 'cv-tu-vienna', 'published', NOW(), 1, v_user_admin)
    RETURNING id INTO v_content_cv3;
    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_cv3, v_site1, TRUE);

    INSERT INTO cv_entries (content_id, company, company_url, location, start_date, end_date, entry_type, display_order)
    VALUES (v_content_cv3, 'TU Wien', 'https://www.tuwien.at', 'Vienna, Austria', '2015-10-01', '2020-06-30', 'education', 2)
    RETURNING id INTO v_cv3;

    INSERT INTO cv_entry_localizations (cv_entry_id, locale_id, position, description) VALUES
        (v_cv3, v_locale_en, 'MSc Computer Science', 'Focus on distributed systems and software architecture. Thesis on WebAssembly performance in server-side applications.'),
        (v_cv3, v_locale_de, 'MSc Informatik', 'Schwerpunkt verteilte Systeme und Softwarearchitektur. Masterarbeit über WebAssembly-Performance in serverseitigen Anwendungen.');

    -- Entry 4: Certification
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_cv, v_env_dev, 'cv-aws-cert', 'published', NOW(), 1, v_user_admin)
    RETURNING id INTO v_content_cv4;
    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_cv4, v_site1, TRUE);

    INSERT INTO cv_entries (content_id, company, location, start_date, entry_type, display_order)
    VALUES (v_content_cv4, 'Amazon Web Services', 'Online', '2024-03-15', 'certification', 3)
    RETURNING id INTO v_cv4;

    INSERT INTO cv_entry_localizations (cv_entry_id, locale_id, position, description) VALUES
        (v_cv4, v_locale_en, 'AWS Solutions Architect Associate', 'Cloud architecture design, high availability, and cost optimization.');

    INSERT INTO cv_entry_skills (cv_entry_id, skill_id, relevance_score) VALUES
        (v_cv4, v_skill_aws, 5), (v_cv4, v_skill_docker, 3);

    -- ========================================================================
    -- LEGAL DOCUMENTS (Site 1)
    -- ========================================================================
    -- Cookie Consent
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_legal, v_env_dev, 'cookie-consent', 'published', NOW() - INTERVAL '30 days', 1, v_user_admin)
    RETURNING id INTO v_content_legal_cookie1;
    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_legal_cookie1, v_site1, TRUE);

    INSERT INTO legal_documents (content_id, cookie_name, document_type)
    VALUES (v_content_legal_cookie1, 'cookie_consent', 'cookie_consent')
    RETURNING id INTO v_legal_cookie1;

    INSERT INTO legal_document_localizations (legal_document_id, locale_id, title, intro) VALUES
        (v_legal_cookie1, v_locale_en, 'Cookie Settings', 'We use cookies to improve your experience. Choose which cookies you allow.'),
        (v_legal_cookie1, v_locale_de, 'Cookie-Einstellungen', 'Wir verwenden Cookies um Ihre Erfahrung zu verbessern. Wählen Sie, welche Cookies Sie zulassen.');

    INSERT INTO legal_groups (legal_document_id, cookie_name, display_order, is_required, default_enabled)
    VALUES (v_legal_cookie1, 'essential', 0, TRUE, TRUE)
    RETURNING id INTO v_lg_essential1;

    INSERT INTO legal_group_localizations (legal_group_id, locale_id, title, description) VALUES
        (v_lg_essential1, v_locale_en, 'Essential Cookies', 'Required for the website to function. Cannot be disabled.'),
        (v_lg_essential1, v_locale_de, 'Essenzielle Cookies', 'Für die Funktion der Website erforderlich. Kann nicht deaktiviert werden.');

    INSERT INTO legal_items (legal_group_id, cookie_name, display_order, is_required)
    VALUES (v_lg_essential1, 'session_id', 0, TRUE)
    RETURNING id INTO v_li_session1;

    INSERT INTO legal_item_localizations (legal_item_id, locale_id, title, content) VALUES
        (v_li_session1, v_locale_en, 'Session Cookie', '[{"type":"paragraph","text":"Maintains your session while browsing. Expires when you close your browser."}]'::jsonb),
        (v_li_session1, v_locale_de, 'Session-Cookie', '[{"type":"paragraph","text":"Erhält Ihre Sitzung beim Surfen. Läuft ab wenn Sie den Browser schließen."}]'::jsonb);

    INSERT INTO legal_groups (legal_document_id, cookie_name, display_order, is_required, default_enabled)
    VALUES (v_legal_cookie1, 'analytics', 1, FALSE, FALSE)
    RETURNING id INTO v_lg_analytics1;

    INSERT INTO legal_group_localizations (legal_group_id, locale_id, title, description) VALUES
        (v_lg_analytics1, v_locale_en, 'Analytics', 'Help us understand how visitors use our site.'),
        (v_lg_analytics1, v_locale_de, 'Analyse', 'Helfen Sie uns zu verstehen wie Besucher unsere Seite nutzen.');

    INSERT INTO legal_items (legal_group_id, cookie_name, display_order, is_required)
    VALUES (v_lg_analytics1, '_ga', 0, FALSE)
    RETURNING id INTO v_li_ga1;

    INSERT INTO legal_item_localizations (legal_item_id, locale_id, title, content) VALUES
        (v_li_ga1, v_locale_en, 'Google Analytics', '[{"type":"paragraph","text":"Collects anonymous usage statistics. Retained for 26 months."}]'::jsonb);

    -- Privacy Policy
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_legal, v_env_dev, 'privacy-policy', 'published', NOW() - INTERVAL '30 days', 1, v_user_admin)
    RETURNING id INTO v_content_legal_privacy1;
    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_legal_privacy1, v_site1, TRUE);

    INSERT INTO legal_documents (content_id, cookie_name, document_type)
    VALUES (v_content_legal_privacy1, 'privacy_policy', 'privacy_policy')
    RETURNING id INTO v_legal_privacy1;

    INSERT INTO legal_document_localizations (legal_document_id, locale_id, title, intro) VALUES
        (v_legal_privacy1, v_locale_en, 'Privacy Policy', 'This privacy policy explains how we collect, use, and protect your personal data.'),
        (v_legal_privacy1, v_locale_de, 'Datenschutzerklärung', 'Diese Datenschutzerklärung erläutert, wie wir Ihre personenbezogenen Daten erheben, verwenden und schützen.');

    -- Imprint (Site 1)
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_legal, v_env_dev, 'imprint', 'published', NOW() - INTERVAL '30 days', 1, v_user_admin)
    RETURNING id INTO v_tmp_content;
    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_tmp_content, v_site1, TRUE);

    INSERT INTO legal_documents (content_id, cookie_name, document_type)
    VALUES (v_tmp_content, 'imprint_main', 'imprint')
    RETURNING id INTO v_tmp_id;

    INSERT INTO legal_document_localizations (legal_document_id, locale_id, title, intro) VALUES
        (v_tmp_id, v_locale_en, 'Imprint', E'## Site Operator\n\nJohn Doe\nMusterstraße 1\n1010 Vienna, Austria\n\n**Email:** hello@johndoe.dev\n\n## Disclaimer\n\nThe contents of this website have been created with the utmost care. However, no guarantee can be given for the correctness, completeness, and timeliness of the content.'),
        (v_tmp_id, v_locale_de, 'Impressum', E'## Betreiber\n\nJohn Doe\nMusterstraße 1\n1010 Wien, Österreich\n\n**E-Mail:** hello@johndoe.dev\n\n## Haftungsausschluss\n\nDie Inhalte dieser Website wurden mit größtmöglicher Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte kann jedoch keine Gewähr übernommen werden.');

    -- Cookie Consent for Site 2 (minimal)
    INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
    VALUES (v_et_legal, v_env_dev, 'cookie-consent-tb', 'published', NOW() - INTERVAL '20 days', 1, v_user_editor)
    RETURNING id INTO v_content_legal_cookie2;
    INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_content_legal_cookie2, v_site2, TRUE);

    INSERT INTO legal_documents (content_id, cookie_name, document_type)
    VALUES (v_content_legal_cookie2, 'cookie_consent', 'cookie_consent')
    RETURNING id INTO v_legal_cookie2;

    INSERT INTO legal_document_localizations (legal_document_id, locale_id, title, intro) VALUES
        (v_legal_cookie2, v_locale_en, 'Cookie Preferences', 'TechBites uses cookies for analytics and personalization.');

    INSERT INTO legal_groups (legal_document_id, cookie_name, display_order, is_required, default_enabled)
    VALUES (v_legal_cookie2, 'essential', 0, TRUE, TRUE)
    RETURNING id INTO v_lg_essential2;

    INSERT INTO legal_group_localizations (legal_group_id, locale_id, title, description) VALUES
        (v_lg_essential2, v_locale_en, 'Essential', 'Required for site functionality.');

    INSERT INTO legal_items (legal_group_id, cookie_name, display_order, is_required)
    VALUES (v_lg_essential2, 'tb_session', 0, TRUE)
    RETURNING id INTO v_li_session2;

    INSERT INTO legal_item_localizations (legal_item_id, locale_id, title, content) VALUES
        (v_li_session2, v_locale_en, 'Session', '[{"type":"paragraph","text":"Session identifier for browsing."}]'::jsonb);

    -- ========================================================================
    -- SOCIAL LINKS
    -- ========================================================================
    INSERT INTO social_links (site_id, title, url, icon, alt_text, display_order) VALUES
        (v_site1, 'GitHub',    'https://github.com/johndoe',       'github',    'GitHub profile',     0),
        (v_site1, 'LinkedIn',  'https://linkedin.com/in/johndoe',   'linkedin',  'LinkedIn profile',   1),
        (v_site1, 'X/Twitter', 'https://x.com/johndoe',                 'twitter',   'X profile',          2),
        (v_site1, 'Email',     'mailto:john@johndoe.dev',               'mail',      'Send email',         3),
        (v_site2, 'GitHub',    'https://github.com/techbites',                 'github',    'TechBites GitHub',   0),
        (v_site2, 'RSS',       'https://techbites.io/rss.xml',                'rss',       'RSS Feed',           1);

    -- ========================================================================
    -- WEBHOOKS
    -- ========================================================================
    INSERT INTO webhooks (site_id, url, secret, description, events, is_active)
    VALUES (v_site1, 'https://hooks.example.com/cms/site1', 'whsec_s1_dev_00000000', 'Deploy trigger for site1', ARRAY['content.published','content.updated'], TRUE)
    RETURNING id INTO v_webhook1;

    INSERT INTO webhooks (site_id, url, secret, description, events, is_active)
    VALUES (v_site1, 'https://hooks.example.com/cms/site1-slack', 'whsec_s1_slack_00000000', 'Slack notification for site1', ARRAY['blog.published'], TRUE)
    RETURNING id INTO v_webhook2;

    INSERT INTO webhooks (site_id, url, secret, description, events, is_active)
    VALUES (v_site2, 'https://hooks.example.com/cms/site2', 'whsec_s2_dev_00000000', 'Deploy trigger for site2', ARRAY['content.published','content.updated','content.deleted'], FALSE)
    RETURNING id INTO v_webhook3;

    -- Webhook deliveries
    INSERT INTO webhook_deliveries (webhook_id, event_type, payload, status_code, response_body, attempt_number, delivered_at) VALUES
        (v_webhook1, 'content.published', '{"content_id":"00000000-0000-0000-0000-000000000001","slug":"building-cms-rust-wasm","type":"blog"}'::jsonb, 200, '{"ok":true}', 1, NOW() - INTERVAL '14 days'),
        (v_webhook1, 'content.updated',   '{"content_id":"00000000-0000-0000-0000-000000000001","slug":"building-cms-rust-wasm","type":"blog"}'::jsonb, 200, '{"ok":true}', 1, NOW() - INTERVAL '10 days'),
        (v_webhook2, 'blog.published',    '{"content_id":"00000000-0000-0000-0000-000000000005","slug":"zero-cost-abstractions-rust","type":"blog"}'::jsonb, 200, '{"ok":true,"channel":"#content"}', 1, NOW() - INTERVAL '5 days'),
        (v_webhook1, 'content.published', '{"content_id":"00000000-0000-0000-0000-000000000006","slug":"multi-tenant-database-schema","type":"blog"}'::jsonb, NULL, NULL, 1, NOW() - INTERVAL '2 days');

    -- ========================================================================
    -- REDIRECTS
    -- ========================================================================
    INSERT INTO redirects (site_id, source_path, destination_path, status_code, is_active, description) VALUES
        (v_site1, '/blog/old-rust-article',    '/blog/building-cms-rust-wasm',        301, TRUE,  'Renamed Rust blog slug'),
        (v_site1, '/about-me',                 '/about',                              301, TRUE,  'Consolidated about pages'),
        (v_site1, '/posts',                    '/blog',                               302, TRUE,  'Temporary redirect during migration'),
        (v_site2, '/news',                     '/articles',                           301, TRUE,  'Renamed news section'),
        (v_site2, '/legacy-feed',              '/rss.xml',                            301, FALSE, 'Disabled legacy feed redirect');

    -- ========================================================================
    -- NOTIFICATIONS
    -- ========================================================================
    INSERT INTO notifications (site_id, recipient_clerk_id, actor_clerk_id, notification_type, entity_type, entity_id, title, message, is_read, read_at, created_at) VALUES
        (v_site1, 'user_admin_clerk_id',  'user_editor_clerk_id', 'comment',  'blog', v_content_blog1, 'New comment on your blog post',           'Sarah left a comment on "Building a Headless CMS with Rust and WebAssembly".', TRUE,  NOW() - INTERVAL '12 days', NOW() - INTERVAL '13 days'),
        (v_site1, 'user_admin_clerk_id',  NULL,                   'system',   'blog', v_content_blog5, 'Blog post published successfully',        'Your blog post "Zero-Cost Abstractions in Rust" is now live.',                 TRUE,  NOW() - INTERVAL '4 days',  NOW() - INTERVAL '5 days'),
        (v_site1, 'user_admin_clerk_id',  'user_editor_clerk_id', 'mention',  'blog', v_content_blog6, 'You were mentioned in a comment',         'Sarah mentioned you in a comment on "Multi-Tenant Database Schema".',           FALSE, NULL,                        NOW() - INTERVAL '1 day'),
        (v_site2, 'user_editor_clerk_id', 'user_admin_clerk_id',  'approval', 'blog', v_content_blog4, 'Blog post ready for review',              'John submitted "AI-Powered Code Review" for your review.',                     FALSE, NULL,                        NOW() - INTERVAL '6 hours'),
        (v_site2, 'user_editor_clerk_id', NULL,                   'system',   'page', v_content_page_home2, 'Scheduled maintenance completed', 'System maintenance finished. All services operational.',                        FALSE, NULL,                        NOW() - INTERVAL '2 hours');

    -- ========================================================================
    -- NAVIGATION MENUS
    -- ========================================================================
    INSERT INTO navigation_menus (site_id, slug, description, max_depth)
    VALUES (v_site1, 'primary', 'Primary navigation menu', 3) RETURNING id INTO v_menu_primary1;
    INSERT INTO navigation_menu_localizations (navigation_menu_id, locale_id, name) VALUES
        (v_menu_primary1, v_locale_en, 'Primary'), (v_menu_primary1, v_locale_de, 'Hauptmenü');

    INSERT INTO navigation_menus (site_id, slug, description, max_depth)
    VALUES (v_site1, 'footer', 'Footer navigation links', 1) RETURNING id INTO v_menu_footer1;
    INSERT INTO navigation_menu_localizations (navigation_menu_id, locale_id, name) VALUES
        (v_menu_footer1, v_locale_en, 'Footer'), (v_menu_footer1, v_locale_de, 'Fußzeile');

    INSERT INTO navigation_menus (site_id, slug, description, max_depth)
    VALUES (v_site2, 'primary', 'Primary navigation menu', 3) RETURNING id INTO v_menu_primary2;
    INSERT INTO navigation_menu_localizations (navigation_menu_id, locale_id, name) VALUES
        (v_menu_primary2, v_locale_en, 'Primary');

    -- ========================================================================
    -- NAVIGATION ITEMS (Site 1 - Primary Menu)
    -- ========================================================================
    INSERT INTO navigation_items (site_id, menu_id, page_id, display_order)
    VALUES (v_site1, v_menu_primary1, v_page_home1, 0) RETURNING id INTO v_nav_home1;
    INSERT INTO navigation_item_localizations (navigation_item_id, locale_id, title) VALUES
        (v_nav_home1, v_locale_en, 'Home'), (v_nav_home1, v_locale_de, 'Start');

    INSERT INTO navigation_items (site_id, menu_id, page_id, display_order)
    VALUES (v_site1, v_menu_primary1, v_page_about1, 1) RETURNING id INTO v_nav_about1;
    INSERT INTO navigation_item_localizations (navigation_item_id, locale_id, title) VALUES
        (v_nav_about1, v_locale_en, 'About'), (v_nav_about1, v_locale_de, 'Über mich');

    INSERT INTO navigation_items (site_id, menu_id, external_url, icon, display_order)
    VALUES (v_site1, v_menu_primary1, '/blog', 'book-open', 2) RETURNING id INTO v_nav_blog1;
    INSERT INTO navigation_item_localizations (navigation_item_id, locale_id, title) VALUES
        (v_nav_blog1, v_locale_en, 'Blog'), (v_nav_blog1, v_locale_de, 'Blog');

    INSERT INTO navigation_items (site_id, menu_id, page_id, display_order)
    VALUES (v_site1, v_menu_primary1, v_page_contact1, 3) RETURNING id INTO v_nav_contact1;
    INSERT INTO navigation_item_localizations (navigation_item_id, locale_id, title) VALUES
        (v_nav_contact1, v_locale_en, 'Contact'), (v_nav_contact1, v_locale_de, 'Kontakt');

    -- Navigation Items (Site 1 - Footer Menu)
    INSERT INTO navigation_items (site_id, menu_id, external_url, display_order)
    VALUES (v_site1, v_menu_footer1, '/legal/privacy-policy', 0) RETURNING id INTO v_tmp_id;
    INSERT INTO navigation_item_localizations (navigation_item_id, locale_id, title) VALUES
        (v_tmp_id, v_locale_en, 'Privacy'), (v_tmp_id, v_locale_de, 'Datenschutz');

    INSERT INTO navigation_items (site_id, menu_id, external_url, display_order)
    VALUES (v_site1, v_menu_footer1, '/legal/imprint', 1) RETURNING id INTO v_tmp_id;
    INSERT INTO navigation_item_localizations (navigation_item_id, locale_id, title) VALUES
        (v_tmp_id, v_locale_en, 'Imprint'), (v_tmp_id, v_locale_de, 'Impressum');

    INSERT INTO navigation_items (site_id, menu_id, external_url, display_order)
    VALUES (v_site1, v_menu_footer1, '/rss', 2) RETURNING id INTO v_tmp_id;
    INSERT INTO navigation_item_localizations (navigation_item_id, locale_id, title) VALUES
        (v_tmp_id, v_locale_en, 'RSS Feed'), (v_tmp_id, v_locale_de, 'RSS-Feed');

    INSERT INTO navigation_items (site_id, menu_id, external_url, open_in_new_tab, icon, display_order)
    VALUES (v_site1, v_menu_footer1, 'https://github.com/johndoe', TRUE, 'github', 3) RETURNING id INTO v_tmp_id;
    INSERT INTO navigation_item_localizations (navigation_item_id, locale_id, title) VALUES
        (v_tmp_id, v_locale_en, 'GitHub'), (v_tmp_id, v_locale_de, 'GitHub');

    -- Navigation Items (Site 2 - Primary Menu)
    INSERT INTO navigation_items (site_id, menu_id, page_id, display_order)
    VALUES (v_site2, v_menu_primary2, v_page_home2, 0) RETURNING id INTO v_nav_home2;
    INSERT INTO navigation_item_localizations (navigation_item_id, locale_id, title) VALUES
        (v_nav_home2, v_locale_en, 'Home');

    INSERT INTO navigation_items (site_id, menu_id, page_id, display_order)
    VALUES (v_site2, v_menu_primary2, v_page_blog_idx2, 1) RETURNING id INTO v_nav_articles2;
    INSERT INTO navigation_item_localizations (navigation_item_id, locale_id, title) VALUES
        (v_nav_articles2, v_locale_en, 'Articles');

    -- ========================================================================
    -- MEDIA FOLDERS (Site 1)
    -- ========================================================================
    INSERT INTO media_folders (site_id, name, display_order)
    VALUES (v_site1, 'Blog Covers', 0)
    RETURNING id INTO v_mfolder_covers1;

    INSERT INTO media_folders (site_id, name, display_order)
    VALUES (v_site1, 'Logos', 1)
    RETURNING id INTO v_mfolder_logos1;

    -- Assign existing media to folders
    UPDATE media_files SET folder_id = v_mfolder_covers1 WHERE id IN (v_media_blog1_cover, v_media_blog2_cover);
    UPDATE media_files SET folder_id = v_mfolder_logos1 WHERE id IN (v_media_logo1);

    -- ========================================================================
    -- DOCUMENT FOLDERS (Site 1)
    -- ========================================================================
    INSERT INTO document_folders (site_id, name, display_order)
    VALUES (v_site1, 'Guides', 0)
    RETURNING id INTO v_doc_folder_guides1;

    INSERT INTO document_folders (site_id, name, display_order)
    VALUES (v_site1, 'Specifications', 1)
    RETURNING id INTO v_doc_folder_specs1;

    -- ========================================================================
    -- DOCUMENTS (Site 1)
    -- ========================================================================
    INSERT INTO documents (site_id, folder_id, url, document_type, display_order)
    VALUES (v_site1, v_doc_folder_guides1, 'https://doc.rust-lang.org/book/', 'link', 0)
    RETURNING id INTO v_doc_rust_guide1;

    INSERT INTO document_localizations (document_id, locale_id, name, description) VALUES
        (v_doc_rust_guide1, v_locale_en, 'The Rust Programming Language', 'Official Rust book — a comprehensive guide to learning Rust from scratch.'),
        (v_doc_rust_guide1, v_locale_de, 'Die Programmiersprache Rust', 'Offizielles Rust-Buch — ein umfassender Leitfaden zum Erlernen von Rust.');

    INSERT INTO documents (site_id, folder_id, url, document_type, display_order)
    VALUES (v_site1, v_doc_folder_specs1, 'https://webassembly.github.io/spec/core/', 'link', 0)
    RETURNING id INTO v_doc_wasm_spec1;

    INSERT INTO document_localizations (document_id, locale_id, name, description) VALUES
        (v_doc_wasm_spec1, v_locale_en, 'WebAssembly Core Specification', 'The official W3C WebAssembly specification document.'),
        (v_doc_wasm_spec1, v_locale_de, 'WebAssembly Kernspezifikation', 'Das offizielle W3C WebAssembly-Spezifikationsdokument.');

    INSERT INTO documents (site_id, url, document_type, display_order)
    VALUES (v_site1, 'https://docs.docker.com/compose/compose-file/', 'link', 1)
    RETURNING id INTO v_doc_docker_cheat1;

    INSERT INTO document_localizations (document_id, locale_id, name, description) VALUES
        (v_doc_docker_cheat1, v_locale_en, 'Docker Compose File Reference', 'Complete reference for the docker-compose.yml file format.');

    -- Sample uploaded document (small text file stored as BYTEA)
    INSERT INTO documents (site_id, folder_id, url, document_type, display_order,
                           file_data, file_name, file_size, mime_type)
    VALUES (v_site1, v_doc_folder_guides1, NULL, 'other', 2,
            E'\\x48656c6c6f20576f726c6421', 'hello.txt', 12, 'text/plain')
    RETURNING id INTO v_doc_sample_upload;

    INSERT INTO document_localizations (document_id, locale_id, name, description) VALUES
        (v_doc_sample_upload, v_locale_en, 'Sample Upload', 'A sample uploaded text file for testing.');

    -- ========================================================================
    -- BLOG ↔ DOCUMENT ATTACHMENTS
    -- ========================================================================
    -- Attach Rust guide and WASM spec to blog 1 (Rust + WASM blog)
    INSERT INTO blog_documents (blog_id, document_id, display_order) VALUES
        (v_blog1, v_doc_rust_guide1, 0),
        (v_blog1, v_doc_wasm_spec1, 1);

    -- Attach Docker reference to blog 3 (Docker Compose blog)
    INSERT INTO blog_documents (blog_id, document_id, display_order) VALUES
        (v_blog3, v_doc_docker_cheat1, 0);

    -- ========================================================================
    -- BULK GENERATION — Pagination test data
    -- ========================================================================
    -- Adds gen-* prefixed rows to push every paginated entity past page_size=25

    -- ── Tags (28 more → 35 total) ──────────────────────────────────────────
    FOR v_i IN 1..28 LOOP
        INSERT INTO tags (slug, is_global) VALUES (
            (ARRAY['nextjs','python','kubernetes','terraform','graphql','svelte','vue','angular',
                   'redis','mongodb','elasticsearch','nginx','linux','git','aws-lambda','vercel',
                   'cloudflare','tailwind','sass','webpack','vite','esbuild','pnpm','bun',
                   'deno','htmx','astro','solid'])[v_i],
            v_i % 5 = 0
        ) RETURNING id INTO v_tmp_id;
        IF v_i % 3 = 0 THEN
            INSERT INTO tag_sites (tag_id, site_id) VALUES (v_tmp_id, v_site1);
            INSERT INTO tag_sites (tag_id, site_id) VALUES (v_tmp_id, v_site2);
        ELSIF v_i % 2 = 0 THEN
            INSERT INTO tag_sites (tag_id, site_id) VALUES (v_tmp_id, v_site2);
        ELSE
            INSERT INTO tag_sites (tag_id, site_id) VALUES (v_tmp_id, v_site1);
        END IF;
        INSERT INTO tag_localizations (tag_id, locale_id, name)
        VALUES (v_tmp_id, v_locale_en,
            (ARRAY['Next.js','Python','Kubernetes','Terraform','GraphQL','Svelte','Vue','Angular',
                   'Redis','MongoDB','Elasticsearch','Nginx','Linux','Git','AWS Lambda','Vercel',
                   'Cloudflare','Tailwind CSS','Sass','Webpack','Vite','esbuild','pnpm','Bun',
                   'Deno','htmx','Astro','SolidJS'])[v_i]
        );
    END LOOP;

    -- ── Categories (26 more → 30 total) ────────────────────────────────────
    FOR v_i IN 1..26 LOOP
        INSERT INTO categories (slug, is_global) VALUES (
            (ARRAY['cloud','security','performance','testing','architecture','mobile',
                   'data-science','machine-learning','open-source','tooling','career',
                   'databases','networking','web-standards','accessibility','design-systems',
                   'api-design','observability','edge-computing','serverless','low-level',
                   'embedded','game-dev','blockchain','platform-engineering','developer-experience'])[v_i],
            v_i % 7 = 0
        ) RETURNING id INTO v_tmp_id;
        IF v_i % 3 = 0 THEN
            INSERT INTO category_sites (category_id, site_id) VALUES (v_tmp_id, v_site1);
            INSERT INTO category_sites (category_id, site_id) VALUES (v_tmp_id, v_site2);
        ELSIF v_i % 2 = 0 THEN
            INSERT INTO category_sites (category_id, site_id) VALUES (v_tmp_id, v_site2);
        ELSE
            INSERT INTO category_sites (category_id, site_id) VALUES (v_tmp_id, v_site1);
        END IF;
        INSERT INTO category_localizations (category_id, locale_id, name, description)
        VALUES (v_tmp_id, v_locale_en,
            (ARRAY['Cloud','Security','Performance','Testing','Architecture','Mobile',
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
        );
    END LOOP;

    -- ── Skills (28 more → 35 total) ────────────────────────────────────────
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
        INSERT INTO skill_sites (skill_id, site_id) VALUES (v_tmp_id, v_site1);
        IF v_i % 3 = 0 THEN
            INSERT INTO skill_sites (skill_id, site_id) VALUES (v_tmp_id, v_site2);
        END IF;
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
        );
    END LOOP;

    -- ── Media files (32 more → 40 total) ───────────────────────────────────
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
            CASE WHEN v_i % 2 = 0 THEN v_user_admin ELSE v_user_editor END,
            v_env_dev,
            v_i % 10 = 0
        ) RETURNING id INTO v_tmp_id;
        IF v_i <= 20 THEN
            INSERT INTO media_sites (media_file_id, site_id) VALUES (v_tmp_id, v_site1);
        ELSE
            INSERT INTO media_sites (media_file_id, site_id) VALUES (v_tmp_id, v_site2);
        END IF;
        INSERT INTO media_metadata (media_file_id, locale_id, alt_text, title)
        VALUES (v_tmp_id, v_locale_en, 'Generated media ' || v_i, 'Media ' || v_i);
    END LOOP;

    -- ── Documents (26 more → 30 total) ─────────────────────────────────────
    FOR v_i IN 1..26 LOOP
        INSERT INTO documents (site_id, url, document_type, display_order) VALUES (
            CASE WHEN v_i % 3 = 0 THEN v_site2 ELSE v_site1 END,
            'https://example.com/docs/gen-doc-' || v_i,
            CASE v_i % 3 WHEN 0 THEN 'link' WHEN 1 THEN 'link' ELSE 'link' END,
            v_i + 10
        ) RETURNING id INTO v_tmp_id;
        INSERT INTO document_localizations (document_id, locale_id, name, description)
        VALUES (v_tmp_id, v_locale_en, 'Document ' || v_i, 'Auto-generated document for pagination testing');
    END LOOP;

    -- ── Blogs — site 1 (28 more → 34 total) ───────────────────────────────
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
            (CASE WHEN v_i % 5 = 0 THEN 'draft' ELSE 'published' END)::content_status,
            CASE WHEN v_i % 5 = 0 THEN NULL ELSE NOW() - (v_i || ' days')::INTERVAL END,
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
            'John Doe',
            ('2026-01-01'::DATE + (v_i || ' days')::INTERVAL)::DATE,
            (v_i % 15) + 2,
            v_i % 10 = 0
        );
    END LOOP;

    -- ── Blogs — site 2 (18 more → 20 total) ───────────────────────────────
    FOR v_i IN 1..18 LOOP
        INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by, updated_by)
        VALUES (
            v_et_blog, v_env_dev,
            (ARRAY[
                'github-actions-rust-projects','rate-limiting-apis-redis-lua',
                'optimizing-docker-image-sizes','graphql-vs-rest-comparison',
                'feature-flags-production-systems','zero-downtime-database-migrations',
                'monitoring-microservices-opentelemetry','writing-effective-technical-docs',
                'securing-apis-oauth2-jwts','github-actions-advanced-caching',
                'redis-lua-sliding-window','docker-multi-stage-alpine',
                'graphql-federation-gateway','feature-flags-percentage-rollouts',
                'expand-contract-migrations','opentelemetry-custom-metrics',
                'documentation-as-code','oauth2-pkce-spa-security'
            ])[v_i],
            (CASE WHEN v_i % 4 = 0 THEN 'draft' ELSE 'published' END)::content_status,
            CASE WHEN v_i % 4 = 0 THEN NULL ELSE NOW() - (v_i || ' days')::INTERVAL END,
            1, v_user_editor, v_user_editor
        ) RETURNING id INTO v_tmp_content;
        INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_tmp_content, v_site2, TRUE);
        INSERT INTO content_localizations (content_id, locale_id, title, excerpt, body, translation_status)
        VALUES (v_tmp_content, v_locale_en,
            CASE (v_i - 1) % 9
                WHEN 0 THEN 'GitHub Actions for Rust Projects'
                WHEN 1 THEN 'Rate Limiting APIs with Redis and Lua'
                WHEN 2 THEN 'Optimizing Docker Image Sizes'
                WHEN 3 THEN 'GraphQL vs REST: When to Use Which'
                WHEN 4 THEN 'Feature Flags in Production Systems'
                WHEN 5 THEN 'Database Migration Strategies for Zero Downtime'
                WHEN 6 THEN 'Monitoring Microservices with OpenTelemetry'
                WHEN 7 THEN 'Writing Effective Technical Documentation'
                ELSE        'Securing APIs with OAuth 2.0 and JWTs'
            END,
            CASE (v_i - 1) % 9
                WHEN 0 THEN 'Set up CI/CD for your Rust project with GitHub Actions.'
                WHEN 1 THEN 'Implement distributed rate limiting using Redis and Lua scripts.'
                WHEN 2 THEN 'Techniques for reducing Docker image sizes by up to 90%.'
                WHEN 3 THEN 'A practical comparison of GraphQL and REST API approaches.'
                WHEN 4 THEN 'Roll out features safely with feature flags in production.'
                WHEN 5 THEN 'Migrate your database schema without any downtime.'
                WHEN 6 THEN 'Instrument your microservices with OpenTelemetry for observability.'
                WHEN 7 THEN 'Write docs that developers actually read and find useful.'
                ELSE        'Protect your APIs with industry-standard OAuth 2.0 flows.'
            END,
            CASE (v_i - 1) % 9
                WHEN 0 THEN E'## GitHub Actions for Rust\n\nA well-configured CI pipeline catches bugs before they hit main. Here''s the GitHub Actions workflow we use for every Rust project at TechBites.\n\n```yaml\non: [push, pull_request]\njobs:\n  check:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: dtolnay/rust-toolchain@stable\n      - run: cargo check --all-targets\n      - run: cargo test\n      - run: cargo clippy -- -D warnings\n```\n\n### Caching\n\nUse `actions/cache` to speed up builds by caching `target/` and the cargo registry.'
                WHEN 1 THEN E'## Rate Limiting with Redis\n\nEvery public API needs rate limiting. Redis makes it fast and distributed.\n\n### Sliding Window Algorithm\n\n```lua\nlocal key = KEYS[1]\nlocal window = tonumber(ARGV[1])\nlocal limit = tonumber(ARGV[2])\nlocal now = tonumber(ARGV[3])\nredis.call("ZREMRANGEBYSCORE", key, 0, now - window)\nlocal count = redis.call("ZCARD", key)\nif count < limit then\n  redis.call("ZADD", key, now, now .. math.random())\n  return 1\nend\nreturn 0\n```\n\nThis Lua script runs atomically inside Redis — no race conditions.'
                WHEN 2 THEN E'## Docker Image Optimization\n\nA 1.2 GB Docker image is not a badge of honor. Here''s how to shrink it to under 50 MB.\n\n### Multi-Stage Builds\n\n```dockerfile\nFROM node:20-alpine AS builder\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --production\nCOPY . .\nRUN npm run build\n\nFROM node:20-alpine\nCOPY --from=builder /app/dist ./dist\nCOPY --from=builder /app/node_modules ./node_modules\nCMD ["node", "dist/index.js"]\n```\n\n### Key Techniques\n\n- Alpine base images (5 MB vs 900 MB)\n- `.dockerignore` to exclude `node_modules`, `.git`\n- `npm ci --production` to skip devDependencies'
                WHEN 3 THEN E'## GraphQL vs REST\n\nThe GraphQL vs REST debate often misses the point. The right choice depends on your use case.\n\n### When REST Wins\n\n- Simple CRUD APIs with predictable access patterns\n- Public APIs where caching matters (HTTP caching is built-in)\n- Teams without GraphQL expertise\n\n### When GraphQL Wins\n\n- Mobile apps that need to minimize network requests\n- Dashboards that aggregate data from multiple entities\n- Rapidly evolving frontends that need flexible queries\n\n### The Hybrid Approach\n\nMany teams use REST for public APIs and GraphQL for internal dashboard queries.'
                WHEN 4 THEN E'## Feature Flags\n\nFeature flags decouple deployment from release. Ship code to production without exposing it to users until you''re ready.\n\n### Implementation Patterns\n\n```typescript\nif (featureFlags.isEnabled("new-checkout", { userId })) {\n  return <NewCheckout />;\n}\nreturn <LegacyCheckout />;\n```\n\n### Best Practices\n\n- **Clean up old flags**: stale flags are tech debt\n- **Log flag evaluations**: know which users see what\n- **Use percentage rollouts**: start at 5%, monitor, then ramp to 100%'
                WHEN 5 THEN E'## Zero-Downtime Migrations\n\nSchema changes shouldn''t require maintenance windows. Here''s the expand-and-contract pattern.\n\n### The Pattern\n\n1. **Expand**: add the new column (nullable), deploy code that writes to both\n2. **Migrate**: backfill existing rows\n3. **Contract**: make the new column NOT NULL, drop the old one\n\n```sql\n-- Step 1: Expand\nALTER TABLE users ADD COLUMN email_normalized TEXT;\n\n-- Step 2: Backfill\nUPDATE users SET email_normalized = LOWER(email);\n\n-- Step 3: Contract (after code no longer reads old column)\nALTER TABLE users ALTER COLUMN email_normalized SET NOT NULL;\n```'
                WHEN 6 THEN E'## OpenTelemetry Monitoring\n\nOpenTelemetry provides a vendor-neutral way to instrument your services with traces, metrics, and logs.\n\n### Auto-Instrumentation\n\n```typescript\nimport { NodeSDK } from "@opentelemetry/sdk-node";\nimport { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";\n\nconst sdk = new NodeSDK({\n  traceExporter: new OTLPTraceExporter({ url: "http://jaeger:4318/v1/traces" }),\n});\nsdk.start();\n```\n\n### What to Instrument\n\n- HTTP handlers (request duration, status codes)\n- Database queries (query time, connection pool stats)\n- External API calls (latency, error rates)'
                WHEN 7 THEN E'## Technical Documentation\n\nThe best docs are written by the people who build the systems. Here''s how to make them useful.\n\n### The Four Types\n\n1. **Tutorials**: learning-oriented, step-by-step\n2. **How-to Guides**: task-oriented, practical\n3. **Reference**: information-oriented, precise\n4. **Explanation**: understanding-oriented, conceptual\n\n### Tips\n\n- Include runnable code examples\n- Keep docs next to code (in the repo, not a wiki)\n- Review docs in PRs like you review code\n- Use diagrams for architecture; text for procedures'
                ELSE        E'## OAuth 2.0 Security\n\nOAuth 2.0 is the industry standard for API authorization. But getting it right requires attention to detail.\n\n### The Authorization Code Flow (with PKCE)\n\nThis is the recommended flow for SPAs and mobile apps:\n\n1. Client generates a `code_verifier` and `code_challenge`\n2. User is redirected to the authorization server\n3. User logs in and consents\n4. Auth server redirects back with a `code`\n5. Client exchanges `code` + `code_verifier` for tokens\n\n### Token Storage\n\n- **Access tokens**: in-memory only (never localStorage)\n- **Refresh tokens**: httpOnly secure cookies\n- **ID tokens**: validate signature, check `aud` and `iss` claims'
            END,
            'approved');
        INSERT INTO blogs (content_id, author, published_date, reading_time_minutes) VALUES (
            v_tmp_content,
            (ARRAY['Sarah Chen','Marcus Rivera','Priya Patel','Sarah Chen','Marcus Rivera',
                   'Priya Patel','Sarah Chen','Marcus Rivera','Priya Patel'])[((v_i - 1) % 9) + 1],
            ('2026-01-10'::DATE + (v_i || ' days')::INTERVAL)::DATE,
            (v_i % 12) + 3
        );
    END LOOP;

    -- ── Pages — site 1 (12 more → 15 total) ───────────────────────────────
    FOR v_i IN 1..12 LOOP
        INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
        VALUES (
            v_et_page, v_env_dev,
            (ARRAY['projects','uses','speaking','bookshelf','now','changelog',
                   'resume','colophon','links','newsletter','snippets','hire-me'])[v_i],
            (CASE WHEN v_i % 6 = 0 THEN 'draft' ELSE 'published' END)::content_status,
            CASE WHEN v_i % 6 = 0 THEN NULL ELSE NOW() - (v_i || ' days')::INTERVAL END,
            1, v_user_admin
        ) RETURNING id INTO v_tmp_content;
        INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_tmp_content, v_site1, TRUE);
        INSERT INTO content_localizations (content_id, locale_id, title, body, translation_status)
        VALUES (v_tmp_content, v_locale_en,
            (ARRAY['Projects','Uses','Speaking','Bookshelf','Now','Changelog',
                   'Resume','Colophon','Links','Newsletter','Snippets','Hire Me'])[v_i],
            (ARRAY[
                E'## Projects\n\nA selection of open-source and personal projects I''ve built or contributed to.\n\n### OpenYapper\n\nA multi-tenant headless CMS built with Rust and React. Features editorial workflows, i18n, and a REST API.\n\n### rustfmt-action\n\nGitHub Action that checks Rust formatting in CI. 2.4k stars on GitHub.\n\n### pgvector-rs\n\nRust bindings for pgvector — vector similarity search in PostgreSQL.',
                E'## Uses\n\nThe tools, hardware, and software I use daily for development.\n\n### Editor\n\n- **Neovim** with lazy.nvim and a custom Rust LSP config\n- **VS Code** for TypeScript projects (with Vim keybindings)\n\n### Terminal\n\n- **Alacritty** + **tmux** with a custom theme\n- **Fish shell** with starship prompt\n\n### Hardware\n\n- MacBook Pro 16" M3 Max\n- LG 5K UltraFine monitor\n- Keychron Q1 with Gateron Browns',
                E'## Speaking\n\nI enjoy sharing knowledge at conferences and meetups.\n\n### Upcoming\n\n- **RustConf 2026** — "Building Multi-Tenant Systems in Rust" (June 2026)\n- **ViennaJS Meetup** — "Edge Computing with WASM" (April 2026)\n\n### Past Talks\n\n- **React Summit 2025** — "Server Components in Production"\n- **DevOps Vienna #42** — "Docker Compose Patterns for Dev Teams"',
                E'## Bookshelf\n\nBooks that shaped how I think about software.\n\n### Currently Reading\n\n- *Designing Data-Intensive Applications* by Martin Kleppmann\n\n### Favorites\n\n- *The Pragmatic Programmer* by Hunt & Thomas\n- *Programming Rust* by Blandy, Orendorff & Tindall\n- *A Philosophy of Software Design* by John Ousterhout\n- *Staff Engineer* by Will Larson',
                E'## Now\n\n*Updated February 2026*\n\n### Work\n\nLeading backend architecture at Acme Corp. Currently migrating payment processing to Rust microservices.\n\n### Side Projects\n\nBuilding OpenYapper — a headless CMS for developer portfolios. Writing a blog series on multi-tenant database patterns.\n\n### Learning\n\nDeep-diving into WebAssembly component model and WASI preview 2.',
                E'## Changelog\n\nA log of notable changes to this site.\n\n### 2026-02-15\n\n- Added dark mode toggle\n- Migrated from Strapi to OpenYapper for content\n\n### 2026-01-20\n\n- Redesigned blog layout with reading time estimates\n- Added RSS feed support\n\n### 2025-12-01\n\n- Launched the site with Next.js App Router\n- Added i18n support for English and German',
                E'## Resume\n\nDownload my resume as PDF or view it inline.\n\n### Summary\n\n8+ years of full-stack experience across fintech, e-commerce, and developer tools. Specialized in Rust backend systems and React frontends.\n\n### Core Skills\n\nRust, TypeScript, React, PostgreSQL, Docker, AWS\n\n### Certifications\n\n- AWS Solutions Architect Associate (2024)\n- Certified Kubernetes Administrator (2023)',
                E'## Colophon\n\nHow this site is built.\n\n### Stack\n\n- **Frontend**: Next.js 14 with App Router, SCSS modules\n- **CMS**: OpenYapper (Rust + React)\n- **Database**: PostgreSQL 16\n- **Hosting**: Vercel (frontend), Fly.io (backend)\n- **Domain**: johndoe.dev via Cloudflare\n\n### Typography\n\nInter for body text, JetBrains Mono for code blocks.',
                E'## Links\n\nUseful links and resources I frequently share.\n\n### My Profiles\n\n- [GitHub](https://github.com/johndoe)\n- [LinkedIn](https://linkedin.com/in/johndoe)\n- [X/Twitter](https://x.com/johndoe)\n\n### Tools I Recommend\n\n- [Excalidraw](https://excalidraw.com) — whiteboard diagrams\n- [ray.so](https://ray.so) — beautiful code screenshots\n- [JSON Crack](https://jsoncrack.com) — JSON visualizer',
                E'## Newsletter\n\nI send a monthly email with my latest blog posts, interesting links, and behind-the-scenes updates on projects.\n\n### What to Expect\n\n- 1 email per month, no spam\n- Rust, TypeScript, and web development insights\n- Early access to new blog posts\n\n*Subscribe using the form below.*',
                E'## Snippets\n\nSmall, reusable code snippets I reach for often.\n\n### Rust: Quick HTTP Server\n\n```rust\n#[rocket::get("/health")]\nfn health() -> &''static str { "ok" }\n```\n\n### TypeScript: Deep Partial\n\n```typescript\ntype DeepPartial<T> = {\n  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];\n};\n```\n\n### SQL: Find Duplicate Rows\n\n```sql\nSELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1;\n```',
                E'## Hire Me\n\nI''m available for freelance and consulting work.\n\n### What I Offer\n\n- **Backend architecture**: Rust, Node.js, PostgreSQL\n- **Frontend development**: React, Next.js, TypeScript\n- **Performance audits**: profiling, optimization, caching strategies\n- **Code reviews**: security, architecture, best practices\n\n### Rates\n\nProject-based or hourly. Reach out at john@johndoe.dev for details.\n\n### Availability\n\nCurrently accepting projects starting April 2026.'
            ])[v_i],
            'approved');
        INSERT INTO pages (content_id, route, page_type, is_in_navigation, navigation_order) VALUES (
            v_tmp_content,
            '/' || (ARRAY['projects','uses','speaking','bookshelf','now','changelog',
                          'resume','colophon','links','newsletter','snippets','hire-me'])[v_i],
            (CASE v_i % 3 WHEN 0 THEN 'static' WHEN 1 THEN 'custom' ELSE 'static' END)::page_type,
            v_i % 4 != 0,
            10 + v_i
        ) RETURNING id INTO v_tmp_id;

        -- Add page sections for key pages
        IF v_i = 1 THEN  -- /projects: hero + featured projects
            INSERT INTO page_sections (page_id, section_type, display_order, settings)
            VALUES (v_tmp_id, 'hero', 0, '{"fullWidth":true}'::jsonb) RETURNING id INTO v_tmp_content;
            INSERT INTO page_section_localizations (page_section_id, locale_id, title, text, button_text) VALUES
                (v_tmp_content, v_locale_en, 'Projects', 'Open source and personal projects I''ve built or contributed to.', 'View on GitHub');
            INSERT INTO page_sections (page_id, section_type, display_order, settings)
            VALUES (v_tmp_id, 'features', 1, '{"columns":3}'::jsonb) RETURNING id INTO v_tmp_content;
            INSERT INTO page_section_localizations (page_section_id, locale_id, title, text) VALUES
                (v_tmp_content, v_locale_en, 'Featured Work', 'A few highlights from recent and ongoing projects.');
        ELSIF v_i = 3 THEN  -- /speaking: hero + upcoming events
            INSERT INTO page_sections (page_id, section_type, display_order, settings)
            VALUES (v_tmp_id, 'hero', 0, '{}'::jsonb) RETURNING id INTO v_tmp_content;
            INSERT INTO page_section_localizations (page_section_id, locale_id, title, text) VALUES
                (v_tmp_content, v_locale_en, 'Speaking', 'I enjoy sharing knowledge at conferences and meetups.');
        ELSIF v_i = 7 THEN  -- /resume: hero + skills overview
            INSERT INTO page_sections (page_id, section_type, display_order, settings)
            VALUES (v_tmp_id, 'hero', 0, '{}'::jsonb) RETURNING id INTO v_tmp_content;
            INSERT INTO page_section_localizations (page_section_id, locale_id, title, text, button_text) VALUES
                (v_tmp_content, v_locale_en, 'Resume', '8+ years of full-stack experience across fintech, e-commerce, and developer tools.', 'Download PDF');
            INSERT INTO page_sections (page_id, section_type, display_order, settings)
            VALUES (v_tmp_id, 'features', 1, '{"columns":2}'::jsonb) RETURNING id INTO v_tmp_content;
            INSERT INTO page_section_localizations (page_section_id, locale_id, title, text) VALUES
                (v_tmp_content, v_locale_en, 'Core Skills', 'Rust, TypeScript, React, PostgreSQL, Docker, AWS, Kubernetes, CI/CD');
        ELSIF v_i = 10 THEN  -- /newsletter: hero + CTA
            INSERT INTO page_sections (page_id, section_type, display_order, settings)
            VALUES (v_tmp_id, 'hero', 0, '{}'::jsonb) RETURNING id INTO v_tmp_content;
            INSERT INTO page_section_localizations (page_section_id, locale_id, title, text) VALUES
                (v_tmp_content, v_locale_en, 'Newsletter', 'Monthly updates on Rust, TypeScript, and web development.');
            INSERT INTO page_sections (page_id, section_type, display_order, call_to_action_route)
            VALUES (v_tmp_id, 'cta', 1, '/contact') RETURNING id INTO v_tmp_content;
            INSERT INTO page_section_localizations (page_section_id, locale_id, title, text, button_text) VALUES
                (v_tmp_content, v_locale_en, 'Subscribe', '1 email per month, no spam. Unsubscribe anytime.', 'Sign up');
        ELSIF v_i = 12 THEN  -- /hire-me: hero + CTA
            INSERT INTO page_sections (page_id, section_type, display_order, settings)
            VALUES (v_tmp_id, 'hero', 0, '{}'::jsonb) RETURNING id INTO v_tmp_content;
            INSERT INTO page_section_localizations (page_section_id, locale_id, title, text) VALUES
                (v_tmp_content, v_locale_en, 'Hire Me', 'Available for freelance and consulting — backend, frontend, and architecture.');
            INSERT INTO page_sections (page_id, section_type, display_order, call_to_action_route)
            VALUES (v_tmp_id, 'cta', 1, '/contact') RETURNING id INTO v_tmp_content;
            INSERT INTO page_section_localizations (page_section_id, locale_id, title, text, button_text) VALUES
                (v_tmp_content, v_locale_en, 'Let''s Talk', 'Currently accepting projects starting April 2026.', 'Get in touch');
        END IF;
    END LOOP;

    -- ── Pages — site 2 (8 more → 10 total) ────────────────────────────────
    FOR v_i IN 1..8 LOOP
        INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
        VALUES (
            v_et_page, v_env_dev,
            (ARRAY['about','write-for-us','newsletter','sponsorship',
                   'code-of-conduct','editorial-guidelines','events','podcast'])[v_i],
            'published',
            NOW() - (v_i || ' days')::INTERVAL,
            1, v_user_editor
        ) RETURNING id INTO v_tmp_content;
        INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_tmp_content, v_site2, TRUE);
        INSERT INTO content_localizations (content_id, locale_id, title, body, translation_status)
        VALUES (v_tmp_content, v_locale_en,
            (ARRAY['About TechBites','Write for Us','Newsletter','Sponsorship',
                   'Code of Conduct','Editorial Guidelines','Events','The TechBites Podcast'])[v_i],
            (ARRAY[
                E'## About TechBites\n\nTechBites is a tech magazine for practitioners, not pundits. We publish bite-sized, actionable engineering articles written by developers who build real systems.\n\n### Our Mission\n\nCut through the hype. Every article includes working code, honest trade-off analysis, and zero filler.\n\n### The Team\n\n- **Sarah Chen** — Editor-in-Chief, backend engineer\n- **Marcus Rivera** — DevOps columnist\n- **Priya Patel** — Frontend correspondent',
                E'## Write for Us\n\nWe pay $300–$500 per published article. Here''s what we''re looking for.\n\n### Topics We Cover\n\n- Backend engineering (Rust, Go, Node.js, Python)\n- Frontend craft (React, Vue, Svelte, vanilla JS)\n- DevOps and infrastructure\n- Database design and optimization\n\n### Submission Process\n\n1. Send a 2-paragraph pitch to editors@techbites.io\n2. We respond within 48 hours\n3. If accepted, you write the draft in Markdown\n4. One round of editorial review\n5. Publication + payment within 30 days',
                E'## Newsletter\n\nThe TechBites Weekly — curated engineering articles delivered every Thursday.\n\n### What You Get\n\n- 3–5 top articles from the week\n- One "deep dive" recommendation\n- Tool of the week\n- Job board highlights\n\n12,000+ subscribers. No spam, unsubscribe anytime.',
                E'## Sponsorship\n\nReach 50,000+ monthly readers — software engineers, tech leads, and CTOs.\n\n### Packages\n\n- **Newsletter Sponsor**: $800/week — logo + 50-word blurb in our weekly email\n- **Article Sponsor**: $1,200 — "Sponsored by" banner on a single article\n- **Site Sponsor**: $3,000/month — logo in header, footer, and newsletter\n\nContact sponsors@techbites.io for media kit and availability.',
                E'## Code of Conduct\n\nTechBites is committed to providing a welcoming environment for everyone.\n\n### Our Standards\n\n- Be respectful and constructive in comments\n- No harassment, trolling, or personal attacks\n- Focus on technical content, not individuals\n- Report violations to conduct@techbites.io\n\n### Enforcement\n\nViolations may result in comment removal, account suspension, or permanent ban at editor discretion.',
                E'## Editorial Guidelines\n\nStandards every TechBites article must meet.\n\n### Structure\n\n- Lead with the problem, not the solution\n- Include runnable code examples\n- End with trade-offs and when NOT to use the approach\n\n### Style\n\n- Write in second person ("you") not third ("developers")\n- Keep sentences short — under 25 words\n- Use headers every 200–300 words\n- No clickbait titles — be specific\n\n### Technical Accuracy\n\nEvery code sample must compile/run. We verify.',
                E'## Events\n\nTechBites-organized and sponsored community events.\n\n### Upcoming\n\n- **TechBites Live: Rust in Production** — Virtual, March 2026\n- **Frontend Craft Meetup #8** — Berlin, April 2026\n- **DevOps Days Vienna** — Sponsor booth, May 2026\n\n### Past Events\n\n- TechBites Live: Docker Deep-Dive (Jan 2026) — 800 attendees\n- Frontend Craft Meetup #7 (Dec 2025) — 120 in-person',
                E'## The TechBites Podcast\n\nWeekly conversations with engineers building interesting things.\n\n### Latest Episodes\n\n- **Ep 47**: "Scaling PostgreSQL to 1M QPS" with Kelly Johnson\n- **Ep 46**: "Why We Rewrote Our API in Rust" with Darius Kazemi\n- **Ep 45**: "The State of WebAssembly in 2026" with Lin Clark\n\n### Where to Listen\n\nAvailable on Spotify, Apple Podcasts, and techbites.io/podcast.\n\n### Be a Guest\n\nBuilding something cool? Email podcast@techbites.io with a short intro.'
            ])[v_i],
            'approved');
        INSERT INTO pages (content_id, route, page_type, is_in_navigation, navigation_order) VALUES (
            v_tmp_content,
            '/' || (ARRAY['about','write-for-us','newsletter','sponsorship',
                          'code-of-conduct','editorial-guidelines','events','podcast'])[v_i],
            'static',
            v_i % 3 != 0,
            10 + v_i
        );
    END LOOP;

    -- ── CV Entries (4 more → 8 total) ──────────────────────────────────────
    -- Fills gaps: BSc before MSc, working student during studies, CKAD cert, OSS volunteer
    FOR v_i IN 1..4 LOOP
        INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
        VALUES (
            v_et_cv, v_env_dev,
            'cv-' || (ARRAY['fh-technikum','nexus-systems','ckad-cert','rust-foundation'])[v_i],
            'published',
            NOW(), 1, v_user_admin
        ) RETURNING id INTO v_tmp_content;
        INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_tmp_content, v_site1, TRUE);
        INSERT INTO cv_entries (content_id, company, company_url, location, start_date, end_date, is_current, entry_type, display_order) VALUES (
            v_tmp_content,
            (ARRAY['FH Technikum Wien','Nexus Systems','CNCF','Rust Foundation'])[v_i],
            (ARRAY['https://www.technikum-wien.at','https://nexus-systems.example.com',NULL,'https://foundation.rust-lang.org'])[v_i],
            (ARRAY['Vienna, Austria','Vienna, Austria','Online','Remote'])[v_i],
            (ARRAY['2012-09-01','2018-03-01','2023-11-01','2022-06-01'])[v_i]::DATE,
            (ARRAY['2015-06-30','2020-08-31',NULL,NULL])[v_i]::DATE,
            (ARRAY[FALSE,FALSE,FALSE,TRUE])[v_i],
            (ARRAY['education','work','certification','volunteer'])[v_i]::cv_entry_type,
            (ARRAY[4,5,6,7])[v_i]
        ) RETURNING id INTO v_tmp_id;
        INSERT INTO cv_entry_localizations (cv_entry_id, locale_id, position, description)
        VALUES (v_tmp_id, v_locale_en,
            (ARRAY['BSc Software Engineering',
                   'Working Student — Backend Development',
                   'Certified Kubernetes Application Developer (CKAD)',
                   'Open Source Contributor'])[v_i],
            (ARRAY['Graduated with honors. Focus on web technologies and databases. Capstone project on real-time collaborative editing with CRDTs.',
                   'Part-time backend role during MSc studies. Built internal REST APIs in Node.js and maintained a PostgreSQL data warehouse for analytics.',
                   'Demonstrated expertise in Kubernetes application design, deployment, configuration, and observability.',
                   'Contributing to the Rust compiler test suite and documentation. Triaged 40+ issues and submitted patches for improved error messages.'])[v_i]
        );
    END LOOP;

    -- ── Legal Documents (27 more → 30 total) ──────────────────────────────
    FOR v_i IN 1..27 LOOP
        INSERT INTO contents (entity_type_id, environment_id, slug, status, published_at, current_version, created_by)
        VALUES (
            v_et_legal, v_env_dev,
            (ARRAY['analytics-cookies','terms-of-service','imprint','marketing-cookies',
                   'data-processing-agreement','newsletter-privacy','api-terms',
                   'acceptable-use-policy','dmca-policy','accessibility-statement',
                   'affiliate-disclosure','comment-policy','media-license-terms',
                   'contributor-agreement','gdpr-data-export','subprocessor-list',
                   'vulnerability-disclosure','sla-api','cookie-policy-v2',
                   'refund-policy','third-party-services','data-retention-policy',
                   'security-whitepaper','open-source-licenses','ai-usage-disclosure',
                   'newsletter-terms','community-guidelines'])[v_i],
            (CASE WHEN v_i % 6 = 0 THEN 'draft' ELSE 'published' END)::content_status,
            CASE WHEN v_i % 6 = 0 THEN NULL ELSE NOW() - (v_i || ' days')::INTERVAL END,
            1, v_user_admin
        ) RETURNING id INTO v_tmp_content;
        IF v_i % 3 = 0 THEN
            INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_tmp_content, v_site2, TRUE);
        ELSE
            INSERT INTO content_sites (content_id, site_id, is_owner) VALUES (v_tmp_content, v_site1, TRUE);
        END IF;
        INSERT INTO legal_documents (content_id, cookie_name, document_type) VALUES (
            v_tmp_content,
            (ARRAY['analytics_cookies','tos','imprint_main','marketing_cookies',
                   'dpa','newsletter_privacy','api_tos',
                   'aup','dmca','a11y_statement',
                   'affiliate_disc','comment_policy','media_license',
                   'cla','gdpr_export','subprocessors',
                   'vuln_disclosure','sla_api','cookie_v2',
                   'refund','third_party','data_retention',
                   'security_wp','oss_licenses','ai_disclosure',
                   'newsletter_tos','community_guide'])[v_i],
            (CASE v_i % 5
                WHEN 0 THEN 'cookie_consent'
                WHEN 1 THEN 'privacy_policy'
                WHEN 2 THEN 'terms_of_service'
                WHEN 3 THEN 'imprint'
                ELSE 'disclaimer'
            END)::legal_doc_type
        ) RETURNING id INTO v_tmp_id;
        INSERT INTO legal_document_localizations (legal_document_id, locale_id, title, intro)
        VALUES (v_tmp_id, v_locale_en,
            (ARRAY['Analytics Cookies','Terms of Service','Imprint','Marketing Cookies',
                   'Data Processing Agreement','Newsletter Privacy Notice','API Terms of Use',
                   'Acceptable Use Policy','DMCA Takedown Policy','Accessibility Statement',
                   'Affiliate Disclosure','Comment Policy','Media License Terms',
                   'Contributor License Agreement','GDPR Data Export Policy','Subprocessor List',
                   'Vulnerability Disclosure Policy','API Service Level Agreement','Cookie Policy v2',
                   'Refund Policy','Third-Party Services','Data Retention Policy',
                   'Security Whitepaper','Open Source Licenses','AI Usage Disclosure',
                   'Newsletter Terms','Community Guidelines'])[v_i],
            (ARRAY['Controls how we use analytics cookies to understand site usage patterns.',
                   'The terms and conditions governing use of this website and its services.',
                   'Legal identification and contact information as required by Austrian law.',
                   'How we use marketing cookies for personalization and advertising.',
                   'Agreement governing how we process personal data on behalf of our users.',
                   'How we handle your email address and reading preferences for our newsletter.',
                   'Terms governing access to and usage of our public REST API.',
                   'Rules for acceptable behavior when using our platform and services.',
                   'Process for reporting copyright infringement under the Digital Millennium Copyright Act.',
                   'Our commitment to making this website accessible to people with disabilities.',
                   'Disclosure of affiliate relationships and how we earn commissions.',
                   'Guidelines for posting comments on blog articles and pages.',
                   'Terms governing the use and licensing of media assets on this site.',
                   'Agreement for contributors submitting code or content to our open-source projects.',
                   'How to request a full export of your personal data under GDPR Article 20.',
                   'List of third-party data processors we use and their roles.',
                   'How to responsibly report security vulnerabilities in our systems.',
                   'Uptime guarantees, response times, and remedies for our API service.',
                   'Updated cookie policy reflecting latest browser privacy changes.',
                   'Our refund policy for paid services and subscriptions.',
                   'Overview of third-party services integrated into this platform.',
                   'How long we retain different types of data and when it is deleted.',
                   'Technical overview of our security architecture and practices.',
                   'Attributions and licenses for open-source software used in this project.',
                   'How we use AI tools in content creation and editorial processes.',
                   'Terms specific to subscribing and receiving our email newsletter.',
                   'Standards for participation in our online community and forums.'])[v_i]
        );
    END LOOP;

    RAISE NOTICE '✓ Seed complete — 2 sites, 54 blogs (8 hand-crafted + 46 bulk), 25 pages, 8 CV entries, 30 legal docs, 35 tags, 30 categories, 35 skills, 44 media, 30 documents, 6 social links, 6 nav items, 3 webhooks, 5 redirects, 5 notifications, 2 media folders, 2 doc folders';
END $$;

COMMIT;

-- ============================================================================
-- SUMMARY QUERIES
-- ============================================================================
SELECT '=== Sites ===' AS section;
SELECT slug, name, timezone, is_active FROM sites ORDER BY created_at;

SELECT '=== System Admins ===' AS section;
SELECT clerk_user_id, granted_by, created_at FROM system_admins ORDER BY created_at;

SELECT '=== Site Memberships ===' AS section;
SELECT sm.clerk_user_id, s.slug AS site, sm.role::text FROM site_memberships sm
    JOIN sites s ON s.id = sm.site_id ORDER BY sm.clerk_user_id, s.slug;

SELECT '=== API Keys ===' AS section;
SELECT key_prefix, name, permission::text, status::text,
    CASE WHEN site_id IS NULL THEN 'all sites' ELSE (SELECT slug FROM sites WHERE id = api_keys.site_id) END AS scope
FROM api_keys ORDER BY created_at;

SELECT '=== Blogs ===' AS section;
SELECT c.slug, cl.title, c.status::text, b.author, b.published_date, s.slug AS site
FROM blogs b
    JOIN contents c ON c.id = b.content_id
    JOIN content_sites cs ON cs.content_id = c.id
    JOIN sites s ON s.id = cs.site_id
    JOIN content_localizations cl ON cl.content_id = c.id AND cl.locale_id = (SELECT id FROM locales WHERE code='en')
ORDER BY b.published_date DESC;

SELECT '=== Pages ===' AS section;
SELECT p.route, p.page_type::text, cl.title, s.slug AS site
FROM pages p
    JOIN contents c ON c.id = p.content_id
    JOIN content_sites cs ON cs.content_id = c.id
    JOIN sites s ON s.id = cs.site_id
    JOIN content_localizations cl ON cl.content_id = c.id AND cl.locale_id = (SELECT id FROM locales WHERE code='en')
ORDER BY s.slug, p.navigation_order;

SELECT '=== CV Entries ===' AS section;
SELECT cv.company, cv.entry_type::text, cvl.position, cv.start_date, cv.end_date, cv.is_current
FROM cv_entries cv
    JOIN cv_entry_localizations cvl ON cvl.cv_entry_id = cv.id AND cvl.locale_id = (SELECT id FROM locales WHERE code='en')
ORDER BY cv.display_order;

SELECT '=== Tags ===' AS section;
SELECT t.slug, tl.name, s.slug AS site FROM tags t
    JOIN tag_sites ts ON ts.tag_id = t.id JOIN sites s ON s.id = ts.site_id
    JOIN tag_localizations tl ON tl.tag_id = t.id AND tl.locale_id = (SELECT id FROM locales WHERE code='en')
ORDER BY t.slug, s.slug;

SELECT '=== Categories ===' AS section;
SELECT c.slug, cl.name, pc.slug AS parent, s.slug AS site FROM categories c
    LEFT JOIN categories pc ON pc.id = c.parent_id
    JOIN category_sites cs ON cs.category_id = c.id JOIN sites s ON s.id = cs.site_id
    JOIN category_localizations cl ON cl.category_id = c.id AND cl.locale_id = (SELECT id FROM locales WHERE code='en')
ORDER BY c.slug, s.slug;

-- ============================================================================
-- DEV API KEYS REFERENCE
-- ============================================================================
/*
Master Key (full access, scoped to john-doe):
  dk_devmast_00000000000000000000000000000000

Read Key (read-only, scoped to site1):
  dk_devread_00000000000000000000000000000000

Write Key (write access, scoped to techbites):
  dk_devwrit_00000000000000000000000000000000

Example:
  curl -H "X-API-Key: dk_devmast_00000000000000000000000000000000" \
       http://localhost:8000/api/v1/sites
*/
