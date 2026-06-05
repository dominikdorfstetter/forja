-- Make api_keys.site_id NOT NULL (all API keys must be scoped to a site)

-- First, delete any API keys that don't have a site_id (orphaned keys)
DELETE FROM api_key_usage WHERE api_key_id IN (SELECT id FROM api_keys WHERE site_id IS NULL);
DELETE FROM api_keys WHERE site_id IS NULL;

-- Now make the column NOT NULL
ALTER TABLE api_keys ALTER COLUMN site_id SET NOT NULL;
