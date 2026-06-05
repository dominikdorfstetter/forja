//! Deployment-operator Imprint (Impressum) configuration.
//!
//! Sourced entirely from environment variables at startup — no operator PII
//! ever lives in the repo. The admin SPA is pre-built and shipped inside the
//! Docker image, so per-operator legal details must be served at runtime by the
//! backend (`GET /api/v1/imprint`) rather than injected at Vite build time.

use serde::Deserialize;

/// Operator imprint details. The required set (`operator_name`, `address`,
/// `email`) defines whether the imprint is considered "configured"; the rest
/// are optional. All fields are populated from `IMPRINT_*` environment
/// variables (see `Settings::load`).
#[derive(Debug, Clone, Default, Deserialize)]
pub struct ImprintConfig {
    pub operator_name: Option<String>,
    pub address: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub vat: Option<String>,
    pub register: Option<String>,
    pub responsible: Option<String>,
}

impl ImprintConfig {
    fn present(field: &Option<String>) -> bool {
        field.as_deref().is_some_and(|s| !s.trim().is_empty())
    }

    /// All required fields are present and non-blank.
    pub fn is_configured(&self) -> bool {
        Self::present(&self.operator_name)
            && Self::present(&self.address)
            && Self::present(&self.email)
    }

    /// Some — but not all — required fields are present. This is the
    /// misconfiguration worth warning about (`ERR_IMPRINT_INCOMPLETE`): the
    /// operator meant to configure an imprint but left a required field blank.
    /// A fully-unset imprint is *not* partial — it's a deliberate "no imprint".
    pub fn is_partially_configured(&self) -> bool {
        let any_required = Self::present(&self.operator_name)
            || Self::present(&self.address)
            || Self::present(&self.email);
        any_required && !self.is_configured()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn full() -> ImprintConfig {
        ImprintConfig {
            operator_name: Some("Acme GmbH".into()),
            address: Some("Hauptstraße 1, 1010 Wien".into()),
            email: Some("legal@acme.example".into()),
            phone: Some("+43 1 234".into()),
            vat: Some("ATU12345678".into()),
            register: Some("FN 123456a".into()),
            responsible: Some("Jane Doe".into()),
        }
    }

    #[test]
    fn all_required_present_is_configured() {
        assert!(full().is_configured());
        assert!(!full().is_partially_configured());
    }

    #[test]
    fn only_required_trio_is_configured() {
        let cfg = ImprintConfig {
            operator_name: Some("Acme".into()),
            address: Some("Wien".into()),
            email: Some("a@b.c".into()),
            ..Default::default()
        };
        assert!(cfg.is_configured());
    }

    #[test]
    fn empty_is_neither_configured_nor_partial() {
        let cfg = ImprintConfig::default();
        assert!(!cfg.is_configured());
        assert!(!cfg.is_partially_configured());
    }

    #[test]
    fn missing_email_is_partial() {
        let cfg = ImprintConfig {
            email: None,
            ..full()
        };
        assert!(!cfg.is_configured());
        assert!(cfg.is_partially_configured());
    }

    #[test]
    fn blank_required_field_does_not_count_as_present() {
        let cfg = ImprintConfig {
            operator_name: Some("Acme".into()),
            address: Some("   ".into()),
            email: Some("a@b.c".into()),
            ..Default::default()
        };
        assert!(!cfg.is_configured());
        assert!(cfg.is_partially_configured());
    }
}
