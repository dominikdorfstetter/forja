-- Add 'rejected' to the form_submission_status enum.
-- Additive migration — no existing data is affected. Lets reviewers mark a
-- submission as not-followed-through without forcing it through resolved.
ALTER TYPE form_submission_status ADD VALUE IF NOT EXISTS 'rejected';
