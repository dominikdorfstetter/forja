//! Per-site storage quota enforcement, shared by document and media uploads.
//!
//! Both upload paths cap total stored bytes against one site setting
//! (`storage_quota_bytes`), summing media **and** document usage. The check
//! was copy-pasted in `handlers::media` and `handlers::document`; this is the
//! one seam both call so the default fallback and the aggregation can't drift.

use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::{codes, ApiError};
use crate::models::media::MediaFile;
use crate::models::site_settings::{SiteSetting, KEY_STORAGE_QUOTA_BYTES};
use crate::repos::document_repo::DocumentRepo;

/// Default quota when a site has not configured one: 1 GiB.
pub const DEFAULT_STORAGE_QUOTA_BYTES: i64 = 1_073_741_824;

/// Storage-quota gate shared by the document and media upload handlers.
pub struct StorageQuota;

impl StorageQuota {
    /// Reject `incoming_bytes` when it would push the site's combined
    /// media + document usage over its configured quota.
    pub async fn check(pool: &PgPool, site_id: Uuid, incoming_bytes: i64) -> Result<(), ApiError> {
        let quota = SiteSetting::get_value(pool, site_id, KEY_STORAGE_QUOTA_BYTES)
            .await?
            .as_i64()
            .unwrap_or(DEFAULT_STORAGE_QUOTA_BYTES);

        let media_usage = MediaFile::total_storage_for_site(pool, site_id).await?;
        let document_usage = DocumentRepo::total_storage_for_site(pool, site_id).await?;
        let current_usage = media_usage + document_usage;

        Self::enforce(current_usage, incoming_bytes, quota)
    }

    /// Pure boundary check: the upload is allowed iff it does not push usage
    /// strictly above the quota (exactly-at-quota is accepted).
    fn enforce(current_usage: i64, incoming_bytes: i64, quota: i64) -> Result<(), ApiError> {
        if current_usage + incoming_bytes > quota {
            return Err(ApiError::payload_too_large(format!(
                "Storage quota exceeded: {} bytes used of {} byte quota, upload of {} bytes rejected",
                current_usage, quota, incoming_bytes
            ))
            .with_code(codes::STORAGE_QUOTA_EXCEEDED));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_when_over_quota() {
        let err = StorageQuota::enforce(900, 200, 1000).expect_err("over quota must reject");
        assert_eq!(err.code(), codes::STORAGE_QUOTA_EXCEEDED);
    }

    #[test]
    fn accepts_exactly_at_quota() {
        // Boundary: filling the quota to the byte is allowed.
        assert!(StorageQuota::enforce(800, 200, 1000).is_ok());
    }

    #[test]
    fn accepts_under_quota() {
        assert!(StorageQuota::enforce(100, 200, 1000).is_ok());
    }
}
