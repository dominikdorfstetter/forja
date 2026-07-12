//! Axum port of `crate::handlers::legal`. 22 endpoints covering legal
//! document CRUD, consent groups + items, slug lookup, clone,
//! versioning, and content localizations.

use crate::AppState;
use crate::axum_app::authorized_content::{
    AuthorizedContent, AuthorizedSite, Create, Delete, Read, Update,
};
use crate::axum_app::extractors::ResolveLocale;
use crate::dto::content::{
    CreateLocalizationRequest, LocalizationResponse, UpdateLocalizationRequest,
};
use crate::dto::legal::{
    CreateLegalDocumentRequest, CreateLegalGroupRequest, CreateLegalItemRequest,
    LegalDocLocalizationResponse, LegalDocumentDetailResponse, LegalDocumentFullDetailResponse,
    LegalDocumentResponse, LegalDocumentWithGroups, LegalGroupResponse, LegalGroupWithItems,
    LegalItemResponse, LegalVersionResponse, PaginatedLegalDocuments, UpdateLegalDocumentRequest,
    UpdateLegalGroupRequest, UpdateLegalItemRequest,
};
use crate::dto::validated::ValidatedJson;
use crate::errors::codes;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::actor::Actor;
use crate::guards::auth_guard::{ReadKey, WriteKey};
use crate::guards::module_guard::{LegalModule, ModuleGuard};
use crate::models::audit::AuditAction;
use crate::models::content::{Content, ContentLocalization, ContentStatus};
use crate::models::legal::{LegalDocType, LegalDocument};
use crate::repos::legal_repo::{
    LegalDocumentLocalizationRepo, LegalDocumentRepo, LegalGroupRepo, LegalItemRepo,
    LegalListFilters,
};
use crate::services::audited_mutation::AuditedEntity;
use crate::services::content_lifecycle;
use crate::services::localization_lifecycle::{self, legal::LegalLocalization};
use crate::services::permission_service::{Permission, PermissionService};
use crate::utils::list_params::ListParams;
use crate::utils::locale_resolver::{collapse_localizations, pick_one, resolve_ids_for_site};
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::Json;
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

/// Audit + webhook descriptors for the legal entities. Groups and items share
/// the `legal` webhook namespace; document versioning audits without a webhook.
const LEGAL_GROUP: AuditedEntity = AuditedEntity::with_webhooks("legal_group", "legal");
const LEGAL_ITEM: AuditedEntity = AuditedEntity::with_webhooks("legal_item", "legal");
const LEGAL_DOCUMENT: AuditedEntity = AuditedEntity::audit_only("legal_document");

/// A published legal document is an immutable record; its text must not be
/// edited in place. Clients fork a new draft version instead (#140).
fn published_immutable_error() -> ApiError {
    ApiError::conflict(
        "This legal document is published and cannot be edited in place. Create a new version to make changes.",
    )
    .with_code(codes::LEGAL_PUBLISHED_IMMUTABLE)
    .with_entity_type("legal_doc")
}

#[derive(Debug, Deserialize)]
struct ListLegalQuery {
    page: Option<i64>,
    page_size: Option<i64>,
    search: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
    status: Option<String>,
    exclude_status: Option<String>,
    exclude_document_type: Option<String>,
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/legal",
    tag = "Legal",
    operation_id = "list_legal_documents",
    description = "List all legal documents for a site",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site"),
        ("page" = Option<i64>, Query, description = "Page number, 1-indexed (default: 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page, 1–100 (default: 10)"),
        ("search" = Option<String>, Query, description = "Search by cookie name (case-insensitive partial match)"),
        ("sort_by" = Option<String>, Query, description = "Sort field: created_at, updated_at, document_type (default: created_at)"),
        ("sort_dir" = Option<String>, Query, description = "Sort direction: asc or desc (default: asc)"),
        ("status" = Option<String>, Query, description = "Filter by content status: Draft, InReview, Scheduled, Published, Archived"),
        ("exclude_status" = Option<String>, Query, description = "Exclude items with this status: Draft, InReview, Scheduled, Published, Archived (e.g. Archived)"),
        ("exclude_document_type" = Option<String>, Query, description = "Exclude documents of this type: CookieConsent, PrivacyPolicy, TermsOfService, Imprint, Disclaimer (e.g. CookieConsent, which has its own UI)")
    ),
    responses(
        (status = 200, description = "List of legal documents", body = PaginatedLegalDocuments),
        (status = 400, description = "Invalid filter value", body = ProblemDetails),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn list_legal_documents(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<ListLegalQuery>,
    _access: AuthorizedSite<LegalDocument, Read>,
) -> Result<Json<PaginatedLegalDocuments>, ApiError> {
    let params = ListParams::new(q.page, q.page_size, q.search, q.sort_by, q.sort_dir);
    let filters = LegalListFilters {
        search: params.search_ref(),
        status: q.status.as_deref(),
        exclude_status: q.exclude_status.as_deref(),
        exclude_document_type: q.exclude_document_type.as_deref(),
    };
    let documents =
        LegalDocumentRepo::find_all_for_site_filtered(&state.db, site_id, &params, filters).await?;
    let total = LegalDocumentRepo::count_for_site_filtered(&state.db, site_id, filters).await?;
    let items: Vec<LegalDocumentResponse> = documents
        .into_iter()
        .map(LegalDocumentResponse::from)
        .collect();
    Ok(Json(params.paginate(items, total)))
}

#[utoipa::path(
    get,
    path = "/legal/{id}",
    tag = "Legal",
    operation_id = "get_legal_document",
    description = "Get a legal document by ID",
    params(("id" = Uuid, Path, description = "The UUID of the legal document")),
    responses(
        (status = 200, description = "Legal document details", body = LegalDocumentResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this document's site", body = ProblemDetails),
        (status = 404, description = "Legal document not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_legal_document(
    State(_state): State<AppState>,
    access: AuthorizedContent<LegalDocument, Read>,
) -> Result<Json<LegalDocumentResponse>, ApiError> {
    Ok(Json(LegalDocumentResponse::from(access.entity)))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/legal/cookie-consent",
    tag = "Legal",
    operation_id = "get_cookie_consent",
    description = "Get cookie consent document with full structure (groups and items)",
    params(("site_id" = Uuid, Path, description = "The UUID of the site")),
    responses(
        (status = 200, description = "Cookie consent structure", body = LegalDocumentWithGroups),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails),
        (status = 404, description = "Cookie consent document not found for this site", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_cookie_consent(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    _access: AuthorizedSite<LegalDocument, Read>,
) -> Result<Json<LegalDocumentWithGroups>, ApiError> {
    let document =
        LegalDocumentRepo::find_by_type_for_site(&state.db, site_id, LegalDocType::CookieConsent)
            .await?;
    let groups = LegalGroupRepo::find_for_document(&state.db, document.id).await?;

    let mut groups_with_items = Vec::new();
    for group in groups {
        let items = LegalItemRepo::find_for_group(&state.db, group.id).await?;
        groups_with_items.push(LegalGroupWithItems {
            id: group.id,
            cookie_name: group.cookie_name,
            display_order: group.display_order,
            is_required: group.is_required,
            default_enabled: group.default_enabled,
            items: items.into_iter().map(LegalItemResponse::from).collect(),
        });
    }

    Ok(Json(LegalDocumentWithGroups {
        id: document.id,
        cookie_name: document.cookie_name,
        document_type: document.document_type,
        groups: groups_with_items,
    }))
}

#[utoipa::path(
    get,
    path = "/legal/{document_id}/groups",
    tag = "Legal",
    operation_id = "get_legal_groups",
    description = "Get groups for a legal document",
    params(("document_id" = Uuid, Path, description = "The UUID of the legal document")),
    responses(
        (status = 200, description = "Legal groups", body = Vec<LegalGroupResponse>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this document's site", body = ProblemDetails),
        (status = 404, description = "Legal document not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_legal_groups(
    State(state): State<AppState>,
    Path(document_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<Vec<LegalGroupResponse>>, ApiError> {
    let site_id = LegalDocumentRepo::resolve_site_id(&state.db, document_id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("legal", "read"),
    )
    .await?;
    let groups = LegalGroupRepo::find_for_document(&state.db, document_id).await?;
    let responses: Vec<LegalGroupResponse> =
        groups.into_iter().map(LegalGroupResponse::from).collect();
    Ok(Json(responses))
}

#[utoipa::path(
    get,
    path = "/legal/groups/{group_id}/items",
    tag = "Legal",
    operation_id = "get_legal_items",
    description = "Get items for a legal group",
    params(("group_id" = Uuid, Path, description = "The UUID of the legal group")),
    responses(
        (status = 200, description = "Legal items", body = Vec<LegalItemResponse>),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this group's site", body = ProblemDetails),
        (status = 404, description = "Legal group not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_legal_items(
    State(state): State<AppState>,
    Path(group_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<Vec<LegalItemResponse>>, ApiError> {
    let group = LegalGroupRepo::find_by_id(&state.db, group_id).await?;
    let site_id = LegalDocumentRepo::resolve_site_id(&state.db, group.legal_document_id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("legal", "read"),
    )
    .await?;
    let items = LegalItemRepo::find_for_group(&state.db, group_id).await?;
    let responses: Vec<LegalItemResponse> =
        items.into_iter().map(LegalItemResponse::from).collect();
    Ok(Json(responses))
}

#[utoipa::path(
    post,
    path = "/sites/{site_id}/legal",
    tag = "Legal",
    operation_id = "create_legal_document",
    description = "Create a legal document for a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = CreateLegalDocumentRequest, description = "Legal document data"),
    responses(
        (status = 201, description = "Document created", body = LegalDocumentResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn create_legal_document(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    _access: AuthorizedSite<LegalDocument, Create>,
    ValidatedJson(body): ValidatedJson<CreateLegalDocumentRequest>,
) -> Result<(StatusCode, Json<LegalDocumentResponse>), ApiError> {
    let mut body = body.into_inner();
    if !body.site_ids.contains(&site_id) {
        body.site_ids.push(site_id);
    }

    let document = content_lifecycle::create::<LegalDocument>(&state.db, body, &auth.0).await?;
    Ok((
        StatusCode::CREATED,
        Json(LegalDocumentResponse::from(document)),
    ))
}

#[utoipa::path(
    put,
    path = "/legal/{id}",
    tag = "Legal",
    operation_id = "update_legal_document",
    description = "Update a legal document",
    params(("id" = Uuid, Path, description = "Legal document UUID")),
    request_body(content = UpdateLegalDocumentRequest, description = "Document update data"),
    responses(
        (status = 200, description = "Document updated", body = LegalDocumentResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Document not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn update_legal_document(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    access: AuthorizedContent<LegalDocument, Update>,
    ValidatedJson(body): ValidatedJson<UpdateLegalDocumentRequest>,
) -> Result<Json<LegalDocumentResponse>, ApiError> {
    let document = content_lifecycle::update::<LegalDocument>(
        &state.db,
        id,
        body.into_inner(),
        access.entity,
        access.site_ids,
        &auth.0,
    )
    .await?;
    Ok(Json(LegalDocumentResponse::from(document)))
}

#[utoipa::path(
    delete,
    path = "/legal/{id}",
    tag = "Legal",
    operation_id = "delete_legal_document",
    description = "Soft delete a legal document",
    params(("id" = Uuid, Path, description = "Legal document UUID")),
    responses(
        (status = 204, description = "Document deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Document not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn delete_legal_document(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    _access: AuthorizedContent<LegalDocument, Delete>,
) -> Result<StatusCode, ApiError> {
    content_lifecycle::legal::delete(&state.db, id, &auth.0).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/legal/{document_id}/groups",
    tag = "Legal",
    operation_id = "create_legal_group",
    description = "Create a consent group for a legal document",
    params(("document_id" = Uuid, Path, description = "Legal document UUID")),
    request_body(content = CreateLegalGroupRequest, description = "Group data"),
    responses(
        (status = 201, description = "Group created", body = LegalGroupResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn create_legal_group(
    State(state): State<AppState>,
    Path(document_id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<CreateLegalGroupRequest>,
) -> Result<(StatusCode, Json<LegalGroupResponse>), ApiError> {
    let site_id = LegalDocumentRepo::resolve_site_id(&state.db, document_id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("legal", "create"),
    )
    .await?;
    ModuleGuard::<LegalModule>::check(&state.db, site_id).await?;

    let group = LegalGroupRepo::create(&state.db, document_id, body.into_inner()).await?;
    LEGAL_GROUP
        .mutate(AuditAction::Create, group.id)
        .site(site_id)
        .actor(auth.0.id)
        .payload(serde_json::json!({"type": "legal_group"}))
        .execute(&state.db)
        .await;
    Ok((StatusCode::CREATED, Json(LegalGroupResponse::from(group))))
}

#[utoipa::path(
    put,
    path = "/legal/groups/{id}",
    tag = "Legal",
    operation_id = "update_legal_group",
    description = "Update a legal consent group",
    params(("id" = Uuid, Path, description = "Legal group UUID")),
    request_body(content = UpdateLegalGroupRequest, description = "Group update data"),
    responses(
        (status = 200, description = "Group updated", body = LegalGroupResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Group not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn update_legal_group(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContent<crate::models::legal::LegalGroup, Update>,
    ValidatedJson(body): ValidatedJson<UpdateLegalGroupRequest>,
) -> Result<Json<LegalGroupResponse>, ApiError> {
    let updated = LegalGroupRepo::update(&state.db, id, body.into_inner()).await?;
    LEGAL_GROUP
        .mutate(AuditAction::Update, id)
        .site(access.primary_site_id)
        .actor(access.actor.id)
        .payload(serde_json::json!({"type": "legal_group"}))
        .execute(&state.db)
        .await;
    Ok(Json(LegalGroupResponse::from(updated)))
}

#[utoipa::path(
    delete,
    path = "/legal/groups/{id}",
    tag = "Legal",
    operation_id = "delete_legal_group",
    description = "Delete a legal consent group",
    params(("id" = Uuid, Path, description = "Legal group UUID")),
    responses(
        (status = 204, description = "Group deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Group not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn delete_legal_group(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContent<crate::models::legal::LegalGroup, Delete>,
) -> Result<StatusCode, ApiError> {
    LegalGroupRepo::delete(&state.db, id).await?;
    LEGAL_GROUP
        .mutate(AuditAction::Delete, id)
        .site(access.primary_site_id)
        .actor(access.actor.id)
        .payload(serde_json::json!({"type": "legal_group"}))
        .execute(&state.db)
        .await;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/legal/groups/{group_id}/items",
    tag = "Legal",
    operation_id = "create_legal_item",
    description = "Create a consent item in a group",
    params(("group_id" = Uuid, Path, description = "Legal group UUID")),
    request_body(content = CreateLegalItemRequest, description = "Item data"),
    responses(
        (status = 201, description = "Item created", body = LegalItemResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn create_legal_item(
    State(state): State<AppState>,
    Path(group_id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<CreateLegalItemRequest>,
) -> Result<(StatusCode, Json<LegalItemResponse>), ApiError> {
    let group = LegalGroupRepo::find_by_id(&state.db, group_id).await?;
    let site_id = LegalDocumentRepo::resolve_site_id(&state.db, group.legal_document_id).await?;
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("legal", "create"),
    )
    .await?;
    ModuleGuard::<LegalModule>::check(&state.db, site_id).await?;

    let item = LegalItemRepo::create(&state.db, group_id, body.into_inner()).await?;
    LEGAL_ITEM
        .mutate(AuditAction::Create, item.id)
        .site(site_id)
        .actor(auth.0.id)
        .payload(serde_json::json!({"type": "legal_item"}))
        .execute(&state.db)
        .await;
    Ok((StatusCode::CREATED, Json(LegalItemResponse::from(item))))
}

#[utoipa::path(
    put,
    path = "/legal/items/{id}",
    tag = "Legal",
    operation_id = "update_legal_item",
    description = "Update a legal consent item",
    params(("id" = Uuid, Path, description = "Legal item UUID")),
    request_body(content = UpdateLegalItemRequest, description = "Item update data"),
    responses(
        (status = 200, description = "Item updated", body = LegalItemResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Item not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn update_legal_item(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContent<crate::models::legal::LegalItem, Update>,
    ValidatedJson(body): ValidatedJson<UpdateLegalItemRequest>,
) -> Result<Json<LegalItemResponse>, ApiError> {
    let updated = LegalItemRepo::update(&state.db, id, body.into_inner()).await?;
    LEGAL_ITEM
        .mutate(AuditAction::Update, id)
        .site(access.primary_site_id)
        .actor(access.actor.id)
        .payload(serde_json::json!({"type": "legal_item"}))
        .execute(&state.db)
        .await;
    Ok(Json(LegalItemResponse::from(updated)))
}

#[utoipa::path(
    delete,
    path = "/legal/items/{id}",
    tag = "Legal",
    operation_id = "delete_legal_item",
    description = "Delete a legal consent item",
    params(("id" = Uuid, Path, description = "Legal item UUID")),
    responses(
        (status = 204, description = "Item deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Item not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn delete_legal_item(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContent<crate::models::legal::LegalItem, Delete>,
) -> Result<StatusCode, ApiError> {
    LegalItemRepo::delete(&state.db, id).await?;
    LEGAL_ITEM
        .mutate(AuditAction::Delete, id)
        .site(access.primary_site_id)
        .actor(access.actor.id)
        .payload(serde_json::json!({"type": "legal_item"}))
        .execute(&state.db)
        .await;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/legal/by-slug/{slug}",
    tag = "Legal",
    operation_id = "get_legal_document_by_slug",
    description = "Get a legal document by content slug with localizations",
    params(
        ("site_id" = Uuid, Path, description = "The UUID of the site"),
        ("slug" = String, Path, description = "URL-friendly identifier (lowercase, hyphens only)"),
        ("locale" = Option<String>, Query, description = "Optional locale code. When set, `localizations[]` collapses to one resolved element (ADR 0002).")
    ),
    responses(
        (status = 200, description = "Legal document with localizations", body = LegalDocumentDetailResponse),
        (status = 401, description = "Missing or invalid API key", body = ProblemDetails),
        (status = 403, description = "Insufficient permissions for this site", body = ProblemDetails),
        (status = 404, description = "Legal document not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_legal_document_by_slug(
    State(state): State<AppState>,
    Path((site_id, slug)): Path<(Uuid, String)>,
    locale: ResolveLocale,
    _access: AuthorizedSite<LegalDocument, Read>,
) -> Result<Json<LegalDocumentDetailResponse>, ApiError> {
    // Identical per (site, slug, resolved locale) → cacheable after the key check.
    let locale_key = locale.0.as_deref().unwrap_or("all").to_string();
    let response = crate::services::response_cache::cached(
        &state.redis,
        &crate::services::response_cache::key(
            site_id,
            &format!("legal:by-slug:{slug}:loc:{locale_key}"),
        ),
        || async {
            let document =
                LegalDocumentRepo::find_by_slug_for_site(&state.db, site_id, &slug).await?;
            let localizations =
                LegalDocumentLocalizationRepo::find_for_document(&state.db, document.id).await?;
            let mut loc_responses: Vec<LegalDocLocalizationResponse> = localizations
                .into_iter()
                .map(|l| LegalDocLocalizationResponse {
                    id: l.id,
                    locale_id: l.locale_id,
                    title: l.title,
                    intro: l.intro,
                })
                .collect();

            loc_responses = collapse_localizations(
                &state.db,
                site_id,
                locale.0.as_deref(),
                loc_responses,
                |l| l.locale_id,
            )
            .await?;

            Ok(LegalDocumentDetailResponse {
                id: document.id,
                cookie_name: document.cookie_name,
                document_type: document.document_type,
                localizations: loc_responses,
                created_at: document.created_at,
                updated_at: document.updated_at,
            })
        },
    )
    .await?;
    Ok(Json(response))
}

#[utoipa::path(
    post,
    path = "/legal/{id}/clone",
    tag = "Legal",
    operation_id = "clone_legal_document",
    description = "Clone a legal document as a new Draft with all groups, items, and localizations",
    params(("id" = Uuid, Path, description = "Source legal document UUID")),
    responses(
        (status = 201, description = "Legal document cloned", body = LegalDocumentResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Source document not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn clone_legal_document(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    access: AuthorizedContent<LegalDocument, Create>,
) -> Result<(StatusCode, Json<LegalDocumentResponse>), ApiError> {
    let document = content_lifecycle::legal::clone(&state.db, id, &access.actor).await?;

    Ok((
        StatusCode::CREATED,
        Json(LegalDocumentResponse::from(document)),
    ))
}

#[utoipa::path(
    get,
    path = "/legal/{id}/detail",
    tag = "Legal",
    operation_id = "get_legal_detail",
    description = "Get legal document with all content localizations and doc localizations for editing",
    params(
        ("id" = Uuid, Path, description = "Legal document UUID"),
        ("locale" = Option<String>, Query, description = "Optional locale code. When set, both `localizations[]` and `doc_localizations[]` collapse to one resolved element each (ADR 0002).")
    ),
    responses(
        (status = 200, description = "Legal document full detail", body = LegalDocumentFullDetailResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Document not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_legal_detail(
    State(state): State<AppState>,
    locale: ResolveLocale,
    access: AuthorizedContent<LegalDocument, Read>,
) -> Result<Json<LegalDocumentFullDetailResponse>, ApiError> {
    let site_id = access.primary_site_id;
    let doc = access.entity;
    let content_id = doc.content_id.ok_or_else(|| {
        ApiError::bad_request("Legal document has no content_id").with_code(codes::BAD_REQUEST)
    })?;

    let content = Content::find_by_id(&state.db, content_id).await?;
    let localizations = ContentLocalization::find_all_for_content(&state.db, content_id).await?;
    let mut loc_responses: Vec<LocalizationResponse> = localizations
        .into_iter()
        .map(LocalizationResponse::from)
        .collect();
    let doc_localizations =
        LegalDocumentLocalizationRepo::find_for_document(&state.db, doc.id).await?;
    let mut doc_loc_responses: Vec<LegalDocLocalizationResponse> = doc_localizations
        .into_iter()
        .map(|l| LegalDocLocalizationResponse {
            id: l.id,
            locale_id: l.locale_id,
            title: l.title,
            intro: l.intro,
        })
        .collect();

    // Two heterogeneous vecs share one resolution — resolve once, pick twice.
    // `collapse_localizations` is the 1:1 sugar; using it here would re-resolve
    // (an extra `find_all_for_site` round-trip), so this site stays on the
    // primitives. See `collapse_localizations` docs.
    if let Some(resolution) = resolve_ids_for_site(locale.0.as_deref(), &state.db, site_id).await? {
        loc_responses = pick_one(loc_responses, |l| l.locale_id, resolution);
        doc_loc_responses = pick_one(doc_loc_responses, |l| l.locale_id, resolution);
    }

    Ok(Json(LegalDocumentFullDetailResponse {
        id: doc.id,
        content_id,
        cookie_name: doc.cookie_name,
        document_type: doc.document_type,
        status: content.status,
        slug: content.slug,
        version: doc.version,
        parent_version_id: doc.parent_version_id,
        publish_start: content.publish_start,
        publish_end: content.publish_end,
        localizations: loc_responses,
        doc_localizations: doc_loc_responses,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
    }))
}

#[utoipa::path(
    get,
    path = "/legal/{id}/versions",
    tag = "Legal",
    operation_id = "get_legal_versions",
    description = "Get version history chain for a legal document",
    params(("id" = Uuid, Path, description = "Legal document UUID")),
    responses(
        (status = 200, description = "Version history", body = Vec<LegalVersionResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Document not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_legal_versions(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    _access: AuthorizedContent<LegalDocument, Read>,
) -> Result<Json<Vec<LegalVersionResponse>>, ApiError> {
    let versions = LegalDocumentRepo::find_versions(&state.db, id).await?;
    let mut responses = Vec::with_capacity(versions.len());
    for v in versions {
        let status = if let Some(cid) = v.content_id {
            let content = Content::find_by_id(&state.db, cid).await?;
            content.status
        } else {
            ContentStatus::Draft
        };
        responses.push(LegalVersionResponse {
            id: v.id,
            version: v.version,
            status,
            created_at: v.created_at,
        });
    }
    Ok(Json(responses))
}

#[utoipa::path(
    post,
    path = "/legal/{id}/new-version",
    tag = "Legal",
    operation_id = "create_legal_version",
    description = "Create a new draft version of a legal document",
    params(("id" = Uuid, Path, description = "Source legal document UUID")),
    responses(
        (status = 201, description = "New version created", body = LegalDocumentResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Source document not found or deleted", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn create_legal_version(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: WriteKey,
    access: AuthorizedContent<LegalDocument, Create>,
) -> Result<(StatusCode, Json<LegalDocumentResponse>), ApiError> {
    let site_ids = access.site_ids;
    let new_doc = LegalDocumentRepo::create_new_version(
        &state.db,
        id,
        site_ids.clone(),
        auth.0.user_identifier(),
    )
    .await?;

    let site_id = site_ids.into_iter().next();
    LEGAL_DOCUMENT
        .mutate(AuditAction::Create, new_doc.id)
        .maybe_site(site_id)
        .actor(auth.0.id)
        .metadata(serde_json::json!({ "new_version_from": id.to_string() }))
        .execute(&state.db)
        .await;

    Ok((
        StatusCode::CREATED,
        Json(LegalDocumentResponse {
            id: new_doc.id,
            cookie_name: new_doc.cookie_name,
            document_type: new_doc.document_type,
            status: ContentStatus::Draft,
            slug: None,
            version: new_doc.version,
            publish_start: None,
            publish_end: None,
            created_at: new_doc.created_at,
            updated_at: new_doc.updated_at,
        }),
    ))
}

#[utoipa::path(
    get,
    path = "/legal/{id}/localizations",
    tag = "Legal",
    operation_id = "get_legal_localizations",
    description = "Get all content localizations for a legal document",
    params(("id" = Uuid, Path, description = "Legal document UUID")),
    responses(
        (status = 200, description = "Content localizations", body = Vec<LocalizationResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Document not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn get_legal_localizations(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<Vec<LocalizationResponse>>, ApiError> {
    let doc = LegalDocumentRepo::find_by_id(&state.db, id).await?;
    let content_id = doc.content_id.ok_or_else(|| {
        ApiError::bad_request("Legal document has no content_id").with_code(codes::BAD_REQUEST)
    })?;
    let localizations =
        localization_lifecycle::list::<LegalLocalization>(&state.db, content_id, &auth.0).await?;
    let responses: Vec<LocalizationResponse> = localizations
        .into_iter()
        .map(LocalizationResponse::from)
        .collect();
    Ok(Json(responses))
}

#[utoipa::path(
    post,
    path = "/legal/{id}/localizations",
    tag = "Legal",
    operation_id = "create_legal_localization",
    description = "Create a content localization for a legal document",
    params(("id" = Uuid, Path, description = "Legal document UUID")),
    request_body(content = CreateLocalizationRequest, description = "Localization data"),
    responses(
        (status = 201, description = "Localization created", body = LocalizationResponse),
        (status = 400, description = "Validation error or duplicate locale", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn create_legal_localization(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    // Plain Actor: the lifecycle enforces `{resource}:create` per site,
    // which (unlike `WriteKey`) admits Clerk users by their site role.
    auth: Actor,
    ValidatedJson(body): ValidatedJson<CreateLocalizationRequest>,
) -> Result<(StatusCode, Json<LocalizationResponse>), ApiError> {
    let doc = LegalDocumentRepo::find_by_id(&state.db, id).await?;
    if LegalDocumentRepo::is_published(&state.db, id).await? {
        return Err(published_immutable_error());
    }
    let content_id = doc.content_id.ok_or_else(|| {
        ApiError::bad_request("Legal document has no content_id").with_code(codes::BAD_REQUEST)
    })?;
    let localization = localization_lifecycle::create::<LegalLocalization>(
        &state.db,
        content_id,
        body.into_inner(),
        &auth,
    )
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(LocalizationResponse::from(localization)),
    ))
}

#[utoipa::path(
    put,
    path = "/legal/localizations/{loc_id}",
    tag = "Legal",
    operation_id = "update_legal_localization",
    description = "Update a content localization for a legal document",
    params(("loc_id" = Uuid, Path, description = "Localization UUID")),
    request_body(content = UpdateLocalizationRequest, description = "Localization update data"),
    responses(
        (status = 200, description = "Localization updated", body = LocalizationResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Localization not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
async fn update_legal_localization(
    State(state): State<AppState>,
    Path(loc_id): Path<Uuid>,
    auth: Actor,
    ValidatedJson(body): ValidatedJson<UpdateLocalizationRequest>,
) -> Result<Json<LocalizationResponse>, ApiError> {
    if LegalDocumentRepo::is_published_for_localization(&state.db, loc_id).await? {
        return Err(published_immutable_error());
    }
    let localization = localization_lifecycle::update::<LegalLocalization>(
        &state.db,
        loc_id,
        body.into_inner(),
        &auth,
    )
    .await?;

    Ok(Json(LocalizationResponse::from(localization)))
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_legal_documents, create_legal_document))
        .routes(routes!(get_cookie_consent))
        .routes(routes!(get_legal_document_by_slug))
        .routes(routes!(get_legal_groups, create_legal_group))
        .routes(routes!(get_legal_items))
        .routes(routes!(create_legal_item))
        .routes(routes!(update_legal_group, delete_legal_group))
        .routes(routes!(update_legal_item, delete_legal_item))
        .routes(routes!(clone_legal_document))
        .routes(routes!(get_legal_detail))
        .routes(routes!(get_legal_versions))
        .routes(routes!(create_legal_version))
        .routes(routes!(get_legal_localizations, create_legal_localization))
        .routes(routes!(update_legal_localization))
        .routes(routes!(
            get_legal_document,
            update_legal_document,
            delete_legal_document
        ))
}
