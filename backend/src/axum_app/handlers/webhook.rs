//! Axum port of `crate::handlers::webhook`. Nine admin-gated endpoints
//! for webhook config + delivery log + manual retry + per-window stats.
//! Mounted under `/api/v1`.
//!
//! Reuses `services::url_validation::validate_target_url` for SSRF
//! defence on create/update — pure framework-agnostic helper, no port
//! needed.

use crate::AppState;
use crate::dto::validated::ValidatedJson;
use crate::dto::webhook::{
    CreateWebhookRequest, PaginatedWebhookDeliveries, PaginatedWebhooks, UpdateWebhookRequest,
    WebhookDeliveryResponse, WebhookEventStats, WebhookResponse, WebhookStatsResponse,
};
use crate::errors::{ApiError, ProblemDetails, codes};
use crate::guards::auth_guard::AdminKey;
use crate::models::audit::AuditAction;
use crate::models::webhook::{Webhook, WebhookDelivery, WebhookRetryJob};
use crate::services::audited_mutation::AuditedEntity;
use crate::services::encryption;
use crate::services::permission_service::{Permission, PermissionService};
use crate::services::url_validation;
use crate::utils::list_params::ListParams;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::Json;
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
struct ListWebhooksQuery {
    page: Option<i64>,
    page_size: Option<i64>,
    search: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ListDeliveriesQuery {
    page: Option<i64>,
    page_size: Option<i64>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
}

#[derive(Debug, Deserialize)]
struct StatsQuery {
    window: Option<String>,
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/webhooks",
    tag = "Webhooks",
    operation_id = "list_webhooks",
    description = "List all webhooks for a site (paginated, admin only)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page (default 10, max 100)"),
        ("search" = Option<String>, Query, description = "Search in url and description"),
        ("sort_by" = Option<String>, Query, description = "Sort field: created_at (default), url"),
        ("sort_dir" = Option<String>, Query, description = "Sort direction: asc or desc (default)")
    ),
    responses(
        (status = 200, description = "Paginated webhook list", body = PaginatedWebhooks),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_webhooks(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<ListWebhooksQuery>,
    auth: AdminKey,
) -> Result<Json<PaginatedWebhooks>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("webhook", "read"),
    )
    .await?;
    let params = ListParams::new(q.page, q.page_size, q.search, q.sort_by, q.sort_dir);

    let webhooks = Webhook::find_all_for_site_filtered(&state.db, site_id, &params).await?;
    let total = Webhook::count_for_site_filtered(&state.db, site_id, params.search_ref()).await?;

    let items: Vec<WebhookResponse> = webhooks.into_iter().map(WebhookResponse::from).collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

#[utoipa::path(
    get,
    path = "/webhooks/{id}",
    tag = "Webhooks",
    operation_id = "get_webhook",
    description = "Get a webhook by ID (admin only)",
    params(("id" = Uuid, Path, description = "Webhook UUID")),
    responses(
        (status = 200, description = "Webhook details", body = WebhookResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_webhook(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AdminKey,
) -> Result<Json<WebhookResponse>, ApiError> {
    let webhook = Webhook::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        webhook.site_id,
        &Permission::new("webhook", "read"),
    )
    .await?;
    Ok(Json(WebhookResponse::from(webhook)))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/webhooks",
    tag = "Webhooks",
    operation_id = "create_webhook",
    description = "Create a webhook for a site (admin only, secret is auto-generated)",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = CreateWebhookRequest, description = "Webhook creation data"),
    responses(
        (status = 201, description = "Webhook created", body = WebhookResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn create_webhook(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: AdminKey,
    ValidatedJson(body): ValidatedJson<CreateWebhookRequest>,
) -> Result<(StatusCode, Json<WebhookResponse>), ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("webhook", "create"),
    )
    .await?;
    let body = body.into_inner();

    url_validation::validate_target_url(&body.url)
        .await
        .map_err(|e| e.with_code(codes::WEBHOOK_URL_SSRF))?;

    let secret = Uuid::new_v4().to_string();
    let events = body.events.unwrap_or_default();
    let debounce_seconds = body.debounce_seconds.unwrap_or(0);

    let encryption_key =
        match encryption::resolve_key(&state.settings.security.document_encryption_key) {
            Ok(k) => Some(k),
            Err(e) => {
                tracing::warn!(
                    "Webhook secret will be stored in plaintext — encryption key unavailable: {e}"
                );
                None
            }
        };

    let webhook = Webhook::create(
        &state.db,
        site_id,
        &body.url,
        &secret,
        body.description.as_deref(),
        &events,
        debounce_seconds,
        encryption_key.as_ref(),
    )
    .await?;

    AuditedEntity::audit_only("webhook")
        .mutate(AuditAction::Create, webhook.id)
        .site(site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;

    Ok((StatusCode::CREATED, Json(WebhookResponse::from(webhook))))
}

#[utoipa::path(
    put,
    path = "/webhooks/{id}",
    tag = "Webhooks",
    operation_id = "update_webhook",
    description = "Update a webhook (admin only)",
    params(("id" = Uuid, Path, description = "Webhook UUID")),
    request_body(content = UpdateWebhookRequest, description = "Webhook update data"),
    responses(
        (status = 200, description = "Webhook updated", body = WebhookResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn update_webhook(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AdminKey,
    ValidatedJson(body): ValidatedJson<UpdateWebhookRequest>,
) -> Result<Json<WebhookResponse>, ApiError> {
    let existing = Webhook::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        existing.site_id,
        &Permission::new("webhook", "update"),
    )
    .await?;
    let body = body.into_inner();

    if let Some(ref url) = body.url {
        url_validation::validate_target_url(url)
            .await
            .map_err(|e| e.with_code(codes::WEBHOOK_URL_SSRF))?;
    }

    let webhook = Webhook::update(
        &state.db,
        id,
        body.url.as_deref(),
        body.description.as_deref(),
        body.events.as_deref(),
        body.is_active,
        body.debounce_seconds,
    )
    .await?;

    AuditedEntity::audit_only("webhook")
        .mutate(AuditAction::Update, id)
        .site(existing.site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;

    Ok(Json(WebhookResponse::from(webhook)))
}

#[utoipa::path(
    delete,
    path = "/webhooks/{id}",
    tag = "Webhooks",
    operation_id = "delete_webhook",
    description = "Delete a webhook (admin only)",
    params(("id" = Uuid, Path, description = "Webhook UUID")),
    responses(
        (status = 204, description = "Webhook deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn delete_webhook(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AdminKey,
) -> Result<StatusCode, ApiError> {
    let existing = Webhook::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        existing.site_id,
        &Permission::new("webhook", "delete"),
    )
    .await?;

    Webhook::delete(&state.db, id).await?;

    AuditedEntity::audit_only("webhook")
        .mutate(AuditAction::Delete, id)
        .site(existing.site_id)
        .actor(auth.0.id)
        .execute(&state.db)
        .await;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/webhooks/{id}/test",
    tag = "Webhooks",
    operation_id = "test_webhook",
    description = "Send a test delivery to a webhook (admin only)",
    params(("id" = Uuid, Path, description = "Webhook UUID")),
    responses(
        (status = 200, description = "Test delivery result", body = WebhookDeliveryResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Not found", body = ProblemDetails),
        (status = 500, description = "Delivery failed", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn test_webhook(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AdminKey,
) -> Result<Json<WebhookDeliveryResponse>, ApiError> {
    let webhook = Webhook::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        webhook.site_id,
        &Permission::new("webhook", "update"),
    )
    .await?;

    let encryption_key =
        match encryption::resolve_key(&state.settings.security.document_encryption_key) {
            Ok(k) => k,
            Err(e) => {
                return Err(ApiError::internal(format!(
                    "Webhook delivery unavailable — encryption key misconfigured: {e}"
                ))
                .with_code(codes::INTERNAL_ERROR));
            }
        };

    let delivery =
        crate::services::webhook_service::deliver_test(&state.db, &webhook, &encryption_key)
            .await
            .map_err(|e| {
                ApiError::internal(format!("Test delivery failed: {e}"))
                    .with_code(codes::WEBHOOK_TEST_FAILED)
            })?;

    Ok(Json(WebhookDeliveryResponse::from(delivery)))
}

#[utoipa::path(
    get,
    path = "/webhooks/{id}/deliveries",
    tag = "Webhooks",
    operation_id = "list_webhook_deliveries",
    description = "List delivery log for a webhook (admin only)",
    params(
        ("id" = Uuid, Path, description = "Webhook UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page (default 10, max 100)"),
        ("sort_by" = Option<String>, Query, description = "Sort field: created_at (default)"),
        ("sort_dir" = Option<String>, Query, description = "Sort direction: asc or desc (default)")
    ),
    responses(
        (status = 200, description = "Paginated delivery log", body = PaginatedWebhookDeliveries),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Webhook not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_webhook_deliveries(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(q): Query<ListDeliveriesQuery>,
    auth: AdminKey,
) -> Result<Json<PaginatedWebhookDeliveries>, ApiError> {
    let webhook = Webhook::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        webhook.site_id,
        &Permission::new("webhook", "read"),
    )
    .await?;

    let params = ListParams::new(q.page, q.page_size, None, q.sort_by, q.sort_dir);

    let deliveries = WebhookDelivery::find_for_webhook_filtered(&state.db, id, &params).await?;
    let total = WebhookDelivery::count_for_webhook_filtered(&state.db, id).await?;

    let items: Vec<WebhookDeliveryResponse> = deliveries
        .into_iter()
        .map(WebhookDeliveryResponse::from)
        .collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

#[utoipa::path(
    post,
    path = "/webhooks/deliveries/{id}/retry",
    tag = "Webhooks",
    operation_id = "retry_webhook_delivery",
    description = "Re-enqueue a dead webhook delivery for retry.",
    params(("id" = Uuid, Path, description = "Retry job UUID")),
    responses(
        (status = 200, description = "Delivery re-enqueued for retry"),
        (status = 404, description = "Retry job not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn retry_webhook_delivery(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    _auth: AdminKey,
) -> Result<StatusCode, ApiError> {
    WebhookRetryJob::manual_retry(&state.db, id).await?;
    Ok(StatusCode::OK)
}

#[utoipa::path(
    get,
    path = "/webhooks/{id}/stats",
    tag = "Webhooks",
    operation_id = "get_webhook_stats",
    description = "Get aggregated delivery statistics for a webhook (admin only)",
    params(
        ("id" = Uuid, Path, description = "Webhook UUID"),
        ("window" = Option<String>, Query, description = "Time window: 1h, 24h (default), 7d, 30d")
    ),
    responses(
        (status = 200, description = "Delivery statistics", body = WebhookStatsResponse),
        (status = 400, description = "Invalid window", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Webhook not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_webhook_stats(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(q): Query<StatsQuery>,
    auth: AdminKey,
) -> Result<Json<WebhookStatsResponse>, ApiError> {
    let webhook = Webhook::find_by_id(&state.db, id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        webhook.site_id,
        &Permission::new("webhook", "read"),
    )
    .await?;

    let window_str = q.window.as_deref().unwrap_or("24h");
    let window_hours = crate::dto::webhook::parse_stats_window(window_str).ok_or_else(|| {
        ApiError::bad_request("Window must be one of: 1h, 24h, 7d, 30d")
            .with_code(codes::WEBHOOK_INVALID_STATS_WINDOW)
    })?;

    let (total, successful, failed, last_delivery_at) =
        WebhookDelivery::stats(&state.db, id, window_hours).await?;

    let by_event_rows = WebhookDelivery::stats_by_event(&state.db, id, window_hours).await?;
    let by_event: Vec<WebhookEventStats> = by_event_rows
        .into_iter()
        .map(
            |(event_type, total, successful, failed)| WebhookEventStats {
                event_type,
                total,
                successful,
                failed,
            },
        )
        .collect();

    let pending_retry = WebhookDelivery::pending_retry_count(&state.db, id)
        .await
        .unwrap_or(0);

    let success_rate = if total > 0 {
        (successful as f64 / total as f64) * 100.0
    } else {
        0.0
    };

    Ok(Json(WebhookStatsResponse {
        webhook_id: id,
        window: window_str.to_string(),
        total_deliveries: total,
        successful,
        failed,
        pending_retry,
        success_rate,
        last_delivery_at,
        by_event,
    }))
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_webhooks, create_webhook))
        .routes(routes!(test_webhook))
        .routes(routes!(list_webhook_deliveries))
        .routes(routes!(retry_webhook_delivery))
        .routes(routes!(get_webhook_stats))
        .routes(routes!(get_webhook, update_webhook, delete_webhook))
}
