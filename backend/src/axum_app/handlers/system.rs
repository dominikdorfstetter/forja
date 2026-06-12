//! Axum system handlers — API index redirect plus the public and
//! admin-gated health probes.
//!
//! `collect_health_response` pings DB, Redis, Clerk, and the storage
//! backend; `sanitize_public` strips reconnaissance-sensitive fields
//! (version, error strings, storage internals) before returning to an
//! anonymous caller. Both are kept module-private; only `health` and
//! `health_detailed` cross the API boundary.

use std::time::Instant;

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{Json, Redirect};
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

use crate::dto::health::{HealthResponse, ServiceHealth, StorageHealth};
use crate::errors::ProblemDetails;
use crate::guards::auth_guard::AdminKey;
use crate::AppState;

async fn collect_health_response(state: &AppState) -> (StatusCode, HealthResponse) {
    let db_fut = async {
        let start = Instant::now();
        let db_check = crate::repos::ping(&state.db).await;
        let latency = start.elapsed().as_millis() as u64;
        match db_check {
            Ok(_) => (
                ServiceHealth {
                    name: "database".to_string(),
                    status: "up".to_string(),
                    latency_ms: Some(latency),
                    error: None,
                },
                true,
            ),
            Err(e) => {
                tracing::error!(error = %e, "Health check: database down");
                (
                    ServiceHealth {
                        name: "database".to_string(),
                        status: "down".to_string(),
                        latency_ms: Some(latency),
                        error: Some(e.to_string()),
                    },
                    false,
                )
            }
        }
    };

    let redis_fut = async {
        match &state.redis {
            Some(conn) => {
                let mut conn = conn.clone();
                let start = Instant::now();
                let result: Result<String, redis::RedisError> =
                    redis::cmd("PING").query_async(&mut conn).await;
                let latency = start.elapsed().as_millis() as u64;
                match result {
                    Ok(_) => (
                        ServiceHealth {
                            name: "redis (cache)".to_string(),
                            status: "up".to_string(),
                            latency_ms: Some(latency),
                            error: None,
                        },
                        true,
                    ),
                    Err(e) => {
                        tracing::error!(error = %e, "Health check: redis down");
                        (
                            ServiceHealth {
                                name: "redis (cache)".to_string(),
                                status: "down".to_string(),
                                latency_ms: Some(latency),
                                error: Some(e.to_string()),
                            },
                            false,
                        )
                    }
                }
            }
            None => (
                ServiceHealth {
                    name: "redis (cache)".to_string(),
                    status: "disabled".to_string(),
                    latency_ms: None,
                    error: None,
                },
                false,
            ),
        }
    };

    let clerk_fut = async {
        match &state.clerk_service {
            Some(clerk) => {
                let start = Instant::now();
                let result = clerk.health_check().await;
                let latency = start.elapsed().as_millis() as u64;
                match result {
                    Ok(()) => (
                        ServiceHealth {
                            name: "clerk (idp)".to_string(),
                            status: "up".to_string(),
                            latency_ms: Some(latency),
                            error: None,
                        },
                        true,
                    ),
                    Err(e) => {
                        tracing::error!(error = %e, "Health check: clerk down");
                        (
                            ServiceHealth {
                                name: "clerk (idp)".to_string(),
                                status: "down".to_string(),
                                latency_ms: Some(latency),
                                error: Some(e),
                            },
                            false,
                        )
                    }
                }
            }
            None => (
                ServiceHealth {
                    name: "clerk (idp)".to_string(),
                    status: "disabled".to_string(),
                    latency_ms: None,
                    error: None,
                },
                true,
            ),
        }
    };

    let storage_fut = async {
        let start = Instant::now();
        let storage_info = state.storage.health_check().await;
        let latency = start.elapsed().as_millis() as u64;
        let up = storage_info.status == "up";
        if let Some(ref err) = storage_info.error {
            tracing::error!(error = %err, "Health check: storage down");
        }
        (
            StorageHealth {
                name: format!("storage ({})", storage_info.provider),
                status: storage_info.status,
                latency_ms: Some(latency),
                error: storage_info.error,
                provider: storage_info.provider,
                total_bytes: storage_info.total_bytes,
                available_bytes: storage_info.available_bytes,
                used_percent: storage_info.used_percent,
                bucket: storage_info.bucket,
            },
            up,
        )
    };

    let (
        (db_health, db_up),
        (redis_health, redis_up),
        (clerk_health, clerk_up),
        (storage_health, storage_up),
    ) = tokio::join!(db_fut, redis_fut, clerk_fut, storage_fut);

    let services = vec![db_health, redis_health, clerk_health];

    let all_optional_up = redis_up && clerk_up && storage_up;
    let (overall_status, http_status) = if db_up && all_optional_up {
        ("healthy", StatusCode::OK)
    } else if db_up {
        ("degraded", StatusCode::OK)
    } else {
        ("unhealthy", StatusCode::SERVICE_UNAVAILABLE)
    };

    (
        http_status,
        HealthResponse {
            status: overall_status.to_string(),
            version: Some(env!("CARGO_PKG_VERSION").to_string()),
            services,
            storage: Some(storage_health),
        },
    )
}

/// Strip reconnaissance-sensitive fields from a `HealthResponse` before
/// returning it to an anonymous caller. See issue #477.
fn sanitize_public(mut resp: HealthResponse) -> HealthResponse {
    resp.version = None;
    for svc in &mut resp.services {
        svc.error = None;
    }
    if let Some(storage) = resp.storage.as_mut() {
        storage.error = None;
        storage.total_bytes = None;
        storage.available_bytes = None;
        storage.used_percent = None;
        storage.bucket = None;
    }
    resp
}

#[utoipa::path(
    get,
    path = "/",
    tag = "System",
    operation_id = "index",
    description = "Redirects to the admin dashboard",
    responses(
        (status = 303, description = "Redirect to /dashboard")
    )
)]
async fn index() -> Redirect {
    Redirect::to("/dashboard")
}

#[utoipa::path(
    get,
    path = "/health",
    tag = "System",
    operation_id = "health_check",
    description = "Public liveness probe. Returns only generic status / service / latency fields — no version, error strings, or storage internals. For full detail use `/health/detailed` with an admin key.",
    responses(
        (status = 200, description = "All services healthy", body = HealthResponse),
        (status = 503, description = "One or more services degraded or unhealthy", body = HealthResponse)
    )
)]
async fn health(State(state): State<AppState>) -> (StatusCode, Json<HealthResponse>) {
    let (status, full) = collect_health_response(&state).await;
    (status, Json(sanitize_public(full)))
}

#[utoipa::path(
    get,
    path = "/health/detailed",
    tag = "System",
    operation_id = "health_check_detailed",
    description = "Admin-only health check. Returns the full response with version, per-service error messages, and storage internals (bucket name, disk usage).",
    responses(
        (status = 200, description = "All services healthy", body = HealthResponse),
        (status = 401, description = "Missing or invalid admin credentials", body = ProblemDetails),
        (status = 403, description = "Admin role required", body = ProblemDetails),
        (status = 503, description = "One or more services degraded or unhealthy", body = HealthResponse)
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
async fn health_detailed(
    State(state): State<AppState>,
    _auth: AdminKey,
) -> (StatusCode, Json<HealthResponse>) {
    let (status, full) = collect_health_response(&state).await;
    (status, Json(full))
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(index))
        .routes(routes!(health))
        .routes(routes!(health_detailed))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use tower::ServiceExt;
    use utoipa::OpenApi;

    #[derive(OpenApi)]
    #[openapi(paths())]
    struct EmptyDoc;

    #[tokio::test]
    async fn index_redirects_to_dashboard() {
        let (router, _api) = OpenApiRouter::<()>::with_openapi(EmptyDoc::openapi())
            .routes(utoipa_axum::routes!(index))
            .split_for_parts();

        let response = router
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::SEE_OTHER);
        assert_eq!(
            response
                .headers()
                .get(axum::http::header::LOCATION)
                .and_then(|v| v.to_str().ok()),
            Some("/dashboard")
        );
    }
}
