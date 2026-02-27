//! System endpoints (health check and API root)

use rocket::serde::json::Json;
use std::time::Instant;

use crate::dto::health::{HealthResponse, ServiceHealth, StorageHealth};
use crate::AppState;

#[utoipa::path(
    tag = "System",
    operation_id = "index",
    description = "API root endpoint returning version info",
    responses(
        (status = 200, description = "API version string")
    )
)]
#[get("/")]
pub fn index() -> &'static str {
    "OpenYapper API v0.1.0"
}

#[utoipa::path(
    tag = "System",
    operation_id = "health_check",
    description = "Health check endpoint verifying database connectivity and returning structured status",
    responses(
        (status = 200, description = "All services healthy", body = HealthResponse),
        (status = 503, description = "One or more services degraded/unhealthy", body = HealthResponse)
    )
)]
#[get("/health")]
pub async fn health(
    state: &rocket::State<AppState>,
) -> (rocket::http::Status, Json<HealthResponse>) {
    let mut services = Vec::new();

    // Check database connection
    let start = Instant::now();
    let db_check = sqlx::query("SELECT 1").fetch_one(&state.db).await;
    let latency = start.elapsed().as_millis() as u64;

    match db_check {
        Ok(_) => services.push(ServiceHealth {
            name: "database".to_string(),
            status: "up".to_string(),
            latency_ms: Some(latency),
            error: None,
        }),
        Err(e) => services.push(ServiceHealth {
            name: "database".to_string(),
            status: "down".to_string(),
            latency_ms: Some(latency),
            error: Some(e.to_string()),
        }),
    }

    let db_up = services
        .iter()
        .any(|s| s.name == "database" && s.status == "up");

    // Check Redis connection
    let redis_up = match &state.redis {
        Some(conn) => {
            let mut conn = conn.clone();
            let redis_start = Instant::now();
            let result: Result<String, redis::RedisError> =
                redis::cmd("PING").query_async(&mut conn).await;
            let redis_latency = redis_start.elapsed().as_millis() as u64;
            match result {
                Ok(_) => {
                    services.push(ServiceHealth {
                        name: "redis (cache)".to_string(),
                        status: "up".to_string(),
                        latency_ms: Some(redis_latency),
                        error: None,
                    });
                    true
                }
                Err(e) => {
                    services.push(ServiceHealth {
                        name: "redis (cache)".to_string(),
                        status: "down".to_string(),
                        latency_ms: Some(redis_latency),
                        error: Some(e.to_string()),
                    });
                    false
                }
            }
        }
        None => {
            services.push(ServiceHealth {
                name: "redis (cache)".to_string(),
                status: "disabled".to_string(),
                latency_ms: None,
                error: None,
            });
            false
        }
    };

    // Check Clerk API connectivity (if configured)
    let clerk_up = match &state.clerk_service {
        Some(clerk) => {
            let clerk_start = Instant::now();
            match clerk.health_check().await {
                Ok(()) => {
                    let clerk_latency = clerk_start.elapsed().as_millis() as u64;
                    services.push(ServiceHealth {
                        name: "clerk (idp)".to_string(),
                        status: "up".to_string(),
                        latency_ms: Some(clerk_latency),
                        error: None,
                    });
                    true
                }
                Err(e) => {
                    let clerk_latency = clerk_start.elapsed().as_millis() as u64;
                    services.push(ServiceHealth {
                        name: "clerk (idp)".to_string(),
                        status: "down".to_string(),
                        latency_ms: Some(clerk_latency),
                        error: Some(e),
                    });
                    false
                }
            }
        }
        None => {
            services.push(ServiceHealth {
                name: "clerk (idp)".to_string(),
                status: "disabled".to_string(),
                latency_ms: None,
                error: None,
            });
            true // not configured = not a problem
        }
    };

    // Check storage backend
    let storage_start = Instant::now();
    let storage_info = state.storage.health_check().await;
    let storage_latency = storage_start.elapsed().as_millis() as u64;
    let storage_up = storage_info.status == "up";

    let storage_health = StorageHealth {
        name: format!("storage ({})", storage_info.provider),
        status: storage_info.status,
        latency_ms: Some(storage_latency),
        error: storage_info.error,
        provider: storage_info.provider,
        total_bytes: storage_info.total_bytes,
        available_bytes: storage_info.available_bytes,
        used_percent: storage_info.used_percent,
        bucket: storage_info.bucket,
    };

    // Status: healthy (all up), degraded (db up but optional services down), unhealthy (db down)
    let all_optional_up = redis_up && clerk_up && storage_up;
    let (overall_status, http_status) = if db_up && all_optional_up {
        ("healthy", rocket::http::Status::Ok)
    } else if db_up {
        ("degraded", rocket::http::Status::Ok)
    } else {
        ("unhealthy", rocket::http::Status::ServiceUnavailable)
    };

    (
        http_status,
        Json(HealthResponse {
            status: overall_status.to_string(),
            services,
            storage: Some(storage_health),
        }),
    )
}

use rocket::Route;

/// System routes (mounted at "/")
pub fn routes() -> Vec<Route> {
    routes![index, health]
}
