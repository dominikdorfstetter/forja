//! Analytics DTOs

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::models::analytics::{DailyTrendRow, TopContentRow};

/// Request to record a pageview (from tracking snippet)
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Record a pageview event")]
pub struct TrackPageviewRequest {
    /// Page path (e.g., "/blog/my-post")
    #[schema(example = "/blog/my-post")]
    #[validate(length(min = 1, max = 2048))]
    pub path: String,

    /// Full referrer URL (domain will be extracted, full URL discarded)
    #[schema(example = "https://twitter.com/user/status/123")]
    pub referrer: Option<String>,

    /// Hashed user agent from client (optional, server computes its own hash)
    #[schema(example = "abc123")]
    pub user_agent_hash: Option<String>,
}

/// Top content item in analytics report
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Top content item with view counts")]
pub struct TopContentItem {
    /// Page path
    #[schema(example = "/blog/my-post")]
    pub path: String,
    /// Total page views
    #[schema(example = 142)]
    pub total_views: i64,
    /// Approximate unique visitors (based on daily-rotated hash)
    #[schema(example = 89)]
    pub unique_visitors: i64,
}

impl From<TopContentRow> for TopContentItem {
    fn from(row: TopContentRow) -> Self {
        Self {
            path: row.path,
            total_views: row.total_views,
            unique_visitors: row.unique_visitors,
        }
    }
}

/// Single data point in a daily trend
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Daily view trend data point")]
pub struct TrendDataPoint {
    /// Date (YYYY-MM-DD)
    #[schema(example = "2024-06-15")]
    pub date: NaiveDate,
    /// Total views on this day
    #[schema(example = 42)]
    pub total_views: i64,
    /// Approximate unique visitors on this day
    #[schema(example = 28)]
    pub unique_visitors: i64,
}

impl From<DailyTrendRow> for TrendDataPoint {
    fn from(row: DailyTrendRow) -> Self {
        Self {
            date: row.date,
            total_views: row.total_views,
            unique_visitors: row.unique_visitors,
        }
    }
}

/// Analytics report response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Analytics report with top content and trends")]
pub struct AnalyticsReportResponse {
    /// Total page views in the period
    #[schema(example = 1234)]
    pub total_views: i64,
    /// Approximate unique visitors in the period
    #[schema(example = 567)]
    pub total_unique_visitors: i64,
    /// Top content by views
    pub top_content: Vec<TopContentItem>,
    /// Daily view trend
    pub trend: Vec<TrendDataPoint>,
}

/// Response after recording a pageview
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Pageview recorded acknowledgement")]
pub struct TrackPageviewResponse {
    #[schema(example = true)]
    pub ok: bool,
}

/// Aggregation result response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Result of analytics aggregation/pruning")]
pub struct AnalyticsMaintenanceResponse {
    #[schema(example = 1500)]
    pub rows_affected: u64,
    #[schema(example = "aggregate")]
    pub action: String,
}
