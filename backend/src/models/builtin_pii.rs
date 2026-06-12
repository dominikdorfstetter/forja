//! Built-in PII registry (#19).
//!
//! Custom types carry first-class PII classification (`is_pii` + `legal_basis`
//! per field); this module brings the *built-in* entities up to the same bar.
//! It is the single place that declares which identity-bearing columns exist
//! on Forja's own tables, why they are processed, under which GDPR Art. 6(1)
//! basis, and how their lifetime is bounded.
//!
//! Pure data — no DB access. The RoPA generator renders this registry into
//! the report, and the erasure/retention paths are tested against it
//! (`tests/gdpr_builtin_pii_test.rs`).

/// How the lifetime of an identity-bearing field is bounded.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RetentionBehavior {
    /// Identity is removed (nulled, or the row deleted where identity is the
    /// row's purpose) when the user exercises erasure / deletes their account.
    AnonymizeOnErasure,
    /// Rows are deleted wholesale by the retention purge once they exceed the
    /// site's `data_retention_days` (or the system audit default). These
    /// fields are *also* nulled on account deletion.
    RetentionPurged,
}

impl RetentionBehavior {
    /// Stable wire vocabulary used in the RoPA export.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::AnonymizeOnErasure => "anonymize_on_erasure",
            Self::RetentionPurged => "retention_purged",
        }
    }
}

/// One identity-bearing column on a built-in table.
#[derive(Debug, Clone, Copy)]
pub struct BuiltinPiiField {
    /// Column name.
    pub field: &'static str,
    /// Why the identity is processed (RoPA "purpose of processing").
    pub purpose: &'static str,
    /// GDPR Art. 6(1) lawful basis.
    pub legal_basis: &'static str,
    /// How the field's lifetime is bounded.
    pub retention_behavior: RetentionBehavior,
}

/// A built-in table that processes personal data.
#[derive(Debug, Clone, Copy)]
pub struct BuiltinPiiEntity {
    /// Table name.
    pub table: &'static str,
    /// What the table is, in RoPA terms.
    pub description: &'static str,
    /// Its identity-bearing columns.
    pub fields: &'static [BuiltinPiiField],
}

const LEGITIMATE_INTEREST: &str = "Art. 6(1)(f) GDPR — legitimate interest";
const CONTRACT: &str = "Art. 6(1)(b) GDPR — performance of a contract";

/// Every identity-bearing field on Forja's built-in entities.
///
/// `contents` is the spine shared by blog, page, document, legal, cv and
/// project entries, so classifying it once covers all of them.
pub const REGISTRY: &[BuiltinPiiEntity] = &[
    BuiltinPiiEntity {
        table: "contents",
        description: "Content spine shared by blog, page, document, legal, CV and project entries",
        fields: &[
            BuiltinPiiField {
                field: "created_by",
                purpose: "Author attribution for editorial accountability",
                legal_basis: LEGITIMATE_INTEREST,
                retention_behavior: RetentionBehavior::AnonymizeOnErasure,
            },
            BuiltinPiiField {
                field: "updated_by",
                purpose: "Editor attribution for editorial accountability",
                legal_basis: LEGITIMATE_INTEREST,
                retention_behavior: RetentionBehavior::AnonymizeOnErasure,
            },
            BuiltinPiiField {
                field: "deleted_by",
                purpose: "Deletion attribution for trash recovery and accountability",
                legal_basis: LEGITIMATE_INTEREST,
                retention_behavior: RetentionBehavior::AnonymizeOnErasure,
            },
        ],
    },
    BuiltinPiiEntity {
        table: "site_memberships",
        description: "Per-site team membership and roles",
        fields: &[
            BuiltinPiiField {
                field: "clerk_user_id",
                purpose: "Identifies the member to grant site access and enforce roles",
                legal_basis: CONTRACT,
                retention_behavior: RetentionBehavior::AnonymizeOnErasure,
            },
            BuiltinPiiField {
                field: "invited_by",
                purpose: "Invitation attribution for team-management accountability",
                legal_basis: LEGITIMATE_INTEREST,
                retention_behavior: RetentionBehavior::AnonymizeOnErasure,
            },
        ],
    },
    BuiltinPiiEntity {
        table: "audit_logs",
        description: "Security and editorial audit trail",
        fields: &[BuiltinPiiField {
            field: "user_id",
            purpose: "Actor attribution for security auditing and abuse investigation",
            legal_basis: LEGITIMATE_INTEREST,
            retention_behavior: RetentionBehavior::RetentionPurged,
        }],
    },
    BuiltinPiiEntity {
        table: "change_history",
        description: "Field-level change history for content versioning",
        fields: &[BuiltinPiiField {
            field: "changed_by",
            purpose: "Change attribution for version history and rollback review",
            legal_basis: LEGITIMATE_INTEREST,
            retention_behavior: RetentionBehavior::RetentionPurged,
        }],
    },
    BuiltinPiiEntity {
        table: "notifications",
        description: "In-app editorial notifications",
        fields: &[
            BuiltinPiiField {
                field: "recipient_clerk_id",
                purpose: "Delivers workflow notifications to the addressed member",
                legal_basis: LEGITIMATE_INTEREST,
                retention_behavior: RetentionBehavior::AnonymizeOnErasure,
            },
            BuiltinPiiField {
                field: "actor_clerk_id",
                purpose: "Names the acting member in workflow notifications",
                legal_basis: LEGITIMATE_INTEREST,
                retention_behavior: RetentionBehavior::AnonymizeOnErasure,
            },
        ],
    },
    BuiltinPiiEntity {
        table: "api_keys",
        description: "API keys for headless content delivery",
        fields: &[
            BuiltinPiiField {
                field: "user_id",
                purpose: "Binds a personal API key to its owner for revocation and quota",
                legal_basis: CONTRACT,
                retention_behavior: RetentionBehavior::AnonymizeOnErasure,
            },
            BuiltinPiiField {
                field: "created_by",
                purpose: "Key-creation attribution for credential accountability",
                legal_basis: CONTRACT,
                retention_behavior: RetentionBehavior::AnonymizeOnErasure,
            },
        ],
    },
    BuiltinPiiEntity {
        table: "sites",
        description: "Tenant sites",
        fields: &[BuiltinPiiField {
            field: "created_by",
            purpose: "Site provenance for ownership and support",
            legal_basis: LEGITIMATE_INTEREST,
            retention_behavior: RetentionBehavior::AnonymizeOnErasure,
        }],
    },
];

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn registry_covers_the_known_builtin_tables() {
        let tables: HashSet<&str> = REGISTRY.iter().map(|e| e.table).collect();
        for table in [
            "contents",
            "site_memberships",
            "audit_logs",
            "change_history",
            "notifications",
            "api_keys",
            "sites",
        ] {
            assert!(tables.contains(table), "missing registry entry for {table}");
        }
        assert_eq!(tables.len(), REGISTRY.len(), "tables must be unique");
    }

    #[test]
    fn every_field_has_a_complete_data_protection_contract() {
        for entity in REGISTRY {
            assert!(
                !entity.description.is_empty(),
                "{} needs a description",
                entity.table
            );
            assert!(
                !entity.fields.is_empty(),
                "{} needs at least one field",
                entity.table
            );
            for f in entity.fields {
                assert!(
                    !f.purpose.is_empty(),
                    "{}.{} needs a purpose",
                    entity.table,
                    f.field
                );
                assert!(
                    f.legal_basis.contains("Art. 6(1)"),
                    "{}.{} must cite a GDPR Art. 6(1) basis",
                    entity.table,
                    f.field
                );
            }
        }
    }

    #[test]
    fn retention_purged_applies_exactly_to_the_purge_targets() {
        for entity in REGISTRY {
            let purged = entity
                .fields
                .iter()
                .any(|f| f.retention_behavior == RetentionBehavior::RetentionPurged);
            let is_purge_target = matches!(entity.table, "audit_logs" | "change_history");
            assert_eq!(
                purged, is_purge_target,
                "{}: retention_purged must match the purge worker's targets",
                entity.table
            );
        }
    }

    #[test]
    fn wire_vocabulary_is_stable() {
        assert_eq!(
            RetentionBehavior::AnonymizeOnErasure.as_str(),
            "anonymize_on_erasure"
        );
        assert_eq!(
            RetentionBehavior::RetentionPurged.as_str(),
            "retention_purged"
        );
    }
}
