-- Migration: CV/Resume System
-- Description: Skills and CV entry tables

-- ============================================
-- CV TABLES
-- ============================================

-- Skills (reusable across sites)
CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name CITEXT NOT NULL,
    slug CITEXT NOT NULL UNIQUE,
    category skill_category,
    icon TEXT,
    proficiency_level SMALLINT CHECK (proficiency_level BETWEEN 1 AND 5),
    is_global BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Skill-Site Junction
CREATE TABLE skill_sites (
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    is_owner BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (skill_id, site_id)
);

-- Skill Localizations
CREATE TABLE skill_localizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    locale_id UUID NOT NULL REFERENCES locales(id),
    display_name TEXT NOT NULL,
    description TEXT,
    UNIQUE(skill_id, locale_id)
);

-- CV Entries
CREATE TABLE cv_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID REFERENCES contents(id) ON DELETE CASCADE,
    company TEXT NOT NULL,
    company_url TEXT,
    company_logo_id UUID REFERENCES media_files(id),
    location TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    entry_type cv_entry_type NOT NULL DEFAULT 'work',
    display_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_cv_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

-- CV Entry Localizations
CREATE TABLE cv_entry_localizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cv_entry_id UUID NOT NULL REFERENCES cv_entries(id) ON DELETE CASCADE,
    locale_id UUID NOT NULL REFERENCES locales(id),
    position TEXT NOT NULL,
    description TEXT,
    achievements JSONB DEFAULT '[]',
    UNIQUE(cv_entry_id, locale_id)
);

-- CV Entry Skills Junction
CREATE TABLE cv_entry_skills (
    cv_entry_id UUID NOT NULL REFERENCES cv_entries(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    relevance_score SMALLINT NOT NULL DEFAULT 1 CHECK (relevance_score BETWEEN 1 AND 5),
    PRIMARY KEY (cv_entry_id, skill_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_slug ON skills USING btree(slug);
CREATE INDEX idx_skill_sites_site ON skill_sites(site_id);
CREATE INDEX idx_cv_entries_content ON cv_entries(content_id);
CREATE INDEX idx_cv_entries_type ON cv_entries(entry_type);
CREATE INDEX idx_cv_entries_dates ON cv_entries(start_date DESC, end_date);
CREATE INDEX idx_cv_entry_skills_skill ON cv_entry_skills(skill_id);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_skills_updated_at BEFORE UPDATE ON skills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cv_entries_updated_at BEFORE UPDATE ON cv_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
