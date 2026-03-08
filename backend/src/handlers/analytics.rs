//! Analytics handlers
//!
//! Privacy-first pageview tracking and reporting endpoints.
//! No cookies, no IP storage, no PII. GDPR-compliant by design.

use chrono::{Duration, Utc};
use rocket::http::Status;
use rocket::request::{FromRequest, Outcome, Request};
use rocket::serde::json::Json;
use rocket::{get, post, routes, Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::analytics::{
    AnalyticsMaintenanceResponse, AnalyticsReportResponse, TopContentItem, TrackPageviewRequest,
    TrackPageviewResponse, TrendDataPoint,
};
use crate::errors::ApiError;
use crate::guards::auth_guard::ReadKey;
use crate::models::analytics::{compute_visitor_hash, extract_referrer_domain, AnalyticsPageview};
use crate::models::site_membership::SiteRole;
use crate::models::site_settings::{SiteSetting, KEY_ANALYTICS_ENABLED};
use crate::AppState;

/// Wrapper to extract client IP from the request (for hashing only, never stored)
pub struct ClientIp(String);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for ClientIp {
    type Error = ();

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let ip = request
            .client_ip()
            .map(|ip| ip.to_string())
            .unwrap_or_else(|| "unknown".to_string());
        Outcome::Success(ClientIp(ip))
    }
}

/// Wrapper to extract User-Agent header (for hashing only, never stored)
pub struct UserAgent(String);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for UserAgent {
    type Error = ();

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let ua = request
            .headers()
            .get_one("User-Agent")
            .unwrap_or("unknown")
            .to_string();
        Outcome::Success(UserAgent(ua))
    }
}

/// Check that analytics is enabled for this site, return Forbidden if not.
async fn require_analytics_enabled(pool: &sqlx::PgPool, site_id: Uuid) -> Result<(), ApiError> {
    let value = SiteSetting::get_value(pool, site_id, KEY_ANALYTICS_ENABLED).await?;
    if !value.as_bool().unwrap_or(false) {
        return Err(ApiError::Forbidden(
            "Analytics is not enabled for this site".to_string(),
        ));
    }
    Ok(())
}

/// Record a pageview event.
///
/// This endpoint is called by the tracking snippet on public websites.
/// It requires a Read-level API key. No cookies are set, no IP is stored.
#[utoipa::path(
    post,
    path = "/sites/{site_id}/analytics/pageview",
    tag = "Analytics",
    operation_id = "track_pageview",
    params(
        ("site_id" = Uuid, Path, description = "Site ID"),
    ),
    request_body = TrackPageviewRequest,
    responses(
        (status = 201, description = "Pageview recorded", body = TrackPageviewResponse),
        (status = 400, description = "Invalid request"),
        (status = 403, description = "Analytics not enabled or insufficient permissions"),
    ),
    security(("api_key" = []))
)]
#[post("/sites/<site_id>/analytics/pageview", data = "<body>")]
pub async fn track_pageview(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<TrackPageviewRequest>,
    auth: ReadKey,
    client_ip: ClientIp,
    user_agent: UserAgent,
) -> Result<(Status, Json<TrackPageviewResponse>), ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;

    require_analytics_enabled(&state.db, site_id).await?;

    body.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let today = Utc::now().date_naive();
    let visitor_hash = compute_visitor_hash(site_id, &today, &client_ip.0, &user_agent.0);
    let referrer_domain = extract_referrer_domain(body.referrer.as_deref());

    AnalyticsPageview::create(
        &state.db,
        site_id,
        &body.path,
        referrer_domain.as_deref(),
        &visitor_hash,
    )
    .await?;

    Ok((Status::Created, Json(TrackPageviewResponse { ok: true })))
}

/// Get analytics report for a site.
///
/// Returns top content, view trends, and summary stats for the given period.
#[utoipa::path(
    get,
    path = "/sites/{site_id}/analytics/report",
    tag = "Analytics",
    operation_id = "get_analytics_report",
    params(
        ("site_id" = Uuid, Path, description = "Site ID"),
        ("days" = Option<i64>, Query, description = "Number of days to look back (default: 30)"),
        ("top_n" = Option<i64>, Query, description = "Number of top content items (default: 10)"),
    ),
    responses(
        (status = 200, description = "Analytics report", body = AnalyticsReportResponse),
        (status = 403, description = "Analytics not enabled or insufficient permissions"),
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
#[get("/sites/<site_id>/analytics/report?<days>&<top_n>")]
pub async fn get_analytics_report(
    state: &State<AppState>,
    site_id: Uuid,
    days: Option<i64>,
    top_n: Option<i64>,
    auth: ReadKey,
) -> Result<Json<AnalyticsReportResponse>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;

    require_analytics_enabled(&state.db, site_id).await?;

    let days = days.unwrap_or(30).clamp(1, 365);
    let top_n = top_n.unwrap_or(10).clamp(1, 50);
    let since = Utc::now() - Duration::days(days);

    let top_content = AnalyticsPageview::top_content(&state.db, site_id, since, top_n)
        .await?
        .into_iter()
        .map(TopContentItem::from)
        .collect();

    let trend = AnalyticsPageview::daily_trend(&state.db, site_id, since)
        .await?
        .into_iter()
        .map(TrendDataPoint::from)
        .collect();

    let (total_views, total_unique_visitors) =
        AnalyticsPageview::summary(&state.db, site_id, since).await?;

    Ok(Json(AnalyticsReportResponse {
        total_views,
        total_unique_visitors,
        top_content,
        trend,
    }))
}

/// Aggregate raw pageview events into daily stats and optionally prune old events.
///
/// Admin-only maintenance endpoint. Aggregates raw events older than 1 day
/// into the daily_stats table, then prunes events older than the retention period.
#[utoipa::path(
    post,
    path = "/sites/{site_id}/analytics/aggregate",
    tag = "Analytics",
    operation_id = "aggregate_analytics",
    params(
        ("site_id" = Uuid, Path, description = "Site ID"),
        ("retention_days" = Option<i64>, Query, description = "Prune events older than N days (default: 90)"),
    ),
    responses(
        (status = 200, description = "Aggregation complete", body = AnalyticsMaintenanceResponse),
        (status = 403, description = "Insufficient permissions"),
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
#[post("/sites/<site_id>/analytics/aggregate?<retention_days>")]
pub async fn aggregate_analytics(
    state: &State<AppState>,
    site_id: Uuid,
    retention_days: Option<i64>,
    auth: ReadKey,
) -> Result<Json<AnalyticsMaintenanceResponse>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Admin)
        .await?;

    let today = Utc::now().date_naive();
    let rows = AnalyticsPageview::aggregate_daily(&state.db, site_id, today).await?;

    // Prune old raw events
    let retention = retention_days.unwrap_or(90).max(1);
    let cutoff = Utc::now() - Duration::days(retention);
    let pruned = AnalyticsPageview::prune(&state.db, site_id, cutoff).await?;

    Ok(Json(AnalyticsMaintenanceResponse {
        rows_affected: rows + pruned,
        action: format!(
            "Aggregated {} rows, pruned {} raw events older than {} days",
            rows, pruned, retention
        ),
    }))
}

pub fn routes() -> Vec<Route> {
    routes![track_pageview, get_analytics_report, aggregate_analytics]
}
