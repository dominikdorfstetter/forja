//! Bulk content service — shared logic for bulk status updates and deletes

use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::bulk::{BulkAction, BulkContentResponse, BulkItemResult};
use crate::models::audit::AuditAction;
use crate::models::content::ContentStatus;
use crate::services::{audit_service, content_service::ContentService, webhook_service};

pub struct BulkContentService;

impl BulkContentService {
    /// High-level bulk operation processor shared by blog and page handlers.
    ///
    /// Accepts pre-resolved `(entity_id, content_id)` pairs where a nil
    /// `content_id` indicates the entity was not found. Handles:
    /// - Action dispatch (update status or delete)
    /// - Not-found failure assembly
    /// - Per-item audit logging and webhook dispatch
    #[allow(clippy::too_many_arguments)]
    pub async fn process_bulk_operation(
        pool: &PgPool,
        entity_type: &str,
        site_id: Uuid,
        action: &BulkAction,
        status: Option<&ContentStatus>,
        pairs: &[(Uuid, Uuid)],
        user_id: Uuid,
    ) -> BulkContentResponse {
        let valid_pairs: Vec<_> = pairs
            .iter()
            .filter(|(_, cid)| !cid.is_nil())
            .copied()
            .collect();

        let mut resp = match action {
            BulkAction::UpdateStatus => {
                let target_status = status.expect("status required for UpdateStatus");
                Self::bulk_update_status(pool, &valid_pairs, target_status).await
            }
            BulkAction::Delete => Self::bulk_delete(pool, &valid_pairs).await,
        };

        // Add not-found entries as failures
        for &(entity_id, content_id) in pairs {
            if content_id.is_nil() {
                resp.failed += 1;
                resp.results.push(BulkItemResult {
                    id: entity_id,
                    success: false,
                    error: Some(format!(
                        "{} {} not found",
                        capitalize(entity_type),
                        entity_id
                    )),
                });
            }
        }
        resp.total = pairs.len();

        // Audit + webhooks for successful items
        let (audit_action, webhook_event_suffix) = match action {
            BulkAction::UpdateStatus => (AuditAction::Update, "updated"),
            BulkAction::Delete => (AuditAction::Delete, "deleted"),
        };
        let webhook_event = format!("{}.{}", entity_type, webhook_event_suffix);

        for result in &resp.results {
            if result.success {
                let metadata = match action {
                    BulkAction::UpdateStatus => {
                        Some(serde_json::json!({"bulk_action": "update_status", "status": status}))
                    }
                    BulkAction::Delete => Some(serde_json::json!({"bulk_action": "delete"})),
                };
                audit_service::log_action(
                    pool,
                    Some(site_id),
                    Some(user_id),
                    audit_action.clone(),
                    entity_type,
                    result.id,
                    metadata,
                )
                .await;

                let payload = match action {
                    BulkAction::UpdateStatus => {
                        serde_json::json!({"bulk": true, "status": status})
                    }
                    BulkAction::Delete => {
                        serde_json::json!({"id": result.id, "bulk": true})
                    }
                };
                webhook_service::dispatch(
                    pool.clone(),
                    site_id,
                    &webhook_event,
                    result.id,
                    payload,
                );
            }
        }

        resp
    }

    /// Bulk update status for content items.
    /// Each item is processed independently; failures don't affect other items.
    pub async fn bulk_update_status(
        pool: &PgPool,
        content_ids: &[(Uuid, Uuid)], // (entity_id, content_id)
        target_status: &ContentStatus,
    ) -> BulkContentResponse {
        let mut results = Vec::with_capacity(content_ids.len());
        let mut succeeded = 0usize;
        let mut failed = 0usize;

        for &(entity_id, content_id) in content_ids {
            match ContentService::update_content(
                pool,
                content_id,
                None,
                Some(target_status),
                None,
                None,
            )
            .await
            {
                Ok(()) => {
                    succeeded += 1;
                    results.push(BulkItemResult {
                        id: entity_id,
                        success: true,
                        error: None,
                    });
                }
                Err(e) => {
                    failed += 1;
                    results.push(BulkItemResult {
                        id: entity_id,
                        success: false,
                        error: Some(e.to_string()),
                    });
                }
            }
        }

        BulkContentResponse {
            total: content_ids.len(),
            succeeded,
            failed,
            results,
        }
    }

    /// Bulk delete (soft delete) content items.
    /// Each item is processed independently; failures don't affect other items.
    pub async fn bulk_delete(
        pool: &PgPool,
        content_ids: &[(Uuid, Uuid)], // (entity_id, content_id)
    ) -> BulkContentResponse {
        let mut results = Vec::with_capacity(content_ids.len());
        let mut succeeded = 0usize;
        let mut failed = 0usize;

        for &(entity_id, content_id) in content_ids {
            match ContentService::soft_delete_content(pool, content_id).await {
                Ok(()) => {
                    succeeded += 1;
                    results.push(BulkItemResult {
                        id: entity_id,
                        success: true,
                        error: None,
                    });
                }
                Err(e) => {
                    failed += 1;
                    results.push(BulkItemResult {
                        id: entity_id,
                        success: false,
                        error: Some(e.to_string()),
                    });
                }
            }
        }

        BulkContentResponse {
            total: content_ids.len(),
            succeeded,
            failed,
            results,
        }
    }
}

fn capitalize(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().to_string() + c.as_str(),
    }
}
