-- E2E Test Data Seed Script
-- Run after migrations: PGPASSWORD=forja psql -h localhost -p 5433 -U forja -d forja_test -f seed-test-data.sql
--
-- Prerequisites: migrations must have run first (they create environments, entity_types, locales)

-- ============================================
-- Cleanup: remove artifacts created by previous e2e runs so scenarios
-- that create data (site-creation.feature, …) stay idempotent.
-- ============================================

DELETE FROM sites WHERE slug IN ('e2e-new-site', 'admin-test', 'empty-state-site');
DELETE FROM contents WHERE slug IN ('e2e-test-post');

-- ============================================
-- Test Site
-- ============================================

INSERT INTO sites (id, name, slug, description, created_by)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'E2E Test Blog',
  'e2e-test',
  'Automated test site for e2e testing',
  'e2e-seed'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- Link site to default locale (English)
-- Use the actual locale ID from the migrations seed
-- ============================================

INSERT INTO site_locales (site_id, locale_id, is_default)
SELECT 'a0000000-0000-0000-0000-000000000001', id, true
FROM locales WHERE code = 'en'
ON CONFLICT DO NOTHING;

-- German as a secondary (non-default) locale, for the multilingual blog
-- journey (blog-multilingual.feature). Default stays English, so the publish
-- gate (default-locale-only) is unaffected.
INSERT INTO site_locales (site_id, locale_id, is_default)
SELECT 'a0000000-0000-0000-0000-000000000001', id, false
FROM locales WHERE code = 'de'
ON CONFLICT DO NOTHING;

-- ============================================
-- Site Memberships (one per test role)
-- ============================================

INSERT INTO site_memberships (clerk_user_id, site_id, role) VALUES
  ('user_3AzkHLt8EG4ybGriwrU93pFPMuJ', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('user_3AzkHD4HqtUUFgVcbTOpdnoS0su', 'a0000000-0000-0000-0000-000000000001', 'admin'),
  ('user_3AzkHAwmjHX3r1rIeDVGX8UXN8h', 'a0000000-0000-0000-0000-000000000001', 'editor'),
  ('user_3AzkH1b1vOtuEe0NTRPO1DwNfzi', 'a0000000-0000-0000-0000-000000000001', 'author'),
  ('user_3AzkGvp6ucT55AgFDJHu8v4MJ5I', 'a0000000-0000-0000-0000-000000000001', 'reviewer'),
  ('user_3AzkGj42TKFcAVvN91143qvimH0', 'a0000000-0000-0000-0000-000000000001', 'viewer')
ON CONFLICT (clerk_user_id, site_id) DO NOTHING;

-- ============================================
-- User Preferences: mark tour + onboarding completed for all test users
-- (except viewer — used for the dedicated tour scenario)
-- ============================================

INSERT INTO user_preferences (clerk_user_id, preferences) VALUES
  ('user_3AzkHLt8EG4ybGriwrU93pFPMuJ', '{"help_tour_completed": true}'),
  ('user_3AzkHD4HqtUUFgVcbTOpdnoS0su', '{"help_tour_completed": true}'),
  ('user_3AzkHAwmjHX3r1rIeDVGX8UXN8h', '{"help_tour_completed": true}'),
  ('user_3AzkH1b1vOtuEe0NTRPO1DwNfzi', '{"help_tour_completed": true}'),
  ('user_3AzkGvp6ucT55AgFDJHu8v4MJ5I', '{"help_tour_completed": true}'),
  ('user_3AzkHUzguKUpw9H0lEAQ0rXAWXo', '{"help_tour_completed": true}')
ON CONFLICT (clerk_user_id) DO UPDATE SET
  preferences = user_preferences.preferences || '{"help_tour_completed": true}'::jsonb;

-- Viewer: no tour completed (for tour e2e test)
INSERT INTO user_preferences (clerk_user_id, preferences) VALUES
  ('user_3AzkGj42TKFcAVvN91143qvimH0', '{}')
ON CONFLICT (clerk_user_id) DO NOTHING;

-- ============================================
-- System admin grant (system-admin-privileges.feature)
-- The account is deliberately NOT a member of the test site — its access
-- comes solely from this grant.
-- ============================================

INSERT INTO system_admins (clerk_user_id, granted_by) VALUES
  ('user_3AzkHUzguKUpw9H0lEAQ0rXAWXo', 'e2e-seed')
ON CONFLICT (clerk_user_id) DO NOTHING;

-- ============================================
-- Read API key for the public published view (blog-publishing.feature).
-- Plaintext (test-only, only valid against this seeded DB):
--   dk_e2etest1_0123456789abcdef0123456789abcdef
-- Stored with the legacy SHA-256 hash_version so the hash is deterministic.
-- ============================================

INSERT INTO api_keys (key_hash, key_prefix, name, description, permission, site_id, status, hash_version)
VALUES (
  'a9566a7cf488e29d7959b53826c7fe4a0fe38ed470feaf5be484fbbfd1a58648',
  'dk_e2etest1',
  'E2E Read Key',
  'Deterministic read-only key for e2e public-view assertions',
  'read',
  'a0000000-0000-0000-0000-000000000001',
  'active',
  1
) ON CONFLICT DO NOTHING;

-- No pre-seeded content — blog posts, pages, documents, etc. are created
-- organically by the e2e test scenarios (blog-publishing.feature, page-management.feature, etc.)
-- This ensures the test suite tells a real user story from start to finish.
