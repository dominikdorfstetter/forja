//! Bulk content service — shared logic for bulk status updates and deletes

use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::bulk::{BulkContentResponse, BulkItemResult};
use crate::models::content::ContentStatus;
use crate::services::content_service::ContentService;

pub struct BulkContentService;

impl BulkContentService {
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
