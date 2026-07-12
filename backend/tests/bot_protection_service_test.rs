//! Vendor-agnostic captcha verification service (#608).
//!
//! Tests `bot_protection_service::{verify, perform_verify}` against a
//! lightweight local axum mock that stands in for a captcha provider's
//! siteverify endpoint. The mock is reused across cases to exercise the
//! four response shapes Forja must handle:
//!
//!   - 200 { "success": true }    → Ok
//!   - 200 { "success": false }   → FORM_BOT_PROTECTION_INVALID (400)
//!   - 5xx                         → FORM_BOT_PROTECTION_PROVIDER_ERROR (503)
//!   - 200 with garbage JSON       → FORM_BOT_PROTECTION_PROVIDER_ERROR (503)
//!
//! `verify` adds an SSRF gate on top of `perform_verify`; we test that
//! gate by pointing at a localhost URL (always blocked) and asserting the
//! same 503 + provider-error code.

use axum::Router;
use axum::extract::Form;
use axum::routing::post;
use forja::services::bot_protection_service::{perform_verify, verify};
use serde::Deserialize;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Deserialize)]
struct CaptchaForm {
    secret: String,
    response: String,
    #[serde(default)]
    remoteip: Option<String>,
}

/// Records the most recent submission the mock received, so individual
/// tests can assert Forja sent the expected body shape.
type CallLog = Arc<Mutex<Option<CaptchaForm>>>;

/// Spawn a one-shot captcha mock on a random localhost port. The handler
/// inspects the request path to decide which canned response to return,
/// which lets a single mock back several tests without per-test setup.
async fn spawn_mock() -> (String, CallLog) {
    let log: CallLog = Arc::new(Mutex::new(None));
    let log_for_router = log.clone();

    let app = Router::new()
        // 200 { success: true } when secret == "good-secret"; 200 { success: false } otherwise.
        .route(
            "/verify",
            post(move |Form(body): Form<CaptchaForm>| {
                let log = log_for_router.clone();
                async move {
                    let success = body.secret == "good-secret";
                    *log.lock().await = Some(body);
                    axum::Json(serde_json::json!({ "success": success }))
                }
            }),
        )
        .route(
            "/server-error",
            post(|| async {
                (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    "boom".to_string(),
                )
            }),
        )
        .route(
            "/garbage",
            post(|| async {
                (
                    axum::http::StatusCode::OK,
                    [(axum::http::header::CONTENT_TYPE, "application/json")],
                    "not-json".to_string(),
                )
            }),
        );

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind mock");
    let addr = listener.local_addr().expect("local_addr");
    tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });
    (format!("http://{addr}"), log)
}

#[tokio::test]
async fn perform_verify_accepts_success_true() {
    let (base, log) = spawn_mock().await;
    perform_verify(
        &format!("{base}/verify"),
        "good-secret",
        "client-token-123",
        Some("203.0.113.7"),
    )
    .await
    .expect("verify ok on success:true");

    let recorded = log.lock().await.clone().expect("mock received call");
    assert_eq!(recorded.secret, "good-secret");
    assert_eq!(recorded.response, "client-token-123");
    assert_eq!(recorded.remoteip.as_deref(), Some("203.0.113.7"));
}

#[tokio::test]
async fn perform_verify_rejects_success_false() {
    let (base, _log) = spawn_mock().await;
    let err = perform_verify(
        &format!("{base}/verify"),
        "wrong-secret",
        "client-token",
        None,
    )
    .await
    .expect_err("expected rejection");
    assert_eq!(err.status().as_u16(), 400, "{err:?}");
}

#[tokio::test]
async fn perform_verify_returns_provider_error_on_5xx() {
    let (base, _log) = spawn_mock().await;
    let err = perform_verify(&format!("{base}/server-error"), "any", "token", None)
        .await
        .expect_err("expected provider error");
    assert_eq!(err.status().as_u16(), 503, "{err:?}");
}

#[tokio::test]
async fn perform_verify_returns_provider_error_on_garbage_json() {
    let (base, _log) = spawn_mock().await;
    let err = perform_verify(&format!("{base}/garbage"), "any", "token", None)
        .await
        .expect_err("expected provider error");
    assert_eq!(err.status().as_u16(), 503, "{err:?}");
}

#[tokio::test]
async fn perform_verify_returns_provider_error_when_unreachable() {
    // Random unused port — connection should fail fast within the 5s timeout.
    let err = perform_verify("http://127.0.0.1:1/verify", "secret", "token", None)
        .await
        .expect_err("expected provider error");
    assert_eq!(err.status().as_u16(), 503, "{err:?}");
}

#[tokio::test]
async fn perform_verify_omits_remoteip_when_unknown() {
    let (base, log) = spawn_mock().await;
    perform_verify(
        &format!("{base}/verify"),
        "good-secret",
        "tok",
        Some("unknown"),
    )
    .await
    .expect("ok");
    let recorded = log.lock().await.clone().expect("mock received call");
    assert!(
        recorded.remoteip.is_none(),
        "expected remoteip omitted for 'unknown' hint, got: {:?}",
        recorded.remoteip
    );
}

/// Empty tokens never reach the provider — handled up front by `verify`.
#[tokio::test]
async fn verify_rejects_empty_token_without_calling_provider() {
    // Pointing at a definitely-public URL so the SSRF gate would pass —
    // but we never get there because the empty-token check fires first.
    let err = verify(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        "secret",
        "",
        None,
    )
    .await
    .expect_err("expected rejection");
    assert_eq!(err.status().as_u16(), 400, "{err:?}");
}

/// SSRF gate: localhost is blocked, even when the provider would be reachable.
#[tokio::test]
async fn verify_blocks_localhost_via_ssrf_guard() {
    let (base, _log) = spawn_mock().await;
    let err = verify(&format!("{base}/verify"), "good-secret", "tok", None)
        .await
        .expect_err("SSRF gate must reject localhost");
    assert_eq!(err.status().as_u16(), 503, "{err:?}");
}

/// Map a real-world Turnstile-shaped response (with extra keys) to ensure
/// Forja only depends on `success` and ignores provider-specific extras.
#[tokio::test]
async fn perform_verify_ignores_extra_response_keys() {
    let app = Router::new().route(
        "/verify",
        post(|| async {
            axum::Json(serde_json::json!({
                "success": true,
                "challenge_ts": "2026-05-12T10:00:00Z",
                "hostname": "example.com",
                "action": "submit",
                "cdata": "extra",
            }))
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind");
    let addr = listener.local_addr().expect("addr");
    tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });
    perform_verify(&format!("http://{addr}/verify"), "any", "tok", None)
        .await
        .expect("provider extras must not break parsing");
}
