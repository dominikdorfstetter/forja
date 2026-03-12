//! Onboarding progress model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;

/// Valid onboarding step keys
pub const VALID_STEPS: &[&str] = &[
    "create_site",
    "edit_first_post",
    "preview_site",
    "publish_first_post",
    "customize_settings",
    "invite_team",
    "setup_workflow",
];

/// Onboarding progress record
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OnboardingProgress {
    pub id: Uuid,
    pub clerk_user_id: String,
    pub site_id: Uuid,
    pub step_key: String,
    pub completed_at: DateTime<Utc>,
}

impl OnboardingProgress {
    /// Get all completed steps for a user on a site
    pub async fn find_for_user_site(
        pool: &PgPool,
        clerk_user_id: &str,
        site_id: Uuid,
    ) -> Result<Vec<Self>, ApiError> {
        let steps = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, clerk_user_id, site_id, step_key, completed_at
            FROM onboarding_progress
            WHERE clerk_user_id = $1 AND site_id = $2
            ORDER BY completed_at ASC
            "#,
        )
        .bind(clerk_user_id)
        .bind(site_id)
        .fetch_all(pool)
        .await?;

        Ok(steps)
    }

    /// Mark a step as completed (idempotent — uses ON CONFLICT DO NOTHING)
    pub async fn complete_step(
        pool: &PgPool,
        clerk_user_id: &str,
        site_id: Uuid,
        step_key: &str,
    ) -> Result<(), ApiError> {
        if !VALID_STEPS.contains(&step_key) {
            return Err(ApiError::BadRequest(format!(
                "Invalid step key: '{}'. Valid keys: {:?}",
                step_key, VALID_STEPS
            )));
        }

        sqlx::query(
            r#"
            INSERT INTO onboarding_progress (clerk_user_id, site_id, step_key)
            VALUES ($1, $2, $3)
            ON CONFLICT (clerk_user_id, site_id, step_key) DO NOTHING
            "#,
        )
        .bind(clerk_user_id)
        .bind(site_id)
        .bind(step_key)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Reset all progress for a user on a site
    pub async fn reset(pool: &PgPool, clerk_user_id: &str, site_id: Uuid) -> Result<i64, ApiError> {
        let result = sqlx::query(
            r#"
            DELETE FROM onboarding_progress
            WHERE clerk_user_id = $1 AND site_id = $2
            "#,
        )
        .bind(clerk_user_id)
        .bind(site_id)
        .execute(pool)
        .await?;

        Ok(result.rows_affected() as i64)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_steps() {
        assert!(VALID_STEPS.contains(&"create_site"));
        assert!(VALID_STEPS.contains(&"edit_first_post"));
        assert!(VALID_STEPS.contains(&"publish_first_post"));
        assert!(!VALID_STEPS.contains(&"invalid_step"));
    }
}
