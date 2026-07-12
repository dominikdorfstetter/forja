//! Emit `X-RateLimit-*` and `X-Quota-*` response headers from the
//! per-request atomics that auth extractors populate. Mirrors the
//! Rocket `Security Headers` fairing's rate-limit / quota header block
//! (lines 506–540 in `main.rs`).
//!
//! ## Why pre-insert the Arc here
//!
//! Auth extractors call `ensure_extension::<RateLimitHeaderInfo>(parts)`
//! which inserts an `Arc<T>` into request extensions, *or* returns the
//! existing one if already present. The auth extractor runs *inside*
//! `next.run(req)` — by the time it inserts the Arc, the middleware no
//! longer holds the request to read it.
//!
//! Solution: this middleware inserts the Arc itself, *before* calling
//! `next.run`. The middleware keeps its own clone on the stack across
//! the await. The auth extractor finds the existing Arc (the dedup
//! branch in `ensure_extension`) and writes to its atomics. After
//! `next.run` returns, the middleware reads the (now-populated) atomics
//! from its still-held Arc clone. Atomics make the cross-await sharing
//! safe without locks.
//!
//! Side benefit: the headers are emitted regardless of which auth strategy
//! ran, since all three (Clerk JWT, API key, public) populate the same
//! `RateLimitHeaderInfo` extension when Redis is configured.

use std::sync::Arc;
use std::sync::atomic::Ordering::Relaxed;

use axum::extract::Request;
use axum::http::header::HeaderMap;
use axum::http::{HeaderName, HeaderValue};
use axum::middleware::Next;
use axum::response::Response;

use crate::middleware::rate_limit::{QuotaHeaderInfo, RateLimitHeaderInfo};

const X_RATELIMIT_LIMIT: HeaderName = HeaderName::from_static("x-ratelimit-limit");
const X_RATELIMIT_REMAINING: HeaderName = HeaderName::from_static("x-ratelimit-remaining");
const X_RATELIMIT_RESET: HeaderName = HeaderName::from_static("x-ratelimit-reset");

const X_QUOTA_LIMIT_HOURLY: HeaderName = HeaderName::from_static("x-quota-limit-hourly");
const X_QUOTA_REMAINING_HOURLY: HeaderName = HeaderName::from_static("x-quota-remaining-hourly");
const X_QUOTA_RESET_HOURLY: HeaderName = HeaderName::from_static("x-quota-reset-hourly");
const X_QUOTA_LIMIT_DAILY: HeaderName = HeaderName::from_static("x-quota-limit-daily");
const X_QUOTA_REMAINING_DAILY: HeaderName = HeaderName::from_static("x-quota-remaining-daily");
const X_QUOTA_RESET_DAILY: HeaderName = HeaderName::from_static("x-quota-reset-daily");
const X_QUOTA_LIMIT_MONTHLY: HeaderName = HeaderName::from_static("x-quota-limit-monthly");
const X_QUOTA_REMAINING_MONTHLY: HeaderName = HeaderName::from_static("x-quota-remaining-monthly");
const X_QUOTA_RESET_MONTHLY: HeaderName = HeaderName::from_static("x-quota-reset-monthly");

fn insert_num<T: ToString>(headers: &mut HeaderMap, name: HeaderName, value: T) {
    if let Ok(v) = HeaderValue::from_str(&value.to_string()) {
        headers.insert(name, v);
    }
}

fn write_rate_limit_headers(headers: &mut HeaderMap, info: &RateLimitHeaderInfo) {
    let limit = info.limit.load(Relaxed);
    if limit == 0 {
        return; // No rate limit applied to this request.
    }
    insert_num(headers, X_RATELIMIT_LIMIT, limit);
    insert_num(headers, X_RATELIMIT_REMAINING, info.remaining.load(Relaxed));
    insert_num(headers, X_RATELIMIT_RESET, info.reset.load(Relaxed));
}

fn write_quota_headers(headers: &mut HeaderMap, info: &QuotaHeaderInfo) {
    if info.hourly_flag.load(Relaxed) == 1 {
        insert_num(
            headers,
            X_QUOTA_LIMIT_HOURLY,
            info.hourly_limit.load(Relaxed),
        );
        insert_num(
            headers,
            X_QUOTA_REMAINING_HOURLY,
            info.hourly_remaining.load(Relaxed),
        );
        insert_num(
            headers,
            X_QUOTA_RESET_HOURLY,
            info.hourly_reset.load(Relaxed),
        );
    }
    if info.daily_flag.load(Relaxed) == 1 {
        insert_num(headers, X_QUOTA_LIMIT_DAILY, info.daily_limit.load(Relaxed));
        insert_num(
            headers,
            X_QUOTA_REMAINING_DAILY,
            info.daily_remaining.load(Relaxed),
        );
        insert_num(headers, X_QUOTA_RESET_DAILY, info.daily_reset.load(Relaxed));
    }
    if info.monthly_flag.load(Relaxed) == 1 {
        insert_num(
            headers,
            X_QUOTA_LIMIT_MONTHLY,
            info.monthly_limit.load(Relaxed),
        );
        insert_num(
            headers,
            X_QUOTA_REMAINING_MONTHLY,
            info.monthly_remaining.load(Relaxed),
        );
        insert_num(
            headers,
            X_QUOTA_RESET_MONTHLY,
            info.monthly_reset.load(Relaxed),
        );
    }
}

pub async fn layer(mut req: Request, next: Next) -> Response {
    let rl: Arc<RateLimitHeaderInfo> = req
        .extensions()
        .get::<Arc<RateLimitHeaderInfo>>()
        .cloned()
        .unwrap_or_else(|| {
            let arc = Arc::new(RateLimitHeaderInfo::default());
            req.extensions_mut().insert(arc.clone());
            arc
        });
    let quota: Arc<QuotaHeaderInfo> = req
        .extensions()
        .get::<Arc<QuotaHeaderInfo>>()
        .cloned()
        .unwrap_or_else(|| {
            let arc = Arc::new(QuotaHeaderInfo::default());
            req.extensions_mut().insert(arc.clone());
            arc
        });

    let mut response = next.run(req).await;
    let headers = response.headers_mut();
    write_rate_limit_headers(headers, &rl);
    write_quota_headers(headers, &quota);
    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use axum::routing::get;
    use axum::{Extension, Router};
    use std::sync::atomic::Ordering;
    use tower::ServiceExt;

    /// Handler that pretends to be the auth extractor: writes into the
    /// per-request atomics. Receives the same Arc the middleware
    /// inserted because Axum's Extension extractor reads from the same
    /// extensions map.
    async fn populate_rl(Extension(rl): Extension<Arc<RateLimitHeaderInfo>>) -> StatusCode {
        rl.limit.store(60, Ordering::Relaxed);
        rl.remaining.store(42, Ordering::Relaxed);
        rl.reset.store(123_456, Ordering::Relaxed);
        StatusCode::OK
    }

    async fn populate_quota(Extension(q): Extension<Arc<QuotaHeaderInfo>>) -> StatusCode {
        q.hourly_flag.store(1, Ordering::Relaxed);
        q.hourly_limit.store(1000, Ordering::Relaxed);
        q.hourly_remaining.store(999, Ordering::Relaxed);
        q.hourly_reset.store(3600, Ordering::Relaxed);
        StatusCode::OK
    }

    async fn no_op() -> StatusCode {
        StatusCode::OK
    }

    fn app(handler: &str) -> Router {
        let r = Router::new();
        let r = match handler {
            "rl" => r.route("/test", get(populate_rl)),
            "quota" => r.route("/test", get(populate_quota)),
            "none" => r.route("/test", get(no_op)),
            _ => unreachable!(),
        };
        r.layer(axum::middleware::from_fn(layer))
    }

    #[tokio::test]
    async fn emits_rate_limit_headers_when_handler_populates_atomics() {
        let resp = app("rl")
            .oneshot(Request::builder().uri("/test").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(resp.headers().get("x-ratelimit-limit").unwrap(), "60");
        assert_eq!(resp.headers().get("x-ratelimit-remaining").unwrap(), "42");
        assert_eq!(resp.headers().get("x-ratelimit-reset").unwrap(), "123456");
    }

    #[tokio::test]
    async fn skips_rate_limit_headers_when_limit_is_zero() {
        let resp = app("none")
            .oneshot(Request::builder().uri("/test").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert!(resp.headers().get("x-ratelimit-limit").is_none());
    }

    #[tokio::test]
    async fn emits_hourly_quota_headers_when_flag_set() {
        let resp = app("quota")
            .oneshot(Request::builder().uri("/test").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(resp.headers().get("x-quota-limit-hourly").unwrap(), "1000");
        assert_eq!(
            resp.headers().get("x-quota-remaining-hourly").unwrap(),
            "999"
        );
        assert_eq!(resp.headers().get("x-quota-reset-hourly").unwrap(), "3600");
        // Daily/monthly flags weren't set — no headers emitted for them.
        assert!(resp.headers().get("x-quota-limit-daily").is_none());
        assert!(resp.headers().get("x-quota-limit-monthly").is_none());
    }
}
