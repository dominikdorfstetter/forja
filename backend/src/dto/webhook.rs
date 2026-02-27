//! Webhook DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::models::webhook::{Webhook, WebhookDelivery};
use crate::utils::pagination::Paginated;

/// Known webhook event types.
pub const VALID_WEBHOOK_EVENTS: &[&str] = &[
    "blog.created",
    "blog.updated",
    "blog.deleted",
    "page.created",
    "page.updated",
    "page.deleted",
    "document.created",
    "document.updated",
    "document.deleted",
    "media.created",
    "media.deleted",
];

/// Request to create a webhook.
#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateWebhookRequest {
    #[validate(url(message = "Must be a valid URL"))]
    #[schema(example = "https://example.com/webhook")]
    pub url: String,
    #[validate(length(max = 500, message = "Description cannot exceed 500 characters"))]
    #[schema(example = "My webhook")]
    pub description: Option<String>,
    #[validate(custom(function = "validate_webhook_events"))]
    #[schema(example = json!(["blog.created", "blog.updated"]))]
    pub events: Option<Vec<String>>,
}

/// Request to update a webhook.
#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateWebhookRequest {
    #[validate(url(message = "Must be a valid URL"))]
    pub url: Option<String>,
    #[validate(length(max = 500, message = "Description cannot exceed 500 characters"))]
    pub description: Option<String>,
    #[validate(custom(function = "validate_webhook_events"))]
    pub events: Option<Vec<String>>,
    pub is_active: Option<bool>,
}

/// Validate that all event names are known webhook events.
fn validate_webhook_events(events: &[String]) -> Result<(), validator::ValidationError> {
    for event in events {
        if !VALID_WEBHOOK_EVENTS.contains(&event.as_str()) {
            let mut err = validator::ValidationError::new("invalid_event");
            err.message = Some(format!("Unknown webhook event: '{}'", event).into());
            return Err(err);
        }
    }
    Ok(())
}

/// Webhook response (secret is excluded).
#[derive(Debug, Serialize, ToSchema)]
pub struct WebhookResponse {
    pub id: Uuid,
    pub site_id: Uuid,
    pub url: String,
    pub description: Option<String>,
    pub events: Vec<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Webhook> for WebhookResponse {
    fn from(w: Webhook) -> Self {
        Self {
            id: w.id,
            site_id: w.site_id,
            url: w.url,
            description: w.description,
            events: w.events,
            is_active: w.is_active,
            created_at: w.created_at,
            updated_at: w.updated_at,
        }
    }
}

/// Webhook delivery log response.
#[derive(Debug, Serialize, ToSchema)]
pub struct WebhookDeliveryResponse {
    pub id: Uuid,
    pub webhook_id: Uuid,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub status_code: Option<i16>,
    pub response_body: Option<String>,
    pub error_message: Option<String>,
    pub attempt_number: i16,
    pub delivered_at: DateTime<Utc>,
}

impl From<WebhookDelivery> for WebhookDeliveryResponse {
    fn from(d: WebhookDelivery) -> Self {
        Self {
            id: d.id,
            webhook_id: d.webhook_id,
            event_type: d.event_type,
            payload: d.payload,
            status_code: d.status_code,
            response_body: d.response_body,
            error_message: d.error_message,
            attempt_number: d.attempt_number,
            delivered_at: d.delivered_at,
        }
    }
}

/// Paginated webhooks response.
pub type PaginatedWebhooks = Paginated<WebhookResponse>;

/// Paginated webhook deliveries response.
pub type PaginatedWebhookDeliveries = Paginated<WebhookDeliveryResponse>;

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_create_webhook_valid() {
        let req = CreateWebhookRequest {
            url: "https://example.com/webhook".to_string(),
            description: Some("My webhook".to_string()),
            events: Some(vec!["blog.created".to_string(), "blog.updated".to_string()]),
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_create_webhook_valid_no_events() {
        let req = CreateWebhookRequest {
            url: "https://example.com/webhook".to_string(),
            description: None,
            events: None,
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_create_webhook_valid_empty_events() {
        let req = CreateWebhookRequest {
            url: "https://example.com/webhook".to_string(),
            description: None,
            events: Some(vec![]),
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_create_webhook_invalid_url() {
        let req = CreateWebhookRequest {
            url: "not-a-url".to_string(),
            description: None,
            events: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_create_webhook_invalid_event() {
        let req = CreateWebhookRequest {
            url: "https://example.com/webhook".to_string(),
            description: None,
            events: Some(vec![
                "blog.created".to_string(),
                "invalid.event".to_string(),
            ]),
        };
        let result = req.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_create_webhook_description_too_long() {
        let req = CreateWebhookRequest {
            url: "https://example.com/webhook".to_string(),
            description: Some("a".repeat(501)),
            events: None,
        };
        let result = req.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_create_webhook_all_valid_events() {
        let req = CreateWebhookRequest {
            url: "https://example.com/webhook".to_string(),
            description: None,
            events: Some(VALID_WEBHOOK_EVENTS.iter().map(|e| e.to_string()).collect()),
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_update_webhook_valid() {
        let req = UpdateWebhookRequest {
            url: Some("https://updated.example.com/hook".to_string()),
            description: Some("Updated description".to_string()),
            events: Some(vec!["page.created".to_string()]),
            is_active: Some(false),
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_update_webhook_all_none() {
        let req = UpdateWebhookRequest {
            url: None,
            description: None,
            events: None,
            is_active: None,
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_update_webhook_invalid_event() {
        let req = UpdateWebhookRequest {
            url: None,
            description: None,
            events: Some(vec!["unknown.event".to_string()]),
            is_active: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_update_webhook_description_too_long() {
        let req = UpdateWebhookRequest {
            url: None,
            description: Some("a".repeat(501)),
            events: None,
            is_active: None,
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_webhook_response_serialization() {
        let resp = WebhookResponse {
            id: Uuid::new_v4(),
            site_id: Uuid::new_v4(),
            url: "https://example.com/hook".to_string(),
            description: Some("Test".to_string()),
            events: vec!["blog.created".to_string()],
            is_active: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"is_active\":true"));
        assert!(json.contains("\"blog.created\""));
    }

    #[test]
    fn test_webhook_delivery_response_serialization() {
        let resp = WebhookDeliveryResponse {
            id: Uuid::new_v4(),
            webhook_id: Uuid::new_v4(),
            event_type: "blog.created".to_string(),
            payload: serde_json::json!({"id": "123"}),
            status_code: Some(200),
            response_body: Some("OK".to_string()),
            error_message: None,
            attempt_number: 1,
            delivered_at: Utc::now(),
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"status_code\":200"));
        assert!(json.contains("\"attempt_number\":1"));
    }
}
