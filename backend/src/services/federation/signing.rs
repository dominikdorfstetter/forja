//! HTTP Signature creation and verification for ActivityPub federation.
//!
//! Implements draft-cavage HTTP Signatures for signing outgoing requests
//! and verifying incoming ones.

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use rsa::pkcs8::DecodePrivateKey;
use rsa::RsaPrivateKey;
use sha2::{Digest, Sha256};

use crate::errors::ApiError;

/// Build the signature string per draft-cavage HTTP Signatures.
///
/// The signature string is constructed by joining header values in order,
/// each on its own line as `(header): value`.
pub fn build_signature_string(
    method: &str,
    path: &str,
    host: &str,
    date: &str,
    digest: Option<&str>,
) -> String {
    let request_target = format!("{} {}", method.to_lowercase(), path);
    let mut lines = vec![
        format!("(request-target): {}", request_target),
        format!("host: {}", host),
        format!("date: {}", date),
    ];
    if let Some(d) = digest {
        lines.push(format!("digest: {}", d));
    }
    lines.join("\n")
}

/// Compute a SHA-256 digest of the request body.
///
/// Returns the digest in the format `SHA-256=base64(hash)`.
pub fn compute_digest(body: &[u8]) -> String {
    let hash = Sha256::digest(body);
    format!("SHA-256={}", BASE64.encode(hash))
}

/// Sign a signature string using RSA-SHA256.
///
/// Takes DER-encoded private key bytes and returns the base64-encoded signature.
pub fn sign_request_rsa(
    private_key_der: &[u8],
    signature_string: &str,
) -> Result<String, ApiError> {
    use rsa::pkcs1v15::SigningKey;
    use rsa::signature::SignatureEncoding;
    use rsa::signature::Signer;

    let private_key = RsaPrivateKey::from_pkcs8_der(private_key_der)
        .map_err(|e| ApiError::internal(format!("Failed to parse RSA private key: {e}")))?;

    let signing_key = SigningKey::<Sha256>::new_unprefixed(private_key);
    let signature = signing_key.sign(signature_string.as_bytes());

    Ok(BASE64.encode(signature.to_bytes()))
}

/// Build the full HTTP Signature header value.
///
/// Format: `keyId="...",headers="...",signature="...",algorithm="rsa-sha256"`
pub fn build_signature_header(key_id: &str, headers_list: &str, signature_b64: &str) -> String {
    format!(
        r#"keyId="{}",headers="{}",signature="{}",algorithm="rsa-sha256""#,
        key_id, headers_list, signature_b64
    )
}

/// Verify that a Date header is within acceptable clock skew.
///
/// Parses an HTTP-date and checks it is within `max_skew_secs` of now.
pub fn verify_clock_skew(date_header: &str, max_skew_secs: i64) -> Result<(), ApiError> {
    let parsed = chrono::DateTime::parse_from_rfc2822(date_header)
        .map_err(|e| ApiError::bad_request(format!("Invalid Date header: {e}")))?;

    let now = chrono::Utc::now();
    let diff = (now - parsed.with_timezone(&chrono::Utc))
        .num_seconds()
        .abs();

    if diff > max_skew_secs {
        return Err(ApiError::unauthorized(format!(
            "Clock skew too large: {}s (max {}s)",
            diff, max_skew_secs
        )));
    }

    Ok(())
}

/// Extract the domain from a keyId URI.
///
/// E.g. `https://example.com/users/alice#main-key` -> `Some("example.com")`
pub fn extract_domain_from_key_id(key_id: &str) -> Option<String> {
    url::Url::parse(key_id)
        .ok()
        .and_then(|u| u.host_str().map(|h| h.to_string()))
}

/// Verify that the keyId domain matches the actor URI domain.
///
/// This prevents an attacker from signing with a key from a different domain.
pub fn verify_domain_match(key_id: &str, actor_uri: &str) -> Result<(), ApiError> {
    let key_domain = extract_domain_from_key_id(key_id).ok_or_else(|| {
        ApiError::bad_request(format!("Cannot extract domain from keyId: {key_id}"))
    })?;

    let actor_domain = url::Url::parse(actor_uri)
        .ok()
        .and_then(|u| u.host_str().map(|h| h.to_string()))
        .ok_or_else(|| {
            ApiError::bad_request(format!("Cannot extract domain from actor URI: {actor_uri}"))
        })?;

    if key_domain != actor_domain {
        return Err(ApiError::unauthorized(format!(
            "Domain mismatch: keyId domain '{}' != actor domain '{}'",
            key_domain, actor_domain
        )));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_signature_string() {
        let result = build_signature_string(
            "POST",
            "/inbox",
            "example.com",
            "Sun, 09 Mar 2025 12:00:00 GMT",
            Some("SHA-256=abc123"),
        );
        assert!(result.contains("(request-target): post /inbox"));
        assert!(result.contains("host: example.com"));
        assert!(result.contains("date: Sun, 09 Mar 2025 12:00:00 GMT"));
        assert!(result.contains("digest: SHA-256=abc123"));
    }

    #[test]
    fn test_build_signature_string_without_digest() {
        let result = build_signature_string(
            "GET",
            "/users/alice",
            "example.com",
            "Sun, 09 Mar 2025 12:00:00 GMT",
            None,
        );
        assert!(result.contains("(request-target): get /users/alice"));
        assert!(!result.contains("digest:"));
    }

    #[test]
    fn test_compute_digest() {
        let body = b"hello world";
        let digest = compute_digest(body);
        assert!(digest.starts_with("SHA-256="));
        // SHA-256 of "hello world" is known
        let expected_hash = sha2::Sha256::digest(b"hello world");
        let expected = format!("SHA-256={}", BASE64.encode(expected_hash));
        assert_eq!(digest, expected);
    }

    #[test]
    fn test_verify_clock_skew_rejects_old() {
        // A date far in the past
        let old_date = "Mon, 01 Jan 2024 00:00:00 +0000";
        let result = verify_clock_skew(old_date, 300);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.to_string().contains("Clock skew too large"), true);
    }

    #[test]
    fn test_verify_clock_skew_accepts_recent() {
        let now = chrono::Utc::now();
        let date_str = now.format("%a, %d %b %Y %H:%M:%S +0000").to_string();
        let result = verify_clock_skew(&date_str, 300);
        assert!(result.is_ok());
    }

    #[test]
    fn test_verify_clock_skew_rejects_invalid_date() {
        let result = verify_clock_skew("not-a-date", 300);
        assert!(result.is_err());
    }

    #[test]
    fn test_extract_domain_from_key_id() {
        let domain = extract_domain_from_key_id("https://example.com/users/alice#main-key");
        assert_eq!(domain, Some("example.com".to_string()));

        let domain2 = extract_domain_from_key_id("https://mastodon.social/users/bob#main-key");
        assert_eq!(domain2, Some("mastodon.social".to_string()));

        let none = extract_domain_from_key_id("not-a-url");
        assert_eq!(none, None);
    }

    #[test]
    fn test_domain_mismatch_detection() {
        let result = verify_domain_match(
            "https://evil.com/users/alice#main-key",
            "https://example.com/users/alice",
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Domain mismatch"));
    }

    #[test]
    fn test_domain_match_succeeds() {
        let result = verify_domain_match(
            "https://example.com/users/alice#main-key",
            "https://example.com/users/alice",
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_sign_and_build_header() {
        // Generate a keypair for signing
        let (private_key_der, _) =
            crate::services::federation::key_management::generate_rsa_keypair().unwrap();

        let sig_string = build_signature_string(
            "POST",
            "/inbox",
            "example.com",
            "Sun, 09 Mar 2025 12:00:00 GMT",
            Some("SHA-256=abc123"),
        );

        let signature = sign_request_rsa(&private_key_der, &sig_string).unwrap();
        assert!(!signature.is_empty());

        let header = build_signature_header(
            "https://example.com/users/alice#main-key",
            "(request-target) host date digest",
            &signature,
        );

        assert!(header.contains("keyId=\"https://example.com/users/alice#main-key\""));
        assert!(header.contains("algorithm=\"rsa-sha256\""));
        assert!(header.contains("headers=\"(request-target) host date digest\""));
        assert!(header.contains(&format!("signature=\"{}\"", signature)));
    }
}
