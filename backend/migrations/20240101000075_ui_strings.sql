-- UI Strings module (consumer-feedback roadmap §1).
--
-- Site-scoped key→string dictionary for template chrome ("min read",
-- footer headings, aria-labels). Mirrors the forms_localization shape:
-- a locale-invariant technical key row plus one row per (string, locale)
-- carrying the translated value. Reuses the existing translation_status
-- enum from the base migration; the default-locale auto-outdated rule is
-- enforced in the repo layer, not in SQL.

CREATE TABLE ui_strings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (site_id, key)
);

CREATE INDEX idx_ui_strings_site ON ui_strings(site_id);

CREATE TABLE ui_string_localizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ui_string_id UUID NOT NULL REFERENCES ui_strings(id) ON DELETE CASCADE,
    locale_id UUID NOT NULL REFERENCES locales(id),
    value TEXT NOT NULL,
    translation_status translation_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (ui_string_id, locale_id)
);

CREATE INDEX idx_ui_string_localizations_string ON ui_string_localizations(ui_string_id);
