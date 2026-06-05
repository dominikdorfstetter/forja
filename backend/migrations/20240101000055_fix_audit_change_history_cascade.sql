-- Fix audit_logs and change_history FK constraints to use ON DELETE CASCADE
-- These were the only two site_id FKs without CASCADE, which caused errors
-- when deleting sites (e.g., demo site refresh in DEMO_MODE).

ALTER TABLE audit_logs
    DROP CONSTRAINT audit_logs_site_id_fkey,
    ADD CONSTRAINT audit_logs_site_id_fkey
        FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

ALTER TABLE change_history
    DROP CONSTRAINT change_history_site_id_fkey,
    ADD CONSTRAINT change_history_site_id_fkey
        FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;
