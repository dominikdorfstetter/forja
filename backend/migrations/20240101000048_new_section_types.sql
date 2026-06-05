-- Add 8 new section types to the section_type enum.
-- This is an additive migration — no existing data is affected.

ALTER TYPE section_type ADD VALUE IF NOT EXISTS 'stats';
ALTER TYPE section_type ADD VALUE IF NOT EXISTS 'team';
ALTER TYPE section_type ADD VALUE IF NOT EXISTS 'timeline';
ALTER TYPE section_type ADD VALUE IF NOT EXISTS 'logo_cloud';
ALTER TYPE section_type ADD VALUE IF NOT EXISTS 'newsletter';
ALTER TYPE section_type ADD VALUE IF NOT EXISTS 'video';
ALTER TYPE section_type ADD VALUE IF NOT EXISTS 'divider';
ALTER TYPE section_type ADD VALUE IF NOT EXISTS 'text';
