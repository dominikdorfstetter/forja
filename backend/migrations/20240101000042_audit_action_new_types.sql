-- Add new audit action types for settings, permissions, and ownership events
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'settings_update';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'permission_denied';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'ownership_transfer';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'export';
