//! Notification DTOs

use chrono::{DateTime, Utc};
use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::models::notification::Notification;
use crate::utils::pagination::Paginated;

/// Notification response.
#[derive(Debug, Serialize, ToSchema)]
pub struct NotificationResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,
    #[schema(example = "660e8400-e29b-41d4-a716-446655440000")]
    pub site_id: Uuid,
    #[schema(example = "user_2abc123def456")]
    pub actor_clerk_id: Option<String>,
    #[schema(example = "review_submitted")]
    pub notification_type: String,
    #[schema(example = "blog")]
    pub entity_type: String,
    #[schema(example = "770e8400-e29b-41d4-a716-446655440000")]
    pub entity_id: Uuid,
    #[schema(example = "New review on your post")]
    pub title: String,
    #[schema(example = "Please review the changes")]
    pub message: Option<String>,
    #[schema(example = false)]
    pub is_read: bool,
    #[schema(example = "2024-06-15T12:00:00Z")]
    pub read_at: Option<DateTime<Utc>>,
    #[schema(example = "2024-06-15T10:00:00Z")]
    pub created_at: DateTime<Utc>,
}

impl From<Notification> for NotificationResponse {
    fn from(n: Notification) -> Self {
        Self {
            id: n.id,
            site_id: n.site_id,
            actor_clerk_id: n.actor_clerk_id,
            notification_type: n.notification_type,
            entity_type: n.entity_type,
            entity_id: n.entity_id,
            title: n.title,
            message: n.message,
            is_read: n.is_read,
            read_at: n.read_at,
            created_at: n.created_at,
        }
    }
}

/// Unread notification count response.
#[derive(Debug, Serialize, ToSchema)]
pub struct UnreadCountResponse {
    #[schema(example = 5)]
    pub unread_count: i64,
}

/// Response after marking all notifications as read.
#[derive(Debug, Serialize, ToSchema)]
pub struct MarkAllReadResponse {
    #[schema(example = 3)]
    pub updated: i64,
}

/// Paginated notifications.
pub type PaginatedNotifications = Paginated<NotificationResponse>;

#[cfg(test)]
mod tests {
    use super::*;

    fn make_test_notification() -> Notification {
        Notification {
            id: Uuid::new_v4(),
            site_id: Uuid::new_v4(),
            recipient_clerk_id: "user_recipient".to_string(),
            actor_clerk_id: Some("user_actor".to_string()),
            notification_type: "review_submitted".to_string(),
            entity_type: "blog".to_string(),
            entity_id: Uuid::new_v4(),
            title: "New review on your post".to_string(),
            message: Some("Please review the changes.".to_string()),
            is_read: false,
            read_at: None,
            created_at: Utc::now(),
        }
    }

    #[test]
    fn test_notification_response_from_model() {
        let notif = make_test_notification();
        let id = notif.id;
        let resp = NotificationResponse::from(notif);
        assert_eq!(resp.id, id);
        assert_eq!(resp.notification_type, "review_submitted");
        assert_eq!(resp.entity_type, "blog");
        assert!(!resp.is_read);
        assert!(resp.read_at.is_none());
    }

    #[test]
    fn test_notification_response_serialization() {
        let notif = make_test_notification();
        let resp = NotificationResponse::from(notif);
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"notification_type\":\"review_submitted\""));
        assert!(json.contains("\"is_read\":false"));
        assert!(json.contains("\"entity_type\":\"blog\""));
        assert!(json.contains("\"title\":\"New review on your post\""));
    }

    #[test]
    fn test_notification_response_read_state() {
        let mut notif = make_test_notification();
        notif.is_read = true;
        notif.read_at = Some(Utc::now());
        let resp = NotificationResponse::from(notif);
        assert!(resp.is_read);
        assert!(resp.read_at.is_some());
    }

    #[test]
    fn test_notification_response_no_actor() {
        let mut notif = make_test_notification();
        notif.actor_clerk_id = None;
        let resp = NotificationResponse::from(notif);
        assert!(resp.actor_clerk_id.is_none());
    }

    #[test]
    fn test_unread_count_response_serialization() {
        let resp = UnreadCountResponse { unread_count: 42 };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"unread_count\":42"));
    }

    #[test]
    fn test_mark_all_read_response_serialization() {
        let resp = MarkAllReadResponse { updated: 5 };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"updated\":5"));
    }
}
