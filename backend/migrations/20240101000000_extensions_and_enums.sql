-- Migration: Extensions and ENUMs
-- Description: Enable PostgreSQL extensions and create custom ENUM types

-- ============================================
-- POSTGRESQL EXTENSIONS
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID generation
CREATE EXTENSION IF NOT EXISTS "citext";         -- Case-insensitive text
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- Trigram for fuzzy search

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE environment_type AS ENUM ('development', 'staging', 'production');
CREATE TYPE text_direction AS ENUM ('ltr', 'rtl');
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'editor', 'author', 'viewer');
CREATE TYPE content_status AS ENUM ('draft', 'in_review', 'scheduled', 'published', 'archived');
CREATE TYPE translation_status AS ENUM ('pending', 'in_progress', 'review', 'approved', 'outdated');
CREATE TYPE storage_provider AS ENUM ('local', 'cloudinary', 's3', 'gcs', 'azure');
CREATE TYPE block_type AS ENUM ('paragraph', 'heading', 'image', 'list', 'code', 'quote', 'embed', 'divider', 'table');
CREATE TYPE cv_entry_type AS ENUM ('work', 'education', 'volunteer', 'certification', 'project');
CREATE TYPE page_type AS ENUM ('static', 'landing', 'contact', 'blog_index', 'custom');
CREATE TYPE legal_doc_type AS ENUM ('cookie_consent', 'privacy_policy', 'terms_of_service', 'imprint', 'disclaimer');
CREATE TYPE media_variant_type AS ENUM ('original', 'thumbnail', 'small', 'medium', 'large', 'webp', 'avif');
CREATE TYPE skill_category AS ENUM ('programming', 'framework', 'database', 'devops', 'language', 'soft_skill', 'tool', 'other');
CREATE TYPE section_type AS ENUM ('hero', 'features', 'cta', 'gallery', 'testimonials', 'pricing', 'faq', 'contact', 'custom');
CREATE TYPE audit_action AS ENUM (
    'create', 'read', 'update', 'delete',
    'publish', 'unpublish', 'archive',
    'login', 'logout', 'password_change',
    'permission_grant', 'permission_revoke'
);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Trigger function for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';
