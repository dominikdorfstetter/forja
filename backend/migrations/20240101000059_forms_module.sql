-- Migration: Forms Module — schema (#580)
-- Description: Standalone forms subsystem. Site owners define forms with custom
--              typed fields and per-field validation; visitors submit, get a
--              reference code, can self-service via that code; admins triage
--              submissions. Does NOT participate in the content publishing
--              framework (draft/review/publish has no meaning for forms).

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE form_submission_status AS ENUM ('new', 'in_review', 'resolved', 'archived');
CREATE TYPE form_field_type AS ENUM (
    'text', 'textarea', 'email', 'number',
    'select', 'checkbox', 'radio', 'date', 'custom'
);
CREATE TYPE form_bot_protection AS ENUM ('none', 'mandatory');
CREATE TYPE form_storage_mode AS ENUM ('simple', 'queryable');

-- ============================================
-- TABLES
-- ============================================

-- Forms: a named submission target, site-scoped
CREATE TABLE forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug CITEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    consent_required BOOLEAN NOT NULL DEFAULT FALSE,
    consent_text TEXT,
    bot_protection form_bot_protection NOT NULL DEFAULT 'none',
    storage_mode form_storage_mode NOT NULL DEFAULT 'simple',
    -- NULL or 0 → never auto-delete submissions for this form
    retention_days INTEGER,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_form_retention_days CHECK (retention_days IS NULL OR retention_days >= 0)
);

-- Form fields: ordered list of inputs that belong to one form
CREATE TABLE form_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    field_type form_field_type NOT NULL,
    placeholder TEXT,
    help_text TEXT,
    -- per-field validation rules (required, min_length, max_length, min, max, pattern, …)
    validation JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- choices for select / radio / checkbox; null for other types
    options JSONB,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    display_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Form templates: copy-on-create presets, site-scoped. Templates store the
-- field set as a JSONB snapshot; once a form is created from a template the
-- two are independent (mirrors content_templates).
CREATE TABLE form_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    -- snapshot: array of field definitions matching form_fields columns
    fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    consent_required BOOLEAN NOT NULL DEFAULT FALSE,
    consent_text TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Form submissions: one row per visitor submission
CREATE TABLE form_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    -- Visitor-facing identifier; XXXX-XXXX-XXXX format, crypto-random.
    -- Must be globally unique so the self-service endpoints can look up by
    -- code alone without leaking form context.
    reference_code TEXT NOT NULL,
    -- Field values keyed by field label (or field id) — see submission API
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    consent_given BOOLEAN NOT NULL DEFAULT FALSE,
    -- Captured consent text at the moment of submission for audit/GDPR proof
    consent_text_at_submission TEXT,
    bot_protection_token TEXT,
    status form_submission_status NOT NULL DEFAULT 'new',
    -- Soft-delete columns power the GDPR retention worker (#583) and the
    -- self-service delete endpoint (#584). We store both is_deleted (for
    -- index predicates) and deleted_at (for audit and 410-Gone responses).
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Submission notes: triage notes attached to a submission by admins.
-- author_id is a clerk_user_id (Forja delegates identity to Clerk — there is
-- no first-party users table since migration 20240101000020).
CREATE TABLE submission_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
    author_id TEXT,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Status history log: every status transition for a submission. changed_by
-- is a clerk_user_id (TEXT), null when the system performs the transition.
CREATE TABLE form_submission_status_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
    from_status form_submission_status,
    to_status form_submission_status NOT NULL,
    changed_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Per-site slug uniqueness; case-insensitive via CITEXT, only counts live forms
CREATE UNIQUE INDEX idx_forms_site_slug ON forms(site_id, slug) WHERE NOT is_deleted;
CREATE INDEX idx_forms_site ON forms(site_id);
CREATE INDEX idx_forms_active ON forms(site_id) WHERE is_active AND NOT is_deleted;

CREATE INDEX idx_form_fields_form ON form_fields(form_id);
CREATE INDEX idx_form_fields_order ON form_fields(form_id, display_order);

CREATE UNIQUE INDEX idx_form_templates_site_name ON form_templates(site_id, name);
CREATE INDEX idx_form_templates_site ON form_templates(site_id);

-- reference_code uniqueness is the security contract of #582
CREATE UNIQUE INDEX idx_form_submissions_reference_code ON form_submissions(reference_code);
CREATE INDEX idx_form_submissions_form ON form_submissions(form_id);
CREATE INDEX idx_form_submissions_status ON form_submissions(form_id, status) WHERE NOT is_deleted;
CREATE INDEX idx_form_submissions_created ON form_submissions(form_id, created_at DESC) WHERE NOT is_deleted;
-- GIN on data enables field-value search for queryable storage mode (#583)
CREATE INDEX idx_form_submissions_data_gin ON form_submissions USING GIN (data jsonb_path_ops);

CREATE INDEX idx_submission_notes_submission ON submission_notes(submission_id);
CREATE INDEX idx_form_submission_status_log_submission ON form_submission_status_log(submission_id);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_forms_updated_at BEFORE UPDATE ON forms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_fields_updated_at BEFORE UPDATE ON form_fields
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_templates_updated_at BEFORE UPDATE ON form_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_submissions_updated_at BEFORE UPDATE ON form_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_submission_notes_updated_at BEFORE UPDATE ON submission_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
