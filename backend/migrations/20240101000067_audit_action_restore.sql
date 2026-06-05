-- The Rust `AuditAction::Restore` variant (serialized as 'restore') has
-- existed without a matching enum value, so every restore/purge audit
-- INSERT was silently dropped by audited_mutation. Site restore (#711)
-- requires the value to persist. Additive — mirrors migrations …023/…042.

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'restore';
