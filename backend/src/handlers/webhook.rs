//! Webhook handlers

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::webhook::{
    CreateWebhookRequest, PaginatedWebhookDeliveries, PaginatedWebhooks, UpdateWebhookRequest,
    WebhookDeliveryResponse, WebhookResponse,
};
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::AdminKey;
use crate::models::audit::AuditAction;
use crate::models::site_membership::SiteRole;
use crate::models::webhook::{Webhook, WebhookDelivery};
use crate::services::audit_service;
use crate::utils::pagination::PaginationParams;
use crate::AppState;

/// List webhooks for a site (paginated)
#[utoipa::path(
    tag = "Webhooks",
    operation_id = "list_webhooks",
    description = "List all webhooks for a site (paginated, admin only)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("per_page" = Option<i64>, Query, description = "Items per page (default 10, max 100)")
    ),
    responses(
        (status = 200, description = "Paginated webhook list", body = PaginatedWebhooks),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/webhooks?<page>&<per_page>")]
pub async fn list_webhooks(
    state: &State<AppState>,
    site_id: Uuid,
    page: Option<i64>,
    per_page: Option<i64>,
    auth: AdminKey,
) -> Result<Json<PaginatedWebhooks>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Admin)
        .await?;
    let params = PaginationParams::new(page, per_page);
    let (limit, offset) = params.limit_offset();

    let webhooks = Webhook::find_all_for_site(&state.db, site_id, limit, offset).await?;
    let total = Webhook::count_for_site(&state.db, site_id).await?;

    let items: Vec<WebhookResponse> = webhooks.into_iter().map(WebhookResponse::from).collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

/// Get a webhook by ID
#[utoipa::path(
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
#[get("/webhooks/<id>")]
pub async fn get_webhook(
    state: &State<AppState>,
    id: Uuid,
    auth: AdminKey,
) -> Result<Json<WebhookResponse>, ApiError> {
    let webhook = Webhook::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, webhook.site_id, &SiteRole::Admin)
        .await?;
    Ok(Json(WebhookResponse::from(webhook)))
}

/// Create a webhook
#[utoipa::path(
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
#[post("/sites/<site_id>/webhooks", data = "<body>")]
pub async fn create_webhook(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<CreateWebhookRequest>,
    auth: AdminKey,
) -> Result<(Status, Json<WebhookResponse>), ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Admin)
        .await?;
    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let secret = Uuid::new_v4().to_string();
    let events = req.events.unwrap_or_default();

    let webhook = Webhook::create(
        &state.db,
        site_id,
        &req.url,
        &secret,
        req.description.as_deref(),
        &events,
    )
    .await?;

    audit_service::log_action(
        &state.db,
        Some(site_id),
        Some(auth.0.id),
        AuditAction::Create,
        "webhook",
        webhook.id,
        None,
    )
    .await;

    Ok((Status::Created, Json(WebhookResponse::from(webhook))))
}

/// Update a webhook
#[utoipa::path(
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
#[put("/webhooks/<id>", data = "<body>")]
pub async fn update_webhook(
    state: &State<AppState>,
    id: Uuid,
    body: Json<UpdateWebhookRequest>,
    auth: AdminKey,
) -> Result<Json<WebhookResponse>, ApiError> {
    let existing = Webhook::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, existing.site_id, &SiteRole::Admin)
        .await?;

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::BadRequest(format!("Validation error: {}", e)))?;

    let webhook = Webhook::update(
        &state.db,
        id,
        req.url.as_deref(),
        req.description.as_deref(),
        req.events.as_deref(),
        req.is_active,
    )
    .await?;

    audit_service::log_action(
        &state.db,
        Some(existing.site_id),
        Some(auth.0.id),
        AuditAction::Update,
        "webhook",
        id,
        None,
    )
    .await;

    Ok(Json(WebhookResponse::from(webhook)))
}

/// Delete a webhook
#[utoipa::path(
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
#[delete("/webhooks/<id>")]
pub async fn delete_webhook(
    state: &State<AppState>,
    id: Uuid,
    auth: AdminKey,
) -> Result<Status, ApiError> {
    let existing = Webhook::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, existing.site_id, &SiteRole::Admin)
        .await?;

    Webhook::delete(&state.db, id).await?;

    audit_service::log_action(
        &state.db,
        Some(existing.site_id),
        Some(auth.0.id),
        AuditAction::Delete,
        "webhook",
        id,
        None,
    )
    .await;

    Ok(Status::NoContent)
}

/// Send a test delivery to a webhook
#[utoipa::path(
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
#[post("/webhooks/<id>/test")]
pub async fn test_webhook(
    state: &State<AppState>,
    id: Uuid,
    auth: AdminKey,
) -> Result<Json<WebhookDeliveryResponse>, ApiError> {
    let webhook = Webhook::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, webhook.site_id, &SiteRole::Admin)
        .await?;

    let delivery = crate::services::webhook_service::deliver_test(&state.db, &webhook)
        .await
        .map_err(|e| ApiError::Internal(format!("Test delivery failed: {e}")))?;

    Ok(Json(WebhookDeliveryResponse::from(delivery)))
}

/// List deliveries for a webhook (paginated)
#[utoipa::path(
    tag = "Webhooks",
    operation_id = "list_webhook_deliveries",
    description = "List delivery log for a webhook (admin only)",
    params(
        ("id" = Uuid, Path, description = "Webhook UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default 1)"),
        ("per_page" = Option<i64>, Query, description = "Items per page (default 10, max 100)")
    ),
    responses(
        (status = 200, description = "Paginated delivery log", body = PaginatedWebhookDeliveries),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Webhook not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/webhooks/<id>/deliveries?<page>&<per_page>")]
pub async fn list_webhook_deliveries(
    state: &State<AppState>,
    id: Uuid,
    page: Option<i64>,
    per_page: Option<i64>,
    auth: AdminKey,
) -> Result<Json<PaginatedWebhookDeliveries>, ApiError> {
    let webhook = Webhook::find_by_id(&state.db, id).await?;
    auth.0
        .authorize_site_action(&state.db, webhook.site_id, &SiteRole::Admin)
        .await?;

    let params = PaginationParams::new(page, per_page);
    let (limit, offset) = params.limit_offset();

    let deliveries = WebhookDelivery::find_for_webhook(&state.db, id, limit, offset).await?;
    let total = WebhookDelivery::count_for_webhook(&state.db, id).await?;

    let items: Vec<WebhookDeliveryResponse> = deliveries
        .into_iter()
        .map(WebhookDeliveryResponse::from)
        .collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

/// Collect webhook routes
pub fn routes() -> Vec<Route> {
    routes![
        list_webhooks,
        get_webhook,
        create_webhook,
        update_webhook,
        delete_webhook,
        test_webhook,
        list_webhook_deliveries
    ]
}
