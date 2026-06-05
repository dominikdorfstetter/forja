//! Public imprint (Impressum) response DTO.

use serde::Serialize;

use crate::config::ImprintConfig;

/// Public deployment-operator imprint. When the required operator details are
/// not fully configured, only `configured: false` is serialized so the
/// frontend can hide the imprint link without leaking partial data. Field
/// values are operator-supplied text and are returned verbatim as JSON strings
/// (never interpreted as HTML).
#[derive(Serialize, utoipa::ToSchema)]
#[schema(description = "Public deployment-operator imprint (Impressum)")]
pub struct ImprintResponse {
    /// Whether the required operator details (name, address, email) are set.
    pub configured: bool,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "Acme GmbH")]
    pub operator_name: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub vat: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub register: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub responsible: Option<String>,
}

impl ImprintResponse {
    /// `{ "configured": false }` — required details absent.
    pub fn unconfigured() -> Self {
        Self {
            configured: false,
            operator_name: None,
            address: None,
            email: None,
            phone: None,
            vat: None,
            register: None,
            responsible: None,
        }
    }

    /// Build from config: serialize every set field when the required trio is
    /// present, otherwise emit only `configured: false`.
    pub fn from_config(cfg: &ImprintConfig) -> Self {
        if !cfg.is_configured() {
            return Self::unconfigured();
        }
        Self {
            configured: true,
            operator_name: cfg.operator_name.clone(),
            address: cfg.address.clone(),
            email: cfg.email.clone(),
            phone: cfg.phone.clone(),
            vat: cfg.vat.clone(),
            register: cfg.register.clone(),
            responsible: cfg.responsible.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unconfigured_serializes_only_the_flag() {
        let json = serde_json::to_value(ImprintResponse::unconfigured()).unwrap();
        assert_eq!(json["configured"], false);
        assert_eq!(json.as_object().unwrap().len(), 1);
    }

    #[test]
    fn partial_config_does_not_leak_set_fields() {
        let cfg = ImprintConfig {
            operator_name: Some("Acme".into()),
            // address + email missing → not configured
            ..Default::default()
        };
        let json = serde_json::to_value(ImprintResponse::from_config(&cfg)).unwrap();
        assert_eq!(json["configured"], false);
        assert!(json.get("operator_name").is_none());
    }

    #[test]
    fn configured_serializes_set_fields_and_omits_unset_optionals() {
        let cfg = ImprintConfig {
            operator_name: Some("Acme GmbH".into()),
            address: Some("Wien".into()),
            email: Some("legal@acme.example".into()),
            vat: Some("ATU12345678".into()),
            ..Default::default()
        };
        let json = serde_json::to_value(ImprintResponse::from_config(&cfg)).unwrap();
        assert_eq!(json["configured"], true);
        assert_eq!(json["operator_name"], "Acme GmbH");
        assert_eq!(json["vat"], "ATU12345678");
        // unset optionals are omitted, not null
        assert!(json.get("phone").is_none());
        assert!(json.get("register").is_none());
    }

    #[test]
    fn html_in_a_field_is_kept_verbatim_as_text() {
        let cfg = ImprintConfig {
            operator_name: Some("<script>alert(1)</script> Co".into()),
            address: Some("Wien".into()),
            email: Some("a@b.c".into()),
            ..Default::default()
        };
        let json = serde_json::to_value(ImprintResponse::from_config(&cfg)).unwrap();
        // JSON carries the raw string; it is the client's job to render as text.
        assert_eq!(json["operator_name"], "<script>alert(1)</script> Co");
    }
}
