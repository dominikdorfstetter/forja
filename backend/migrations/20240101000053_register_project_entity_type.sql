-- Migration: Register project entity type
-- Description: Add 'project' to entity_types so ContentService can create content records for projects.

INSERT INTO entity_types (name, table_name, is_versionable, is_localizable, is_site_specific) VALUES
    ('project', 'projects', TRUE, TRUE, TRUE);
