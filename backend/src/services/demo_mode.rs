//! Demo mode fairing.
//!
//! When `DEMO_MODE=true`, seeds a demo site on liftoff so new users
//! can explore the CMS immediately.

use crate::AppState;
use crate::services::worker_lock;

/// Rocket fairing that seeds demo data on liftoff when demo mode is enabled.
pub struct DemoModeFairing;

impl DemoModeFairing {
    /// Fire-and-forget seed task. One-shot rather than a polling loop —
    /// spawned so it doesn't block boot.
    pub fn spawn(state: AppState) {
        if !state.settings.demo_mode {
            tracing::info!(worker = "demo_mode", "disabled");
            return;
        }

        if state.settings.environment != "development" {
            tracing::warn!(
                worker = "demo_mode",
                environment = %state.settings.environment,
                "demo mode enabled outside development — guest key grants read access to the demo site; disable DEMO_MODE in non-development environments"
            );
        }

        tracing::info!(worker = "demo_mode", "seed starting");
        let pool = state.db.clone();
        let seed_sql = include_str!("../../scripts/demo_seed.sql");
        tokio::spawn(async move {
            worker_lock::run_if_leader(&pool, "demo_mode_seed", || async {
                match sqlx::raw_sql(seed_sql).execute(&pool).await {
                    Ok(_) => tracing::info!(worker = "demo_mode", "seed succeeded"),
                    Err(e) => tracing::error!(worker = "demo_mode", error = %e, "seed failed"),
                }
            })
            .await;
        });
    }
}
