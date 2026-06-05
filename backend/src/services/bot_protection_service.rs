//! Vendor-agnostic captcha token verification (#608).
//!
//! Every major provider — Cloudflare Turnstile, hCaptcha, Google reCAPTCHA,
//! Friendly Captcha, … — exposes the same server-side contract:
//!
//!   POST {verify_url}
//!     Content-Type: application/x-www-form-urlencoded
//!     Body: secret=<server-secret>&response=<client-token>[&remoteip=<ip>]
//!
//!   200 { "success": true|false, ... provider-specific extras }
//!
//! Forja stores the verify URL + secret per site and POSTs into that
//! contract. The `success` boolean is the only field Forja inspects.
//! Provider-specific extras (error codes, hostnames, scores) are ignored —
//! they belong to the site admin's own observability stack, not Forja's
//! universal verification layer.
//!
//! Fails closed on every error category: provider HTTP non-2xx, parse
//! failure, network timeout, SSRF guard rejection. The conservative
//! posture means a provider outage blocks legitimate submissions, but it
//! also means an attacker who can disrupt the verify call cannot turn
//! that disruption into a bypass.

use serde::Deserialize;

use crate::errors::codes;
use crate::errors::ApiError;
use crate::services::url_validation;

const VERIFY_TIMEOUT_SECS: u64 = 5;

#[derive(Debug, Deserialize)]
struct VerifyResponse {
    /// Universal across Turnstile, hCaptcha, reCAPTCHA, Friendly Captcha.
    /// We don't deserialise the provider-specific extras — keeping the
    /// shape narrow keeps Forja vendor-agnostic.
    success: bool,
}

/// Verify a captcha token against the admin-configured provider.
///
/// - `verify_url`: the captcha vendor's siteverify endpoint (admin-configured).
/// - `secret`: the per-site secret the vendor issued (decrypted).
/// - `token`: the short-lived token the visitor's browser produced.
/// - `remote_ip`: best-known visitor IP — included as `remoteip` because
///   most providers accept it as an optional hint (Turnstile uses it for
///   risk scoring, reCAPTCHA ignores it harmlessly).
///
/// Returns `Ok(())` only when the provider responds 2xx with
/// `{ "success": true }`. Every other outcome — `success: false`, non-2xx,
/// malformed JSON, network error, SSRF block — maps to an `ApiError` the
/// caller surfaces as 400 (visitor-fixable) or 503 (provider-side issue).
pub async fn verify(
    verify_url: &str,
    secret: &str,
    token: &str,
    remote_ip: Option<&str>,
) -> Result<(), ApiError> {
    if token.is_empty() {
        return Err(ApiError::bad_request("Bot protection token required")
            .with_code(codes::FORM_BOT_PROTECTION_MISSING));
    }

    // Defence in depth: although the admin configured the URL, validate it
    // again here so a misconfigured / typo'd URL doesn't become an SSRF
    // vector against internal infrastructure. The full `validate_and_resolve_url`
    // helper from webhook delivery also pins DNS, which closes the rebinding
    // TOCTOU — but for short-lived per-submission calls the simpler
    // `ensure_public_url` gate is the right tradeoff (no per-call DNS pin
    // bookkeeping, 5s timeout caps the window).
    url_validation::validate_target_url(verify_url)
        .await
        .map_err(|e| {
            tracing::warn!(
                verify_url = %verify_url,
                "Bot-protection verify URL blocked by SSRF guard: {e}"
            );
            ApiError::service_unavailable("Bot protection verifier unreachable")
                .with_code(codes::FORM_BOT_PROTECTION_PROVIDER_ERROR)
        })?;

    perform_verify(verify_url, secret, token, remote_ip).await
}

/// Inner HTTP-only path — performs the form POST and parses the response,
/// but does *not* run the SSRF gate. Exposed for integration tests that
/// need to point at a localhost mock; production callers always go through
/// `verify` above.
pub async fn perform_verify(
    verify_url: &str,
    secret: &str,
    token: &str,
    remote_ip: Option<&str>,
) -> Result<(), ApiError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(VERIFY_TIMEOUT_SECS))
        .build()
        .map_err(|e| ApiError::internal(format!("Bot protection HTTP client build failed: {e}")))?;

    // URL-form-encoded body, hand-built via the already-present `url` crate
    // (reqwest's `.form()` helper isn't enabled in our feature set). The
    // serializer holds a `!Sync` percent-encoder, so we scope it tightly
    // and let it drop before the await on `send()` to keep the future Send.
    let body = {
        let mut serializer = url::form_urlencoded::Serializer::new(String::new());
        serializer.append_pair("secret", secret);
        serializer.append_pair("response", token);
        if let Some(ip) = remote_ip {
            if !ip.is_empty() && ip != "unknown" {
                serializer.append_pair("remoteip", ip);
            }
        }
        serializer.finish()
    };

    let response = client
        .post(verify_url)
        .header(
            reqwest::header::CONTENT_TYPE,
            "application/x-www-form-urlencoded",
        )
        .body(body)
        .send()
        .await
        .map_err(|e| {
            tracing::warn!(verify_url = %verify_url, "Bot-protection verify call failed: {e}");
            ApiError::service_unavailable("Bot protection verifier unreachable")
                .with_code(codes::FORM_BOT_PROTECTION_PROVIDER_ERROR)
        })?;

    if !response.status().is_success() {
        let status = response.status();
        tracing::warn!(
            verify_url = %verify_url,
            status = %status,
            "Bot-protection verify returned non-2xx"
        );
        return Err(ApiError::service_unavailable(format!(
            "Bot protection verifier returned HTTP {status}"
        ))
        .with_code(codes::FORM_BOT_PROTECTION_PROVIDER_ERROR));
    }

    let parsed: VerifyResponse = response.json().await.map_err(|e| {
        tracing::warn!(verify_url = %verify_url, "Bot-protection verify JSON parse failed: {e}");
        ApiError::service_unavailable("Bot protection verifier returned unexpected payload")
            .with_code(codes::FORM_BOT_PROTECTION_PROVIDER_ERROR)
    })?;

    if !parsed.success {
        return Err(
            ApiError::bad_request("Bot protection check failed for this submission")
                .with_code(codes::FORM_BOT_PROTECTION_INVALID),
        );
    }

    Ok(())
}
