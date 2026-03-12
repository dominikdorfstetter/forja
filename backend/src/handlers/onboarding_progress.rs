//! Onboarding progress handlers

use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::onboarding_progress::{
    CompleteStepRequest, OnboardingProgressResponse, OnboardingStepResponse,
};
use crate::errors::{codes, ApiError, ProblemDetails};
use crate::guards::auth_guard::{AuthSource, ReadKey};
use crate::models::onboarding_progress::OnboardingProgress;
use crate::models::site_membership::SiteRole;
use crate::AppState;

/// Base step count (without team-specific steps)
const BASE_STEPS: usize = 5;
/// Team-specific steps added when member_count >= 2
const TEAM_STEPS: usize = 2;

/// Get onboarding progress for the current user on a site
#[utoipa::path(
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
#[get("/sites/<site_id>/onboarding-progress")]
pub async fn get_onboarding_progress(
    state: &State<AppState>,
    site_id: Uuid,
    auth: ReadKey,
) -> Result<Json<OnboardingProgressResponse>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;

    let clerk_user_id = extract_clerk_user_id(&auth)?;

    let steps = OnboardingProgress::find_for_user_site(&state.db, &clerk_user_id, site_id).await?;

    // Determine total steps based on team size
    let member_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM site_memberships WHERE site_id = $1")
            .bind(site_id)
            .fetch_one(&state.db)
            .await?;

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

    Ok(Json(OnboardingProgressResponse {
        completed_steps,
        total_steps,
        completed_count,
        progress_percent,
    }))
}

/// Complete an onboarding step
#[utoipa::path(
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
#[put("/sites/<site_id>/onboarding-progress", data = "<body>")]
pub async fn complete_onboarding_step(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<CompleteStepRequest>,
    auth: ReadKey,
) -> Result<Json<OnboardingProgressResponse>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;

    let clerk_user_id = extract_clerk_user_id(&auth)?;

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::bad_request(format!("Validation error: {}", e)))?;

    OnboardingProgress::complete_step(&state.db, &clerk_user_id, site_id, &req.step_key).await?;

    // Return updated progress
    let steps = OnboardingProgress::find_for_user_site(&state.db, &clerk_user_id, site_id).await?;

    let member_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM site_memberships WHERE site_id = $1")
            .bind(site_id)
            .fetch_one(&state.db)
            .await?;

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

    Ok(Json(OnboardingProgressResponse {
        completed_steps,
        total_steps,
        completed_count,
        progress_percent,
    }))
}

/// Extract clerk_user_id from auth, returning an error for API key auth
fn extract_clerk_user_id(auth: &ReadKey) -> Result<String, ApiError> {
    match &auth.0.auth_source {
        AuthSource::ClerkJwt { clerk_user_id } => Ok(clerk_user_id.clone()),
        AuthSource::ApiKey => Err(ApiError::bad_request(
            "Onboarding progress requires Clerk authentication",
        )
        .with_code(codes::ONBOARDING_REQUIRES_CLERK)),
    }
}

/// Collect onboarding progress routes
pub fn routes() -> Vec<Route> {
    routes![get_onboarding_progress, complete_onboarding_step]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 2, "Should have 2 onboarding progress routes");
    }
}
