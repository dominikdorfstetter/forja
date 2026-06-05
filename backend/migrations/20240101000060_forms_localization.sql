-- Forms module localization (#579 follow-up).
--
-- Adds per-locale text overrides for both forms and form fields. Mirrors
-- the existing pages / projects / page_sections localization pattern:
-- one row per (entity_id, locale_id) carrying the translatable text
-- columns. Original columns on `forms` / `form_fields` stay as the
-- canonical/default-locale values and as the technical key for
-- submission JSONB (the field `label` is the JSONB data key, so it
-- MUST NOT vary by locale — only the display label does).

CREATE TABLE form_localizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    locale_id UUID NOT NULL REFERENCES locales(id),
    name TEXT,
    description TEXT,
    consent_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (form_id, locale_id)
);

CREATE INDEX idx_form_localizations_form ON form_localizations(form_id);

CREATE TABLE form_field_localizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_field_id UUID NOT NULL REFERENCES form_fields(id) ON DELETE CASCADE,
    locale_id UUID NOT NULL REFERENCES locales(id),
    -- The visitor-facing label override. The canonical `form_fields.label`
    -- stays as the technical JSONB key for submission data.
    display_label TEXT,
    placeholder TEXT,
    help_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (form_field_id, locale_id)
);

CREATE INDEX idx_form_field_localizations_field ON form_field_localizations(form_field_id);
