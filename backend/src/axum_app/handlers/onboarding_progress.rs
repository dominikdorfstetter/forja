//! Axum port of `crate::handlers::onboarding_progress`. Two endpoints
//! tracking per-user setup checklist progress per site. Mounted under
//! `/api/v1`.

use axum::extract::{Path, State};
use axum::response::Json;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::AppState;
use crate::dto::onboarding_progress::{
    CompleteStepRequest, OnboardingProgressResponse, OnboardingStepResponse,
};
use crate::dto::validated::ValidatedJson;
use crate::errors::{ApiError, ProblemDetails, codes};
use crate::guards::actor::Actor;
use crate::guards::auth_guard::{ReadKey, WriteKey};
use crate::models::onboarding_progress::OnboardingProgress;
use crate::models::site_membership::SiteMembership;
use crate::services::permission_service::{Permission, PermissionService};

const BASE_STEPS: usize = 5;
const TEAM_STEPS: usize = 2;

#[utoipa::path(
    get,
    path = "/sites/{site_id}/onboarding-progress",
    tag = "Sites",
    operation_id = "get_onboarding_progress",
    description = "Get onboarding checklist progress for the current user on a site",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    responses(
        (status = 200, description = "Onboarding progress", body = OnboardingProgressResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("bearer_auth" = []))
)]
async fn get_onboarding_progress(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: ReadKey,
) -> Result<Json<OnboardingProgressResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("site", "read"),
    )
    .await?;

    let clerk_user_id = extract_clerk_user_id(&auth.0)?;
    Ok(Json(
        build_progress_response(&state, &clerk_user_id, site_id).await?,
    ))
}

#[utoipa::path(
    put,
    path = "/sites/{site_id}/onboarding-progress",
    tag = "Sites",
    operation_id = "complete_onboarding_step",
    description = "Mark an onboarding checklist step as completed",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = CompleteStepRequest, description = "Step to complete"),
    responses(
        (status = 200, description = "Step completed", body = OnboardingProgressResponse),
        (status = 400, description = "Invalid step key", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails)
    ),
    security(("bearer_auth" = []))
)]
async fn complete_onboarding_step(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    auth: WriteKey,
    ValidatedJson(body): ValidatedJson<CompleteStepRequest>,
) -> Result<Json<OnboardingProgressResponse>, ApiError> {
    PermissionService::require(
        &state.db,
        &auth.0,
        site_id,
        &Permission::new("site", "read"),
    )
    .await?;

    let clerk_user_id = extract_clerk_user_id(&auth.0)?;

    OnboardingProgress::complete_step(&state.db, &clerk_user_id, site_id, &body.step_key).await?;

    Ok(Json(
        build_progress_response(&state, &clerk_user_id, site_id).await?,
    ))
}

/// Aggregate the user's progress + total-step count into a response. The
/// total-step computation depends on team size, so it must be re-run on
/// every read; sharing this between get/complete keeps both handlers
/// returning identical shapes.
async fn build_progress_response(
    state: &AppState,
    clerk_user_id: &str,
    site_id: Uuid,
) -> Result<OnboardingProgressResponse, ApiError> {
    let steps = OnboardingProgress::find_for_user_site(&state.db, clerk_user_id, site_id).await?;

    let member_count = SiteMembership::count_for_site(&state.db, site_id).await?;

    let total_steps = if member_count >= 2 {
        BASE_STEPS + TEAM_STEPS
    } else {
        BASE_STEPS
    };

    let completed_steps: Vec<OnboardingStepResponse> = steps
        .into_iter()
        .map(|s| OnboardingStepResponse {
            step_key: s.step_key,
            completed_at: s.completed_at,
        })
        .collect();
    let completed_count = completed_steps.len();
    let progress_percent = ((completed_count as f64 / total_steps as f64) * 100.0) as u8;

    Ok(OnboardingProgressResponse {
        completed_steps,
        total_steps,
        completed_count,
        progress_percent,
    })
}

fn extract_clerk_user_id(auth: &Actor) -> Result<String, ApiError> {
    auth.clerk_user_id().map(|s| s.to_string()).ok_or_else(|| {
        ApiError::bad_request("Onboarding progress requires Clerk authentication")
            .with_code(codes::ONBOARDING_REQUIRES_CLERK)
    })
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(get_onboarding_progress, complete_onboarding_step))
}
