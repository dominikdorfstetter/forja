-- Migration: Section Items Localization
-- Description: Per-locale override for a page section's `settings.items`
-- array (feature titles, testimonial quotes, FAQ Q/A, ...). NULL means "no
-- localized items for this locale" — consumers fall back to the default
-- items stored in page_sections.settings->'items'. A non-null value replaces
-- the entire default array for that locale (full override, no per-field merge).

ALTER TABLE page_section_localizations ADD COLUMN items JSONB;
