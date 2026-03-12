//! Onboarding progress DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use validator::Validate;

/// Single completed step
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "A completed onboarding step")]
pub struct OnboardingStepResponse {
    #[schema(example = "edit_first_post")]
    pub step_key: String,
    #[schema(example = "2024-06-15T10:30:00Z")]
    pub completed_at: DateTime<Utc>,
}

/// Full onboarding progress response for a site
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Onboarding progress for a user on a site")]
pub struct OnboardingProgressResponse {
    pub completed_steps: Vec<OnboardingStepResponse>,
    #[schema(example = 5)]
    pub total_steps: usize,
    #[schema(example = 3)]
    pub completed_count: usize,
    #[schema(example = 60)]
    pub progress_percent: u8,
}

/// Request to complete a step
#[derive(Debug, Clone, Deserialize, Validate, utoipa::ToSchema)]
#[schema(description = "Complete an onboarding step")]
pub struct CompleteStepRequest {
    #[schema(example = "edit_first_post")]
    #[validate(length(
        min = 1,
        max = 50,
        message = "Step key must be between 1 and 50 characters"
    ))]
    pub step_key: String,
}
