//! Audit log configuration

use serde::Deserialize;

/// Audit log configuration.
///
/// Controls the system-wide default retention period for audit logs.
/// Per-site overrides are stored in `site_settings` under `audit_log_retention_days`.
///
/// Set via environment variable: `APP__AUDIT__RETENTION_DAYS=365`
#[derive(Debug, Clone, Deserialize)]
pub struct AuditConfig {
    /// Default number of days to retain audit log entries (default: 365).
    /// Per-site overrides in `site_settings` take precedence.
    #[serde(default = "default_retention_days")]
    pub retention_days: u32,
}

fn default_retention_days() -> u32 {
    365
}

impl Default for AuditConfig {
    fn default() -> Self {
        Self {
            retention_days: default_retention_days(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_retention_days() {
        let config = AuditConfig::default();
        assert_eq!(config.retention_days, 365);
    }
}
