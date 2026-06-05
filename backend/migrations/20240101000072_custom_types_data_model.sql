-- Migration: Custom content types — data model (#790)
-- Description: Storage spine for user-defined content types ("Collections").
--   Per-site type registry + generic, translatable, privacy-aware value
--   storage. No runtime DDL — schemas are data. Entries ride the existing
--   `contents` spine so they inherit the publish lifecycle, versioning, audit,
--   and webhooks for free.
--
--   All additive. The per-field compliance metadata columns
--   (data_category / processing_purpose / legal_basis) that drive #794's
--   Art. 30 RoPA export are owned here (kept together with the rest of the
--   field schema rather than split into a second migration).

-- ============================================
-- ENUM TYPES
-- ============================================
CREATE TYPE custom_field_type AS ENUM (
    'text', 'richtext', 'number', 'boolean', 'date', 'enum', 'media'
);

-- Routing discriminator: `page` types get a public URL (#801); `data` types
-- are API-only (internal/CRM-style collections, never routed).
CREATE TYPE custom_content_kind AS ENUM ('page', 'data');

-- ============================================
-- entity_types: allow per-site custom entity types
-- ============================================
-- Built-ins keep `site_id IS NULL` and the original global-unique name
-- semantics via a partial index; custom types are unique per (site_id, name).
-- The reserved-name guard (#791) forbids a custom key from colliding with a
-- built-in name, so the existing single-row `WHERE name = 'blog'` lookups in
-- auth/content_service stay correct.
ALTER TABLE entity_types
    ADD COLUMN site_id UUID REFERENCES sites(id) ON DELETE CASCADE;

ALTER TABLE entity_types DROP CONSTRAINT entity_types_name_key;

CREATE UNIQUE INDEX uq_entity_types_builtin_name
    ON entity_types (name) WHERE site_id IS NULL;
CREATE UNIQUE INDEX uq_entity_types_site_name
    ON entity_types (site_id, name) WHERE site_id IS NOT NULL;
CREATE INDEX idx_entity_types_site
    ON entity_types (site_id) WHERE site_id IS NOT NULL;

-- ============================================
-- custom_types: per-site type registry (1:1 with an entity_types row)
-- ============================================
CREATE TABLE custom_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type_id UUID NOT NULL UNIQUE REFERENCES entity_types(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    key CITEXT NOT NULL,
    name TEXT NOT NULL,
    -- NULL → keep entries forever; >= 0 → purge entries older than N days (#794)
    retention_days INTEGER,
    -- Privacy by default: nothing is served publicly unless explicitly opted in.
    is_publicly_readable BOOLEAN NOT NULL DEFAULT FALSE,
    content_kind custom_content_kind NOT NULL DEFAULT 'data',
    -- Monotonic counter bumped on each structural schema change (#800):
    -- cache-busting + audit, not a per-version snapshot.
    schema_version INTEGER NOT NULL DEFAULT 1,
    -- Clerk user IDs (the local `users` table was dropped in migration 20);
    -- audit columns are plain TEXT with no FK, matching `contents`.
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_custom_type_retention
        CHECK (retention_days IS NULL OR retention_days >= 0),
    UNIQUE (site_id, key)
);

CREATE INDEX idx_custom_types_site ON custom_types (site_id);

-- ============================================
-- custom_type_fields: the schema of a type
-- ============================================
CREATE TABLE custom_type_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    custom_type_id UUID NOT NULL REFERENCES custom_types(id) ON DELETE CASCADE,
    key CITEXT NOT NULL,
    label TEXT NOT NULL,
    -- Optional per-locale label overrides ({ "de": "...", "fr": "..." }).
    labels JSONB,
    field_type custom_field_type NOT NULL,
    required BOOLEAN NOT NULL DEFAULT FALSE,
    localized BOOLEAN NOT NULL DEFAULT FALSE,
    -- The designated title field routes to content_localizations.title; the
    -- value is NOT stored in the custom value tables. Exactly one per type is
    -- enforced at the API layer (#791); the DB enforces at-most-one below.
    is_title BOOLEAN NOT NULL DEFAULT FALSE,
    -- Privacy by construction: a PII field is encrypted at rest (#792),
    -- stripped from public responses (#795), redacted from non-admins (#794),
    -- and included in subject export/erasure + the RoPA (#794).
    is_pii BOOLEAN NOT NULL DEFAULT FALSE,
    -- GDPR Art. 30 metadata — the data-protection contract per field.
    data_category TEXT,
    processing_purpose TEXT,
    legal_basis TEXT,
    -- Allowed values for field_type = 'enum'.
    enum_options JSONB,
    -- Value constraints. min_value/max_value bound `number` fields;
    -- min_length/max_length bound `text`; pattern is a Rust-regex-checked
    -- text constraint; is_unique drives cross-entry uniqueness (#792).
    min_value DOUBLE PRECISION,
    max_value DOUBLE PRECISION,
    min_length INTEGER,
    max_length INTEGER,
    pattern TEXT,
    is_unique BOOLEAN NOT NULL DEFAULT FALSE,
    display_order SMALLINT NOT NULL DEFAULT 0,
    -- Soft-deprecation (#800): orphaned values stay readable; the field is
    -- hidden from new entries instead of being hard-deleted.
    deprecated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (custom_type_id, key)
);

-- At most one designated title field per type.
CREATE UNIQUE INDEX uq_custom_type_fields_title
    ON custom_type_fields (custom_type_id) WHERE is_title;

CREATE INDEX idx_custom_type_fields_type
    ON custom_type_fields (custom_type_id, display_order);

-- ============================================
-- Entry value storage (rides `contents`)
-- ============================================
-- Shared (non-localized) field values, one row per entry.
CREATE TABLE custom_entry_values (
    content_id UUID PRIMARY KEY REFERENCES contents(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_custom_entry_values_data
    ON custom_entry_values USING gin (data jsonb_path_ops);

-- Localized field values, one row per (entry, locale). Mirrors
-- content_localizations.
CREATE TABLE custom_entry_localizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    locale_id UUID NOT NULL REFERENCES locales(id),
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (content_id, locale_id)
);
CREATE INDEX idx_custom_entry_localizations_content
    ON custom_entry_localizations (content_id);
CREATE INDEX idx_custom_entry_localizations_data
    ON custom_entry_localizations USING gin (data jsonb_path_ops);

-- Race-safe cross-entry uniqueness for is_unique fields, maintained
-- transactionally by the validator (#792). locale_id NULL = shared field.
-- Two partial unique indexes because NULLs are distinct in a plain UNIQUE,
-- which would let two shared rows share a value.
CREATE TABLE custom_entry_unique_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    custom_type_id UUID NOT NULL REFERENCES custom_types(id) ON DELETE CASCADE,
    field_key CITEXT NOT NULL,
    locale_id UUID REFERENCES locales(id),
    value_norm TEXT NOT NULL,
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_custom_unique_shared
    ON custom_entry_unique_values (custom_type_id, field_key, value_norm)
    WHERE locale_id IS NULL;
CREATE UNIQUE INDEX uq_custom_unique_localized
    ON custom_entry_unique_values (custom_type_id, field_key, locale_id, value_norm)
    WHERE locale_id IS NOT NULL;
CREATE INDEX idx_custom_unique_content
    ON custom_entry_unique_values (content_id);

-- ============================================
-- TRIGGERS (updated_at maintenance)
-- ============================================
CREATE TRIGGER update_custom_types_updated_at BEFORE UPDATE ON custom_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_custom_type_fields_updated_at BEFORE UPDATE ON custom_type_fields
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_custom_entry_values_updated_at BEFORE UPDATE ON custom_entry_values
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_custom_entry_localizations_updated_at BEFORE UPDATE ON custom_entry_localizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
