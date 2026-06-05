-- Add editorial workflow audit action variants
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'submit_review';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'approve';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'request_changes';
