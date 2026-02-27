//! Public frontend configuration DTOs

use serde::Serialize;

/// Public configuration served to the admin dashboard
#[derive(Serialize, utoipa::ToSchema)]
#[schema(description = "Public frontend configuration")]
pub struct ConfigResponse {
    /// Clerk publishable key for frontend authentication
    #[schema(example = "pk_test_...")]
    pub clerk_publishable_key: String,

    /// Application name
    #[schema(example = "OpenYapper")]
    pub app_name: String,
}
