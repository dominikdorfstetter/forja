//! DTOs for the per-site AI usage endpoint.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::models::ai_usage::{AiUsageBucket, AiUsageLog, GroupBy};

/// One AI usage record as returned to the admin UI.
#[derive(Debug, Serialize, ToSchema)]
pub struct AiUsageLogResponse {
    pub id: Uuid,
    pub site_id: Uuid,
    pub actor_id: Option<Uuid>,
    pub action: String,
    pub provider: String,
    pub model: String,
    pub input_tokens: Option<i32>,
    pub output_tokens: Option<i32>,
    pub created_at: DateTime<Utc>,
}

impl From<AiUsageLog> for AiUsageLogResponse {
    fn from(l: AiUsageLog) -> Self {
        Self {
            id: l.id,
            site_id: l.site_id,
            actor_id: l.actor_id,
            action: l.action,
            provider: l.provider,
            model: l.model,
            input_tokens: l.input_tokens,
            output_tokens: l.output_tokens,
            created_at: l.created_at,
        }
    }
}

/// One row of an aggregated usage response.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct AiUsageBucketResponse {
    pub key: String,
    pub call_count: i64,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
}

impl From<AiUsageBucket> for AiUsageBucketResponse {
    fn from(b: AiUsageBucket) -> Self {
        Self {
            key: b.key,
            call_count: b.call_count,
            input_tokens: b.input_tokens,
            output_tokens: b.output_tokens,
        }
    }
}

/// Top-level response. Includes both the raw row sample (capped) and the
/// aggregation so the admin page can render a chart + table from one call.
#[derive(Debug, Serialize, ToSchema)]
pub struct AiUsageResponse {
    pub group_by: GroupBy,
    pub buckets: Vec<AiUsageBucketResponse>,
    pub items: Vec<AiUsageLogResponse>,
    /// `true` when the response is scoped to the current user's own rows
    /// because they lack the `:any` permission. Lets the UI show a hint.
    pub own_only: bool,
}
