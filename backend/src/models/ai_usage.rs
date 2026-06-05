//! AI usage log — one row per successful `ai_service::generate` call.
//!
//! See migration `20240101000062_ai_usage_logs.sql`. The table is the
//! source of truth for the admin AI usage page and (later) for plan-limit
//! enforcement (#429). Failed AI calls do NOT write a row, so client-side
//! retries cannot double-count.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;

/// One persisted AI usage record.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct AiUsageLog {
    pub id: Uuid,
    pub site_id: Uuid,
    /// NULL when the row has been DSR-anonymised (#649) while preserving
    /// the aggregate counter, or when the action wasn't tied to a user.
    pub actor_id: Option<Uuid>,
    pub action: String,
    pub provider: String,
    pub model: String,
    pub input_tokens: Option<i32>,
    pub output_tokens: Option<i32>,
    pub created_at: DateTime<Utc>,
}

/// Optional inputs to `AiUsageLog::insert`. Token counts are `Option<i32>`
/// because some providers (Ollama, local LM Studio) do not return usage.
#[derive(Debug)]
pub struct NewAiUsage<'a> {
    pub site_id: Uuid,
    pub actor_id: Option<Uuid>,
    pub action: &'a str,
    pub provider: &'a str,
    pub model: &'a str,
    pub input_tokens: Option<i32>,
    pub output_tokens: Option<i32>,
}

/// Filters for the usage list query. All optional; stack additively.
#[derive(Debug, Default, Clone)]
pub struct AiUsageFilters {
    pub from_date: Option<DateTime<Utc>>,
    pub to_date: Option<DateTime<Utc>>,
    pub action: Option<String>,
    pub provider: Option<String>,
    /// When `Some`, restrict to a single actor — used to enforce
    /// editor/author "own only" visibility at the query level so 403
    /// hides behind a filtered result, not a separate code path.
    pub actor_id: Option<Uuid>,
}

/// Group-by axis for aggregation queries.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum GroupBy {
    Action,
    Provider,
    User,
}

/// One row of an aggregation response.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, utoipa::ToSchema)]
pub struct AiUsageBucket {
    /// The grouping key. For `Action` and `Provider` this is the string;
    /// for `User` this is the actor_id as a string (or `"anonymous"` for NULL).
    pub key: String,
    pub call_count: i64,
    /// Sum of `input_tokens` over the bucket. NULL when no provider reported tokens.
    pub input_tokens: Option<i64>,
    /// Sum of `output_tokens` over the bucket. NULL when no provider reported tokens.
    pub output_tokens: Option<i64>,
}

impl AiUsageLog {
    /// Insert a new usage row. Returns the inserted record.
    pub async fn insert(pool: &PgPool, new: NewAiUsage<'_>) -> Result<Self, ApiError> {
        let row = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO ai_usage_logs
                (site_id, actor_id, action, provider, model, input_tokens, output_tokens)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, site_id, actor_id, action, provider, model,
                      input_tokens, output_tokens, created_at
            "#,
        )
        .bind(new.site_id)
        .bind(new.actor_id)
        .bind(new.action)
        .bind(new.provider)
        .bind(new.model)
        .bind(new.input_tokens)
        .bind(new.output_tokens)
        .fetch_one(pool)
        .await?;
        Ok(row)
    }

    /// List usage rows for a site with optional filters. Newest first.
    /// `limit` is capped at 1000 by the caller (handler layer).
    pub async fn list_for_site(
        pool: &PgPool,
        site_id: Uuid,
        filters: &AiUsageFilters,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, ApiError> {
        let mut where_clauses = vec!["site_id = $1".to_string()];
        let mut bind_idx = 4u32; // $1=site_id, $2=limit, $3=offset

        if filters.from_date.is_some() {
            where_clauses.push(format!("created_at >= ${bind_idx}"));
            bind_idx += 1;
        }
        if filters.to_date.is_some() {
            where_clauses.push(format!("created_at <= ${bind_idx}"));
            bind_idx += 1;
        }
        if filters.action.is_some() {
            where_clauses.push(format!("action = ${bind_idx}"));
            bind_idx += 1;
        }
        if filters.provider.is_some() {
            where_clauses.push(format!("provider = ${bind_idx}"));
            bind_idx += 1;
        }
        if filters.actor_id.is_some() {
            where_clauses.push(format!("actor_id = ${bind_idx}"));
            bind_idx += 1;
        }
        let _ = bind_idx;

        let sql = format!(
            "SELECT id, site_id, actor_id, action, provider, model, \
                    input_tokens, output_tokens, created_at \
             FROM ai_usage_logs \
             WHERE {} \
             ORDER BY created_at DESC \
             LIMIT $2 OFFSET $3",
            where_clauses.join(" AND ")
        );

        let mut q = sqlx::query_as::<_, Self>(&sql)
            .bind(site_id)
            .bind(limit)
            .bind(offset);
        if let Some(from) = filters.from_date {
            q = q.bind(from);
        }
        if let Some(to) = filters.to_date {
            q = q.bind(to);
        }
        if let Some(ref action) = filters.action {
            q = q.bind(action);
        }
        if let Some(ref provider) = filters.provider {
            q = q.bind(provider);
        }
        if let Some(actor) = filters.actor_id {
            q = q.bind(actor);
        }

        Ok(q.fetch_all(pool).await?)
    }

    /// Aggregate rows by the chosen axis, returning one bucket per key.
    pub async fn aggregate_for_site(
        pool: &PgPool,
        site_id: Uuid,
        group_by: GroupBy,
        filters: &AiUsageFilters,
    ) -> Result<Vec<AiUsageBucket>, ApiError> {
        let key_expr = match group_by {
            GroupBy::Action => "action",
            GroupBy::Provider => "provider",
            // COALESCE so NULL actor_id (e.g. DSR-anonymised rows) shows
            // as "anonymous" rather than being silently dropped.
            GroupBy::User => "COALESCE(actor_id::text, 'anonymous')",
        };

        let mut where_clauses = vec!["site_id = $1".to_string()];
        let mut bind_idx = 2u32;

        if filters.from_date.is_some() {
            where_clauses.push(format!("created_at >= ${bind_idx}"));
            bind_idx += 1;
        }
        if filters.to_date.is_some() {
            where_clauses.push(format!("created_at <= ${bind_idx}"));
            bind_idx += 1;
        }
        if filters.action.is_some() {
            where_clauses.push(format!("action = ${bind_idx}"));
            bind_idx += 1;
        }
        if filters.provider.is_some() {
            where_clauses.push(format!("provider = ${bind_idx}"));
            bind_idx += 1;
        }
        if filters.actor_id.is_some() {
            where_clauses.push(format!("actor_id = ${bind_idx}"));
            bind_idx += 1;
        }
        let _ = bind_idx;

        let sql = format!(
            "SELECT {key_expr} AS key, \
                    COUNT(*)::BIGINT AS call_count, \
                    SUM(input_tokens)::BIGINT AS input_tokens, \
                    SUM(output_tokens)::BIGINT AS output_tokens \
             FROM ai_usage_logs \
             WHERE {} \
             GROUP BY {key_expr} \
             ORDER BY call_count DESC",
            where_clauses.join(" AND ")
        );

        let mut q = sqlx::query_as::<_, AiUsageBucket>(&sql).bind(site_id);
        if let Some(from) = filters.from_date {
            q = q.bind(from);
        }
        if let Some(to) = filters.to_date {
            q = q.bind(to);
        }
        if let Some(ref action) = filters.action {
            q = q.bind(action);
        }
        if let Some(ref provider) = filters.provider {
            q = q.bind(provider);
        }
        if let Some(actor) = filters.actor_id {
            q = q.bind(actor);
        }

        Ok(q.fetch_all(pool).await?)
    }
}
