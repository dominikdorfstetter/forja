-- Add base_url to sites for canonical URL identity (SEO, sitemaps, OG tags, RSS)
ALTER TABLE sites ADD COLUMN base_url TEXT;
