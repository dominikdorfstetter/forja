-- Drop ActivityPub federation tables (module removed)
DROP TABLE IF EXISTS ap_delivery_queue CASCADE;
DROP TABLE IF EXISTS ap_comments CASCADE;
DROP TABLE IF EXISTS ap_notes CASCADE;
DROP TABLE IF EXISTS ap_featured_posts CASCADE;
DROP TABLE IF EXISTS ap_blocked_actors CASCADE;
DROP TABLE IF EXISTS ap_blocked_instances CASCADE;
DROP TABLE IF EXISTS ap_activities CASCADE;
DROP TABLE IF EXISTS ap_followers CASCADE;
DROP TABLE IF EXISTS ap_actors CASCADE;
