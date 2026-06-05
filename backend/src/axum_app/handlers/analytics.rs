//! Axum port of `crate::handlers::analytics`. Four endpoints for
//! privacy-first pageview tracking and reporting. Mounted under `/api/v1`.
//!
//! Reuses the already-ported `ClientIp` and `UserAgent` extractors from
//! `axum_app::extractors` — no Rocket-specific FromRequest trampolines.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::Json;
use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::axum_app::extractors::{ClientIp, UserAgent};
use crate::dto::analytics::{
    AnalyticsMaintenanceResponse, AnalyticsPageDetailResponse, AnalyticsReportResponse,
    ReferrerItem, TopContentItem, TrackPageviewRequest, TrackPageviewResponse, TrendDataPoint,
};
use crate::dto::validated::ValidatedJson;
use crate::errors::{codes, ApiError};
use crate::guards::auth_guard::{AdminKey, ReadKey, WriteKey};
use crate::models::analytics::{
    compute_visitor_hash, extract_referrer_domain, AnalyticsPageview, ReferrerRow,
};
use crate::models::audit::AuditAction;
use crate::models::site_settings::{
    SiteSetting, KEY_ANALYTICS_ENABLED, KEY_ANALYTICS_RETENTION_DAYS,
};
use crate::services::audited_mutation::AuditedEntity;
use crate::services::permission_service::{Permission, PermissionService};
use crate::AppState;

async fn require_analytics_enabled(pool: &sqlx::PgPool, site_id: Uuid) -> Result<(), ApiError> {
    let value = SiteSetting::get_value(pool, site_id, KEY_ANALYTICS_ENABLED).await?;
    if !value.as_bool().unwrap_or(false) {
        return Err(
            ApiError::forbidden("Analytics is not enabled for this site")
                .with_code(codes::ANALYTICS_NOT_ENABLED),
        );
    }
    Ok(())
}

fn resolve_date_range(
    start_date: Option<NaiveDate>,
    end_date: Option<NaiveDate>,
    days: Option<i64>,
) -> (DateTime<Utc>, DateTime<Utc>) {
    let now = Utc::now();
    let until = match end_date {
        Some(d) => d.and_hms_opt(23, 59, 59).expect("valid time").and_utc(),
        None => now,
    };
    let since = match start_date {
        Some(d) => d.and_hms_opt(0, 0, 0).expect("valid time").and_utc(),
        None => {
            let d = days.unwrap_or(30).clamp(1, 365);
            until - Duration::days(d)
        }
    };
    (since, until)
}

fn parse_date(s: &str) -> Result<NaiveDate, ApiError> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").map_err(|_| {
        ApiError::bad_request("Invalid date format (expected YYYY-MM-DD)".to_string())
            .with_code(codes::BAD_REQUEST)
    })
}

#[derive(Debug, Deserialize)]
struct ReportQuery {
    days: Option<i64>,
    top_n: Option<i64>,
    start_date: Option<String>,
    end_date: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AggregateQuery {
    retention_days: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct PageReportQuery {
    path: String,
    days: Option<i64>,
    start_date: Option<String>,
    end_date: Option<String>,
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/analytics/pageview",
    tag = "Analytics",
    operation_id = "track_pageview",
    params(("site_id" = Uuid, Path, description = "The UUID of the site")),
    request_body = TrackPageviewRequest,
    responses(
        (status = 201, description = "Pageview recorded", body = TrackPageviewResponse),
        (status = 400, description = "Invalid request"),
        (status = 401, description = "Missing or invalid API key"),
        (status = 403, description = "Analytics not enabled or insufficient permissions")
    ),
    security(("api_key" = []))
)]
async fn track_pageview(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    client_ip: ClientIp,
    user_agent: UserAgent,
    ValidatedJson(body): ValidatedJson<TrackPageviewRequest>,
) -> Result<(StatusCode, Json<TrackPageviewResponse>), ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("analytics", "read"),
    )
    .await?;

    require_analytics_enabled(&state.db, site_id).await?;

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

    Ok((
        StatusCode::CREATED,
        Json(TrackPageviewResponse { ok: true }),
    ))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/analytics/report",
    tag = "Analytics",
    operation_id = "get_analytics_report",
    params(
        ("site_id" = Uuid, Path, description = "Site ID"),
        ("days" = Option<i64>, Query, description = "Number of days to look back (default: 30, ignored when start_date is set)"),
        ("top_n" = Option<i64>, Query, description = "Number of top content items (default: 10)"),
        ("start_date" = Option<String>, Query, description = "Start date (YYYY-MM-DD)"),
        ("end_date" = Option<String>, Query, description = "End date (YYYY-MM-DD, default: today)")
    ),
    responses(
        (status = 200, description = "Analytics report", body = AnalyticsReportResponse),
        (status = 400, description = "Invalid date format"),
        (status = 403, description = "Analytics not enabled or insufficient permissions")
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn get_analytics_report(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<ReportQuery>,
    auth: ReadKey,
) -> Result<Json<AnalyticsReportResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("analytics", "read"),
    )
    .await?;

    require_analytics_enabled(&state.db, site_id).await?;

    let parsed_start = q.start_date.as_deref().map(parse_date).transpose()?;
    let parsed_end = q.end_date.as_deref().map(parse_date).transpose()?;

    let top_n = q.top_n.unwrap_or(10).clamp(1, 50);
    let (since, until) = resolve_date_range(parsed_start, parsed_end, q.days);

    let top_content = AnalyticsPageview::top_content_range(&state.db, site_id, since, until, top_n)
        .await?
        .into_iter()
        .map(TopContentItem::from)
        .collect();

    let trend = AnalyticsPageview::daily_trend_range(&state.db, site_id, since, until)
        .await?
        .into_iter()
        .map(TrendDataPoint::from)
        .collect();

    let (total_views, total_unique_visitors) =
        AnalyticsPageview::summary_range(&state.db, site_id, since, until).await?;

    Ok(Json(AnalyticsReportResponse {
        total_views,
        total_unique_visitors,
        top_content,
        trend,
    }))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/analytics/aggregate",
    tag = "Analytics",
    operation_id = "aggregate_analytics",
    params(
        ("site_id" = Uuid, Path, description = "Site ID"),
        ("retention_days" = Option<i64>, Query, description = "Prune events older than N days (default: 90)")
    ),
    responses(
        (status = 200, description = "Aggregation complete", body = AnalyticsMaintenanceResponse),
        (status = 403, description = "Insufficient permissions")
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn aggregate_analytics(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<AggregateQuery>,
    auth: AdminKey,
) -> Result<Json<AnalyticsMaintenanceResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("analytics", "manage"),
    )
    .await?;

    require_analytics_enabled(&state.db, site_id).await?;

    let today = Utc::now().date_naive();
    let rows = AnalyticsPageview::aggregate_daily(&state.db, site_id, today).await?;

    let retention = match q.retention_days {
        Some(days) => days.max(1),
        None => {
            let val =
                SiteSetting::get_value(&state.db, site_id, KEY_ANALYTICS_RETENTION_DAYS).await?;
            val.as_i64().unwrap_or(90).max(1)
        }
    };
    let cutoff = Utc::now() - Duration::days(retention);
    let pruned = AnalyticsPageview::prune(&state.db, site_id, cutoff).await?;

    let action = format!(
        "Aggregated {} rows, pruned {} raw events older than {} days",
        rows, pruned, retention
    );

    AuditedEntity::audit_only("analytics")
        .mutate(AuditAction::Update, site_id)
        .site(site_id)
        .actor(auth.0.id)
        .metadata(serde_json::json!({ "action": &action }))
        .execute(&state.db)
        .await;

    Ok(Json(AnalyticsMaintenanceResponse {
        rows_affected: rows + pruned,
        action,
    }))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/analytics/report/page",
    tag = "Analytics",
    operation_id = "get_page_analytics",
    params(
        ("site_id" = Uuid, Path, description = "Site ID"),
        ("path" = String, Query, description = "Page path to analyze (e.g., /blog/my-post)"),
        ("days" = Option<i64>, Query, description = "Number of days to look back (default: 30, ignored when start_date is set)"),
        ("start_date" = Option<String>, Query, description = "Start date (YYYY-MM-DD)"),
        ("end_date" = Option<String>, Query, description = "End date (YYYY-MM-DD, default: today)")
    ),
    responses(
        (status = 200, description = "Page analytics detail", body = AnalyticsPageDetailResponse),
        (status = 400, description = "Missing or invalid parameters"),
        (status = 403, description = "Analytics not enabled or insufficient permissions")
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn get_page_analytics(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<PageReportQuery>,
    auth: ReadKey,
) -> Result<Json<AnalyticsPageDetailResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("analytics", "read"),
    )
    .await?;

    require_analytics_enabled(&state.db, site_id).await?;

    if q.path.is_empty() {
        return Err(
            ApiError::bad_request("path query parameter is required".to_string())
                .with_code(codes::BAD_REQUEST),
        );
    }

    let parsed_start = q.start_date.as_deref().map(parse_date).transpose()?;
    let parsed_end = q.end_date.as_deref().map(parse_date).transpose()?;

    let (since, until) = resolve_date_range(parsed_start, parsed_end, q.days);

    let trend: Vec<TrendDataPoint> =
        AnalyticsPageview::page_trend(&state.db, site_id, &q.path, since, until)
            .await?
            .into_iter()
            .map(TrendDataPoint::from)
            .collect();

    let (total_views, total_unique_visitors) =
        AnalyticsPageview::page_summary(&state.db, site_id, &q.path, since, until).await?;

    let referrers: Vec<ReferrerItem> =
        AnalyticsPageview::page_referrers(&state.db, site_id, &q.path, since, until, 20)
            .await?
            .into_iter()
            .map(|r: ReferrerRow| ReferrerItem {
                domain: r.domain,
                views: r.views,
            })
            .collect();

    Ok(Json(AnalyticsPageDetailResponse {
        path: q.path,
        total_views,
        total_unique_visitors,
        trend,
        referrers,
    }))
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(track_pageview))
        .routes(routes!(get_analytics_report))
        .routes(routes!(aggregate_analytics))
        .routes(routes!(get_page_analytics))
}
