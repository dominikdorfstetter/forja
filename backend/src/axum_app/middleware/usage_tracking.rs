//! Record API-key usage details on every response. Mirrors
//! `crate::middleware::usage_tracking::UsageTrackingFairing`.
//!
//! `UsageTimingFairing` (which only pre-creates the context so the
//! auth guard's `populate` call hits the same instance) is folded
//! into this layer's pre-insert pattern — same Arc trick as
//! `rate_limit_headers`.
//!
//! Behavior:
//! 1. Pre-insert `Arc<ApiKeyUsageContext>` into request extensions so
//!    the API-key auth extractor (`extractors.rs:375`) finds the
//!    existing one and populates it via `populate()`.
//! 2. After `next.run`, read the response status and `take()` the
//!    snapshot. If unset (request wasn't API-key authenticated), bail.
//! 3. Fire-and-forget `tokio::spawn` to write the `ApiKeyUsage` row
//!    and bump the per-key error counter in Redis if status >= 400.

use std::sync::Arc;

use axum::extract::{Request, State};
use axum::middleware::Next;
use axum::response::Response;

use crate::AppState;
use crate::middleware::usage_tracking::ApiKeyUsageContext;
use crate::models::api_key::ApiKeyUsage;

pub async fn layer(State(state): State<AppState>, mut req: Request, next: Next) -> Response {
    // Same pattern as rate_limit_headers: ensure the Arc lives across
    // the await so the auth extractor's `ensure_extension` returns it.
    let ctx: Arc<ApiKeyUsageContext> = req
        .extensions()
        .get::<Arc<ApiKeyUsageContext>>()
        .cloned()
        .unwrap_or_else(|| {
            let arc = Arc::new(ApiKeyUsageContext::default());
            req.extensions_mut().insert(arc.clone());
            arc
        });

    let response = next.run(req).await;

    // The fairing-side `take()` is a borrow against the once-written
    // unsafe cells. Snapshot now and let the spawned task own the data.
    let Some(snapshot) = ctx.take() else {
        return response; // Not API-key authenticated.
    };

    let status_code = response.status().as_u16() as i16;
    let response_time_ms = snapshot
        .request_start
        .map(|s| s.elapsed().as_millis() as i32)
        .unwrap_or(0);

    let pool = state.db.clone();
    let redis = state.redis.clone();
    let api_key_id = snapshot.api_key_id;
    let endpoint = snapshot.endpoint;
    let method = snapshot.method;
    let ip_address = snapshot.ip_address;
    let user_agent = snapshot.user_agent;

    tokio::spawn(async move {
        if let Err(e) = ApiKeyUsage::record(
            &pool,
            api_key_id,
            &endpoint,
            &method,
            status_code,
            response_time_ms,
            ip_address.as_deref(),
            user_agent.as_deref(),
            None,
            None,
            None,
        )
        .await
        {
            tracing::warn!(
                error = %e,
                key_id = %api_key_id,
                "Failed to record API key usage detail"
            );
        }

        if status_code >= 400
            && let Some(ref redis) = redis
        {
            let now = chrono::Utc::now();
            let error_key = format!("quota:{}:err_h:{}", api_key_id, now.format("%Y%m%d%H"));
            let mut conn = redis.clone();
            let count: Result<u32, _> =
                redis::AsyncCommands::incr(&mut conn, &error_key, 1u32).await;
            if let Ok(1) = count {
                let _ = redis::cmd("EXPIRE")
                    .arg(&error_key)
                    .arg(7200i64)
                    .query_async::<()>(&mut conn)
                    .await;
            }
        }
    });

    response
}
