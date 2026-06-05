-- Migration: Portfolio Module — Projects
-- Description: Rename CV module setting to Portfolio, add projects tables with
--              links, media, skills, and CV entry associations.

-- ============================================
-- MODULE RENAME: CV → Portfolio
-- ============================================

-- Migrate existing setting values from cv to portfolio
UPDATE site_settings
   SET setting_key = 'module_portfolio_enabled'
 WHERE setting_key = 'module_cv_enabled';

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE project_link_type AS ENUM ('source', 'demo', 'documentation', 'website', 'other');

-- ============================================
-- PROJECT TABLES
-- ============================================

-- Projects (linked to contents for status/publishing)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    slug CITEXT NOT NULL,
    display_order SMALLINT NOT NULL DEFAULT 0,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    start_date DATE,
    end_date DATE,
    is_ongoing BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_project_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

-- Project Localizations (translated title & description per locale)
CREATE TABLE project_localizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    locale_id UUID NOT NULL REFERENCES locales(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    short_description TEXT,
    description TEXT,
    UNIQUE(project_id, locale_id)
);

-- Project Links (source code, demo, docs, etc.)
CREATE TABLE project_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    link_type project_link_type NOT NULL DEFAULT 'other',
    icon VARCHAR(50),
    display_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project Media junction (images/screenshots)
CREATE TABLE project_media (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
    display_order SMALLINT NOT NULL DEFAULT 0,
    is_cover BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (project_id, media_id)
);

-- Project ↔ CV Entry junction (optional link between project and CV entries)
CREATE TABLE project_cv_entries (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    cv_entry_id UUID NOT NULL REFERENCES cv_entries(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, cv_entry_id)
);

-- Project ↔ Skill junction
CREATE TABLE project_skills (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, skill_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE UNIQUE INDEX idx_projects_slug ON projects(slug) WHERE NOT is_deleted;
CREATE INDEX idx_projects_content ON projects(content_id);
CREATE INDEX idx_projects_display_order ON projects(display_order);
CREATE INDEX idx_projects_featured ON projects(is_featured) WHERE is_featured AND NOT is_deleted;
CREATE INDEX idx_project_localizations_project ON project_localizations(project_id);
CREATE INDEX idx_project_links_project ON project_links(project_id);
CREATE INDEX idx_project_media_project ON project_media(project_id);
CREATE INDEX idx_project_cv_entries_cv ON project_cv_entries(cv_entry_id);
CREATE INDEX idx_project_skills_skill ON project_skills(skill_id);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
