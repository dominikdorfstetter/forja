//! GDPR user-data queries: the export row queries and account-erasure
//! statements that span user-referencing tables (api_keys, audit_logs,
//! change_history, contents, notifications, site_memberships, sites,
//! system_admins). Extracted from the auth and clerk_user handlers so the
//! SQL lives behind one tested seam.
//!
//! The erasure statements implement the `anonymize_on_erasure` contract
//! declared per field in `models::builtin_pii` (#19); the registry's RoPA
//! claims are only true because these statements run on account deletion.

use chrono::{DateTime, Utc};
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use crate::models::api_key::{ApiKeyPermission, ApiKeyStatus};
use crate::models::audit::ChangeHistory;

/// Row shape for the API-key section of a GDPR export.
#[derive(Debug, sqlx::FromRow)]
pub struct ApiKeyExportRow {
    pub id: Uuid,
    pub name: String,
    pub permission: ApiKeyPermission,
    pub site_id: Option<Uuid>,
    pub status: ApiKeyStatus,
    pub created_at: DateTime<Utc>,
}

/// Non-deleted content rows authored by a user, by entity type.
#[derive(Debug)]
pub struct AuthoredContentCounts {
    pub blogs: i64,
    pub pages: i64,
    pub documents: i64,
    pub legal_docs: i64,
}

/// API keys the user owns or created, newest first.
pub async fn api_keys_for_user(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<ApiKeyExportRow>, sqlx::Error> {
    sqlx::query_as(
        r#"
        SELECT id, name, permission, site_id, status, created_at
        FROM api_keys
        WHERE user_id = $1 OR created_by = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}

/// Most recent change-history rows authored by the user.
pub async fn change_history_for_user(
    pool: &PgPool,
    user_id: Uuid,
    limit: i64,
) -> Result<Vec<ChangeHistory>, sqlx::Error> {
    sqlx::query_as(
        r#"
        SELECT id, site_id, entity_type, entity_id, field_name,
               old_value, new_value, changed_by, changed_at
        FROM change_history
        WHERE changed_by = $1
        ORDER BY changed_at DESC
        LIMIT $2
        "#,
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(pool)
    .await
}

/// Count non-deleted content authored by a Clerk user, per entity type.
pub async fn authored_content_counts(
    pool: &PgPool,
    clerk_user_id: &str,
) -> Result<AuthoredContentCounts, sqlx::Error> {
    let (blogs, pages, documents, legal_docs): (i64, i64, i64, i64) = sqlx::query_as(
        r#"
        SELECT
            COALESCE((SELECT COUNT(*) FROM contents WHERE created_by = $1 AND is_deleted = FALSE
                AND entity_type_id = (SELECT id FROM entity_types WHERE name = 'blog')), 0),
            COALESCE((SELECT COUNT(*) FROM contents WHERE created_by = $1 AND is_deleted = FALSE
                AND entity_type_id = (SELECT id FROM entity_types WHERE name = 'page')), 0),
            COALESCE((SELECT COUNT(*) FROM contents WHERE created_by = $1 AND is_deleted = FALSE
                AND entity_type_id = (SELECT id FROM entity_types WHERE name = 'document')), 0),
            COALESCE((SELECT COUNT(*) FROM contents WHERE created_by = $1 AND is_deleted = FALSE
                AND entity_type_id = (SELECT id FROM entity_types WHERE name = 'legal')), 0)
        "#,
    )
    .bind(clerk_user_id)
    .fetch_one(pool)
    .await?;

    Ok(AuthoredContentCounts {
        blogs,
        pages,
        documents,
        legal_docs,
    })
}

/// Account deletion: drop system-admin status and null every reference to
/// the user across api_keys, audit_logs, change_history, authored contents,
/// membership invites, site provenance and notifications, atomically.
pub async fn anonymize_user_records(
    pool: &PgPool,
    clerk_user_id: &str,
    user_id: Uuid,
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    sqlx::query("DELETE FROM system_admins WHERE clerk_user_id = $1")
        .bind(clerk_user_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("UPDATE api_keys SET user_id = NULL WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("UPDATE api_keys SET created_by = NULL WHERE created_by = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("UPDATE audit_logs SET user_id = NULL WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("UPDATE change_history SET changed_by = NULL WHERE changed_by = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

    // Built-in identity fields keyed by Clerk id (#19): authored content,
    // invitation attribution, site provenance, notification identities.
    anonymize_authored_content_on(&mut tx, clerk_user_id).await?;
    sqlx::query("UPDATE site_memberships SET invited_by = NULL WHERE invited_by = $1")
        .bind(clerk_user_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("UPDATE sites SET created_by = NULL WHERE created_by = $1")
        .bind(clerk_user_id)
        .execute(&mut *tx)
        .await?;
    // The user's own inbox carries their identity as the row's purpose —
    // delete it; on other users' notifications only the actor is anonymized.
    sqlx::query("DELETE FROM notifications WHERE recipient_clerk_id = $1")
        .bind(clerk_user_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("UPDATE notifications SET actor_clerk_id = NULL WHERE actor_clerk_id = $1")
        .bind(clerk_user_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await
}

/// Null the erased user's identity on every contents identity column
/// (created_by / updated_by / deleted_by) in one pass, leaving other users'
/// attribution untouched. Shared by account deletion (inside its
/// transaction) and the banned-user purge.
async fn anonymize_authored_content_on(
    conn: &mut PgConnection,
    clerk_user_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE contents SET
            created_by = CASE WHEN created_by = $1 THEN NULL ELSE created_by END,
            updated_by = CASE WHEN updated_by = $1 THEN NULL ELSE updated_by END,
            deleted_by = CASE WHEN deleted_by = $1 THEN NULL ELSE deleted_by END
        WHERE created_by = $1 OR updated_by = $1 OR deleted_by = $1
        "#,
    )
    .bind(clerk_user_id)
    .execute(conn)
    .await
    .map(|_| ())
}

/// Detach a Clerk user from all content they authored, edited or deleted
/// (banned-user purge).
pub async fn anonymize_authored_content(
    pool: &PgPool,
    clerk_user_id: &str,
) -> Result<(), sqlx::Error> {
    let mut conn = pool.acquire().await?;
    anonymize_authored_content_on(&mut conn, clerk_user_id).await
}

/// Live record count for one identity-bearing field of the builtin PII
/// registry, for a specific user.
#[derive(Debug, sqlx::FromRow)]
pub struct PiiFieldCount {
    pub table: String,
    pub field: String,
    pub record_count: i64,
}

/// How many rows currently carry the user's identity, per registry field
/// (`models::builtin_pii::REGISTRY`). One row per (table, field); the
/// identifier each field is matched on mirrors the erasure statements in
/// [`anonymize_user_records`] — Clerk id for TEXT identity columns, the
/// actor UUID for audit/key columns. A registry field missing here fails
/// `tests/pii_inventory_test.rs`'s completeness guard.
pub async fn pii_record_counts(
    pool: &PgPool,
    clerk_user_id: &str,
    user_id: Uuid,
) -> Result<Vec<PiiFieldCount>, sqlx::Error> {
    sqlx::query_as(
        r#"
        SELECT 'contents' AS "table", 'created_by' AS field,
               COUNT(*)::BIGINT AS record_count FROM contents WHERE created_by = $1
        UNION ALL
        SELECT 'contents', 'updated_by', COUNT(*)::BIGINT FROM contents WHERE updated_by = $1
        UNION ALL
        SELECT 'contents', 'deleted_by', COUNT(*)::BIGINT FROM contents WHERE deleted_by = $1
        UNION ALL
        SELECT 'site_memberships', 'clerk_user_id', COUNT(*)::BIGINT
            FROM site_memberships WHERE clerk_user_id = $1
        UNION ALL
        SELECT 'site_memberships', 'invited_by', COUNT(*)::BIGINT
            FROM site_memberships WHERE invited_by = $1
        UNION ALL
        SELECT 'audit_logs', 'user_id', COUNT(*)::BIGINT FROM audit_logs WHERE user_id = $2
        UNION ALL
        SELECT 'change_history', 'changed_by', COUNT(*)::BIGINT
            FROM change_history WHERE changed_by = $2
        UNION ALL
        SELECT 'notifications', 'recipient_clerk_id', COUNT(*)::BIGINT
            FROM notifications WHERE recipient_clerk_id = $1
        UNION ALL
        SELECT 'notifications', 'actor_clerk_id', COUNT(*)::BIGINT
            FROM notifications WHERE actor_clerk_id = $1
        UNION ALL
        SELECT 'api_keys', 'user_id', COUNT(*)::BIGINT FROM api_keys WHERE user_id = $2
        UNION ALL
        SELECT 'api_keys', 'created_by', COUNT(*)::BIGINT FROM api_keys WHERE created_by = $2
        UNION ALL
        SELECT 'sites', 'created_by', COUNT(*)::BIGINT FROM sites WHERE created_by = $1
        "#,
    )
    .bind(clerk_user_id)
    .bind(user_id)
    .fetch_all(pool)
    .await
}
