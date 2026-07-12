//! Audit model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::utils::list_params::ListParams;

/// Entity types that are logged for book-keeping but should never appear
/// in the admin activity list — they're side-effects of real user
/// actions (e.g. ai_generation is emitted alongside a blog Update and
/// would dominate the feed). Usage counts for these live in dedicated
/// stats endpoints instead.
pub const AUDIT_LIST_HIDDEN_ENTITY_TYPES: &[&str] = &["ai_generation"];

/// Filters for the audit list endpoint beyond the generic search/sort
/// in `ListParams`. All fields are optional and stack additively.
#[derive(Debug, Default, Clone, Copy)]
pub struct AuditListFilters<'a> {
    pub action: Option<&'a str>,
    pub entity_type: Option<&'a str>,
    pub from_date: Option<DateTime<Utc>>,
    pub to_date: Option<DateTime<Utc>>,
}

/// Audit action enum matching PostgreSQL
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, utoipa::ToSchema)]
#[sqlx(type_name = "audit_action", rename_all = "lowercase")]
pub enum AuditAction {
    Create,
    Read,
    Update,
    Delete,
    Publish,
    Unpublish,
    Archive,
    Restore,
    Login,
    Logout,
    #[sqlx(rename = "submit_review")]
    SubmitReview,
    #[sqlx(rename = "approve")]
    Approve,
    #[sqlx(rename = "request_changes")]
    RequestChanges,
    #[sqlx(rename = "settings_update")]
    SettingsUpdate,
    #[sqlx(rename = "permission_denied")]
    PermissionDenied,
    #[sqlx(rename = "ownership_transfer")]
    OwnershipTransfer,
    Export,
}

/// Audit log entry
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AuditLog {
    pub id: Uuid,
    pub site_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    pub action: AuditAction,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

/// Change history entry
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ChangeHistory {
    pub id: Uuid,
    pub site_id: Option<Uuid>,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub field_name: Option<String>,
    pub old_value: Option<serde_json::Value>,
    pub new_value: Option<serde_json::Value>,
    pub changed_by: Option<Uuid>,
    pub changed_at: DateTime<Utc>,
}

impl AuditLog {
    /// Find audit logs for a site
    pub async fn find_for_site(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, ApiError> {
        let logs = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, user_id, action, entity_type, entity_id,
                   ip_address::TEXT as ip_address, user_agent, metadata, created_at
            FROM audit_logs
            WHERE site_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(site_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok(logs)
    }

    /// Find audit logs for a site (filtered, paginated, sortable)
    pub async fn find_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        params: &ListParams,
    ) -> Result<Vec<Self>, ApiError> {
        Self::find_for_site_filtered_ext(pool, site_id, params, &AuditListFilters::default()).await
    }

    /// Extended list with action/entity-type/date-range filters. Kept
    /// separate from `find_for_site_filtered` so existing callers that
    /// only need search/sort keep working unchanged.
    pub async fn find_for_site_filtered_ext(
        pool: &PgPool,
        site_id: Uuid,
        params: &ListParams,
        filters: &AuditListFilters<'_>,
    ) -> Result<Vec<Self>, ApiError> {
        let (limit, offset) = params.limit_offset();
        let order_col = match params.sort.field_or("created_at") {
            "action" => "al.action",
            _ => "al.created_at",
        };

        let mut where_clauses = vec!["al.site_id = $1".to_string()];
        let mut bind_idx = 4u32; // $1=site_id, $2=limit, $3=offset

        if params.search.is_some() {
            where_clauses.push(format!(
                "(al.entity_type ILIKE '%' || ${bind_idx} || '%' OR al.action::text ILIKE '%' || ${bind_idx} || '%')"
            ));
            bind_idx += 1;
        }
        if filters.action.is_some() {
            where_clauses.push(format!("al.action::text = ${bind_idx}"));
            bind_idx += 1;
        }
        if filters.entity_type.is_some() {
            where_clauses.push(format!("al.entity_type = ${bind_idx}"));
            bind_idx += 1;
        }
        if filters.from_date.is_some() {
            where_clauses.push(format!("al.created_at >= ${bind_idx}"));
            bind_idx += 1;
        }
        if filters.to_date.is_some() {
            where_clauses.push(format!("al.created_at <= ${bind_idx}"));
            bind_idx += 1;
        }
        let _ = bind_idx;

        // Hide internal bookkeeping rows from the admin activity feed —
        // applied unconditionally so callers can't forget it and repaint
        // the "pollution" UX bug. If a caller needs an explicit match
        // through entity_type filter, the filter runs first and the
        // overlap with hidden types yields an empty result (desired).
        if !AUDIT_LIST_HIDDEN_ENTITY_TYPES.is_empty() {
            let hidden_list = AUDIT_LIST_HIDDEN_ENTITY_TYPES
                .iter()
                .map(|t| format!("'{}'", t))
                .collect::<Vec<_>>()
                .join(", ");
            where_clauses.push(format!("al.entity_type NOT IN ({})", hidden_list));
        }

        let sql = format!(
            "SELECT al.id, al.site_id, al.user_id, al.action, al.entity_type, al.entity_id, \
                    al.ip_address::TEXT as ip_address, al.user_agent, al.metadata, al.created_at \
             FROM audit_logs al \
             WHERE {} \
             ORDER BY {} \
             LIMIT $2 OFFSET $3",
            where_clauses.join(" AND "),
            params.sort.order_clause(order_col)
        );

        let mut query = sqlx::query_as::<_, Self>(sqlx::AssertSqlSafe(sql))
            .bind(site_id)
            .bind(limit)
            .bind(offset);
        if let Some(s) = params.search_ref() {
            query = query.bind(s);
        }
        if let Some(a) = filters.action {
            query = query.bind(a);
        }
        if let Some(e) = filters.entity_type {
            query = query.bind(e);
        }
        if let Some(f) = filters.from_date {
            query = query.bind(f);
        }
        if let Some(t) = filters.to_date {
            query = query.bind(t);
        }

        let logs = query.fetch_all(pool).await?;
        Ok(logs)
    }

    /// Count audit logs for a site (with optional search filter)
    pub async fn count_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        search: Option<&str>,
    ) -> Result<i64, ApiError> {
        Self::count_for_site_filtered_ext(pool, site_id, search, &AuditListFilters::default()).await
    }

    pub async fn count_for_site_filtered_ext(
        pool: &PgPool,
        site_id: Uuid,
        search: Option<&str>,
        filters: &AuditListFilters<'_>,
    ) -> Result<i64, ApiError> {
        let mut where_clauses = vec!["al.site_id = $1".to_string()];
        let mut bind_idx = 2u32;

        if search.is_some() {
            where_clauses.push(format!(
                "(al.entity_type ILIKE '%' || ${bind_idx} || '%' OR al.action::text ILIKE '%' || ${bind_idx} || '%')"
            ));
            bind_idx += 1;
        }
        if filters.action.is_some() {
            where_clauses.push(format!("al.action::text = ${bind_idx}"));
            bind_idx += 1;
        }
        if filters.entity_type.is_some() {
            where_clauses.push(format!("al.entity_type = ${bind_idx}"));
            bind_idx += 1;
        }
        if filters.from_date.is_some() {
            where_clauses.push(format!("al.created_at >= ${bind_idx}"));
            bind_idx += 1;
        }
        if filters.to_date.is_some() {
            where_clauses.push(format!("al.created_at <= ${bind_idx}"));
            bind_idx += 1;
        }
        let _ = bind_idx;

        if !AUDIT_LIST_HIDDEN_ENTITY_TYPES.is_empty() {
            let hidden_list = AUDIT_LIST_HIDDEN_ENTITY_TYPES
                .iter()
                .map(|t| format!("'{}'", t))
                .collect::<Vec<_>>()
                .join(", ");
            where_clauses.push(format!("al.entity_type NOT IN ({})", hidden_list));
        }

        let sql = format!(
            "SELECT COUNT(*) FROM audit_logs al WHERE {}",
            where_clauses.join(" AND "),
        );

        let mut query = sqlx::query_as::<_, (i64,)>(sqlx::AssertSqlSafe(sql)).bind(site_id);
        if let Some(s) = search {
            query = query.bind(s);
        }
        if let Some(a) = filters.action {
            query = query.bind(a);
        }
        if let Some(e) = filters.entity_type {
            query = query.bind(e);
        }
        if let Some(f) = filters.from_date {
            query = query.bind(f);
        }
        if let Some(t) = filters.to_date {
            query = query.bind(t);
        }

        let row = query.fetch_one(pool).await?;
        Ok(row.0)
    }

    /// Find audit logs for an entity
    pub async fn find_for_entity(
        pool: &PgPool,
        entity_type: &str,
        entity_id: Uuid,
    ) -> Result<Vec<Self>, ApiError> {
        let logs = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, user_id, action, entity_type, entity_id,
                   ip_address::TEXT as ip_address, user_agent, metadata, created_at
            FROM audit_logs
            WHERE entity_type = $1 AND entity_id = $2
            ORDER BY created_at DESC
            "#,
        )
        .bind(entity_type)
        .bind(entity_id)
        .fetch_all(pool)
        .await?;

        Ok(logs)
    }

    /// Count AI generations logged against a site. Returns `(total,
    /// last_30_days)` — the admin displays these as the "AI usage"
    /// stat alongside the activity list. Hidden rows (filtered out of
    /// the feed) still contribute to the count since they represent
    /// real events.
    pub async fn ai_usage_counts_for_site(
        pool: &PgPool,
        site_id: Uuid,
    ) -> Result<(i64, i64), ApiError> {
        let row: (i64, i64) = sqlx::query_as(
            r#"
            SELECT
                COUNT(*) FILTER (WHERE entity_type = 'ai_generation'),
                COUNT(*) FILTER (WHERE entity_type = 'ai_generation'
                                   AND created_at >= NOW() - INTERVAL '30 days')
            FROM audit_logs
            WHERE site_id = $1
            "#,
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;
        Ok(row)
    }

    /// Resolve a human-readable display string for each `(entity_type,
    /// entity_id)` in `logs`. Issues one small IN query per distinct
    /// entity type; unknown types, hard-deleted rows, or rows without a
    /// localization return `None` and the caller can fall back to a
    /// short UUID in the UI.
    ///
    /// Localized entities (legal, document, navigation_item, cv_entry)
    /// use `DISTINCT ON (entity_id)` against their `*_localizations`
    /// table to pick one deterministic row per entity even though
    /// multiple locales may exist. The locale picked is stable but
    /// arbitrary — the audit log just needs "some" human reference.
    ///
    /// Display columns per type:
    ///   - blog             → contents.slug (JOIN via blogs.content_id)
    ///   - page             → pages.route
    ///   - legal_document   → legal_document_localizations.title
    ///   - site             → sites.name
    ///   - media            → media_files.original_filename
    ///   - document         → document_localizations.name
    ///   - navigation_item  → navigation_item_localizations.title
    ///   - navigation_menu  → navigation_menus.slug
    ///   - cv_entry         → cv_entry_localizations.position
    ///   - skill            → skills.name
    ///   - social_link      → social_links.title
    ///   - tag              → tags.slug
    ///   - category         → categories.slug
    ///   - api_key          → api_keys.name
    pub async fn resolve_entity_displays(
        pool: &PgPool,
        logs: &[Self],
    ) -> std::collections::HashMap<(String, Uuid), String> {
        use std::collections::HashMap;

        let mut bucket: HashMap<&str, Vec<Uuid>> = HashMap::new();
        for log in logs {
            bucket
                .entry(log.entity_type.as_str())
                .or_default()
                .push(log.entity_id);
        }

        let mut out: HashMap<(String, Uuid), String> = HashMap::new();

        async fn fetch(
            pool: &PgPool,
            sql: &str,
            ids: &[Uuid],
            entity_type: &str,
            out: &mut HashMap<(String, Uuid), String>,
        ) {
            if ids.is_empty() {
                return;
            }
            match sqlx::query_as::<_, (Uuid, Option<String>)>(sqlx::AssertSqlSafe(sql))
                .bind(ids)
                .fetch_all(pool)
                .await
            {
                Ok(rows) => {
                    for (id, display) in rows {
                        if let Some(d) = display.filter(|s| !s.is_empty()) {
                            out.insert((entity_type.to_string(), id), d);
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!(
                        target: "audit",
                        entity_type = entity_type,
                        error = %e,
                        "failed to resolve entity displays for audit log"
                    );
                }
            }
        }

        for (ty, ids) in bucket {
            match ty {
                "blog" => {
                    fetch(
                        pool,
                        "SELECT b.id, c.slug::TEXT FROM blogs b \
                         JOIN contents c ON b.content_id = c.id \
                         WHERE b.id = ANY($1)",
                        &ids,
                        ty,
                        &mut out,
                    )
                    .await;
                }
                "page" => {
                    fetch(
                        pool,
                        "SELECT id, route FROM pages WHERE id = ANY($1)",
                        &ids,
                        ty,
                        &mut out,
                    )
                    .await;
                }
                "legal_document" => {
                    fetch(
                        pool,
                        "SELECT DISTINCT ON (legal_document_id) \
                             legal_document_id, title \
                         FROM legal_document_localizations \
                         WHERE legal_document_id = ANY($1) \
                         ORDER BY legal_document_id, locale_id",
                        &ids,
                        ty,
                        &mut out,
                    )
                    .await;
                }
                "site" => {
                    fetch(
                        pool,
                        "SELECT id, name FROM sites WHERE id = ANY($1)",
                        &ids,
                        ty,
                        &mut out,
                    )
                    .await;
                }
                "media" => {
                    fetch(
                        pool,
                        "SELECT id, original_filename FROM media_files WHERE id = ANY($1)",
                        &ids,
                        ty,
                        &mut out,
                    )
                    .await;
                }
                "document" => {
                    fetch(
                        pool,
                        "SELECT DISTINCT ON (document_id) \
                             document_id, name \
                         FROM document_localizations \
                         WHERE document_id = ANY($1) \
                         ORDER BY document_id, locale_id",
                        &ids,
                        ty,
                        &mut out,
                    )
                    .await;
                }
                "navigation_item" => {
                    fetch(
                        pool,
                        "SELECT DISTINCT ON (navigation_item_id) \
                             navigation_item_id, title \
                         FROM navigation_item_localizations \
                         WHERE navigation_item_id = ANY($1) \
                         ORDER BY navigation_item_id, locale_id",
                        &ids,
                        ty,
                        &mut out,
                    )
                    .await;
                }
                "navigation_menu" => {
                    fetch(
                        pool,
                        "SELECT id, slug FROM navigation_menus WHERE id = ANY($1)",
                        &ids,
                        ty,
                        &mut out,
                    )
                    .await;
                }
                "cv_entry" => {
                    fetch(
                        pool,
                        "SELECT DISTINCT ON (cv_entry_id) \
                             cv_entry_id, position \
                         FROM cv_entry_localizations \
                         WHERE cv_entry_id = ANY($1) \
                         ORDER BY cv_entry_id, locale_id",
                        &ids,
                        ty,
                        &mut out,
                    )
                    .await;
                }
                "skill" => {
                    fetch(
                        pool,
                        "SELECT id, name FROM skills WHERE id = ANY($1)",
                        &ids,
                        ty,
                        &mut out,
                    )
                    .await;
                }
                "social_link" => {
                    fetch(
                        pool,
                        "SELECT id, title FROM social_links WHERE id = ANY($1)",
                        &ids,
                        ty,
                        &mut out,
                    )
                    .await;
                }
                "tag" => {
                    fetch(
                        pool,
                        "SELECT id, slug FROM tags WHERE id = ANY($1)",
                        &ids,
                        ty,
                        &mut out,
                    )
                    .await;
                }
                "category" => {
                    fetch(
                        pool,
                        "SELECT id, slug FROM categories WHERE id = ANY($1)",
                        &ids,
                        ty,
                        &mut out,
                    )
                    .await;
                }
                "api_key" => {
                    fetch(
                        pool,
                        "SELECT id, name FROM api_keys WHERE id = ANY($1)",
                        &ids,
                        ty,
                        &mut out,
                    )
                    .await;
                }
                _ => {}
            }
        }

        out
    }

    /// Find audit logs for a user
    pub async fn find_for_user(
        pool: &PgPool,
        user_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, ApiError> {
        let logs = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, user_id, action, entity_type, entity_id,
                   ip_address::TEXT as ip_address, user_agent, metadata, created_at
            FROM audit_logs
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok(logs)
    }

    /// Count audit logs for a user
    pub async fn count_for_user(pool: &PgPool, user_id: Uuid) -> Result<i64, ApiError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM audit_logs WHERE user_id = $1")
            .bind(user_id)
            .fetch_one(pool)
            .await?;
        Ok(count.0)
    }

    /// Create an audit log entry
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        pool: &PgPool,
        site_id: Option<Uuid>,
        user_id: Option<Uuid>,
        action: AuditAction,
        entity_type: &str,
        entity_id: Uuid,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
        metadata: Option<serde_json::Value>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT INTO audit_logs (site_id, user_id, action, entity_type, entity_id, ip_address, user_agent, metadata)
            VALUES ($1, $2, $3, $4, $5, $6::inet, $7, $8)
            "#,
        )
        .bind(site_id)
        .bind(user_id)
        .bind(action)
        .bind(entity_type)
        .bind(entity_id)
        .bind(ip_address)
        .bind(user_agent)
        .bind(metadata)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Insert an audit log entry and return its id.
    ///
    /// Sibling to [`AuditLog::create`] for callers that need to correlate
    /// the audit row with a downstream side effect (e.g. a webhook
    /// envelope that references `audit_id`). Same column set, minus
    /// `ip_address`/`user_agent` which are not used by the
    /// `services::audited_mutation` pipeline today.
    pub async fn create_returning_id(
        pool: &PgPool,
        site_id: Option<Uuid>,
        user_id: Option<Uuid>,
        action: AuditAction,
        entity_type: &str,
        entity_id: Uuid,
        metadata: Option<serde_json::Value>,
    ) -> Result<Uuid, sqlx::Error> {
        let row: (Uuid,) = sqlx::query_as(
            r#"
            INSERT INTO audit_logs (site_id, user_id, action, entity_type, entity_id, metadata)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
            "#,
        )
        .bind(site_id)
        .bind(user_id)
        .bind(action)
        .bind(entity_type)
        .bind(entity_id)
        .bind(metadata)
        .fetch_one(pool)
        .await?;
        Ok(row.0)
    }

    /// Delete audit log entries older than the given cutoff for a specific site.
    ///
    /// Uses the BRIN index on `created_at` for efficient range deletion.
    pub async fn prune_for_site(
        pool: &PgPool,
        site_id: Uuid,
        older_than: DateTime<Utc>,
    ) -> Result<u64, ApiError> {
        let result = sqlx::query(
            r#"
            DELETE FROM audit_logs
            WHERE site_id = $1 AND created_at < $2
            "#,
        )
        .bind(site_id)
        .bind(older_than)
        .execute(pool)
        .await?;
        Ok(result.rows_affected())
    }

    /// Delete audit log entries with no site (system-level) older than the cutoff.
    pub async fn prune_system(pool: &PgPool, older_than: DateTime<Utc>) -> Result<u64, ApiError> {
        let result = sqlx::query(
            r#"
            DELETE FROM audit_logs
            WHERE site_id IS NULL AND created_at < $1
            "#,
        )
        .bind(older_than)
        .execute(pool)
        .await?;
        Ok(result.rows_affected())
    }

    /// Count audit logs for a site
    pub async fn count_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*)
            FROM audit_logs
            WHERE site_id = $1
            "#,
        )
        .bind(site_id)
        .fetch_one(pool)
        .await?;

        Ok(row.0)
    }
}

impl ChangeHistory {
    /// Create a change history entry
    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        pool: &PgPool,
        site_id: Option<Uuid>,
        entity_type: &str,
        entity_id: Uuid,
        field_name: &str,
        old_value: Option<serde_json::Value>,
        new_value: Option<serde_json::Value>,
        changed_by: Option<Uuid>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT INTO change_history (site_id, entity_type, entity_id, field_name, old_value, new_value, changed_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
        )
        .bind(site_id)
        .bind(entity_type)
        .bind(entity_id)
        .bind(field_name)
        .bind(old_value)
        .bind(new_value)
        .bind(changed_by)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Find change history entries by IDs
    pub async fn find_by_ids(pool: &PgPool, ids: &[Uuid]) -> Result<Vec<Self>, ApiError> {
        let history = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, entity_type, entity_id, field_name,
                   old_value, new_value, changed_by, changed_at
            FROM change_history
            WHERE id = ANY($1)
            ORDER BY changed_at DESC
            "#,
        )
        .bind(ids)
        .fetch_all(pool)
        .await?;

        Ok(history)
    }

    /// Delete change history entries older than the given cutoff for a specific site.
    pub async fn prune_for_site(
        pool: &PgPool,
        site_id: Uuid,
        older_than: DateTime<Utc>,
    ) -> Result<u64, ApiError> {
        let result = sqlx::query(
            r#"
            DELETE FROM change_history
            WHERE site_id = $1 AND changed_at < $2
            "#,
        )
        .bind(site_id)
        .bind(older_than)
        .execute(pool)
        .await?;
        Ok(result.rows_affected())
    }

    /// Delete change history entries with no site (system-level) older than the cutoff.
    pub async fn prune_system(pool: &PgPool, older_than: DateTime<Utc>) -> Result<u64, ApiError> {
        let result = sqlx::query(
            r#"
            DELETE FROM change_history
            WHERE site_id IS NULL AND changed_at < $1
            "#,
        )
        .bind(older_than)
        .execute(pool)
        .await?;
        Ok(result.rows_affected())
    }

    /// Find change history for an entity
    pub async fn find_for_entity(
        pool: &PgPool,
        entity_type: &str,
        entity_id: Uuid,
    ) -> Result<Vec<Self>, ApiError> {
        let history = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, entity_type, entity_id, field_name,
                   old_value, new_value, changed_by, changed_at
            FROM change_history
            WHERE entity_type = $1 AND entity_id = $2
            ORDER BY changed_at DESC
            "#,
        )
        .bind(entity_type)
        .bind(entity_id)
        .fetch_all(pool)
        .await?;

        Ok(history)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audit_action_serialization() {
        let action = AuditAction::Create;
        let json = serde_json::to_string(&action).unwrap();
        assert_eq!(json, "\"Create\"");
    }
}
