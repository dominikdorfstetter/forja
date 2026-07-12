//! Self-hosted ALTCHA proof-of-work verification (#769).
//!
//! Unlike `bot_protection_service` (which POSTs a token to a vendor's
//! siteverify URL), this verifies an ALTCHA solution **in-process, purely
//! cryptographically** — no outbound call, no third-party, GDPR-clean. The
//! server issues an HMAC-signed challenge; the visitor's browser brute-forces
//! the proof-of-work; the server re-derives the expected challenge from the
//! HMAC key and confirms the signature + expiry.
//!
//! Replay protection is *not* handled here — `altcha-lib-rs` validates HMAC +
//! expiry but does not track consumed challenges. The caller records the
//! returned `salt` via `models::site_bot_protection::ConsumedChallenge` to
//! enforce single use (#768b).

use altcha_lib_rs::{ChallengeOptions, Payload, create_json_challenge, verify_solution};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use chrono::{Duration, Utc};

use crate::errors::{ApiError, codes};

/// Build a fresh HMAC-signed challenge as the JSON the ALTCHA widget expects.
///
/// `max_number` caps the proof-of-work search space; `expiry_seconds` bounds
/// how long the issued challenge stays valid (embedded in the salt, checked
/// at verification). A fresh random salt per call means two calls never
/// return the same challenge.
pub fn create_challenge_json(
    hmac_key: &str,
    max_number: i64,
    expiry_seconds: i32,
) -> Result<String, ApiError> {
    let options = ChallengeOptions {
        // `None` → crate default (SHA-256), the algorithm the v3 widget uses.
        algorithm: None,
        max_number: Some(max_number.max(1) as u64),
        salt_length: None,
        hmac_key,
        // `None` salt + number → crate generates a fresh random salt and picks
        // the secret solution itself.
        salt: None,
        number: None,
        expires: Some(Utc::now() + Duration::seconds(expiry_seconds.max(1) as i64)),
        params: None,
    };
    create_json_challenge(options)
        .map_err(|e| ApiError::internal(format!("ALTCHA challenge generation failed: {e}")))
}

/// Generate a fresh 256-bit HMAC key as a 64-char hex string. Used when an
/// admin enables ALTCHA without supplying their own key, so enablement is
/// zero-config. Uses the OS CSPRNG.
pub fn generate_hmac_key() -> String {
    use rand::Rng;
    let mut bytes = [0u8; 32];
    rand::rng().fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Verify a solved ALTCHA payload against the site's HMAC key.
///
/// `payload_b64` is the value emitted by the `<altcha-widget>`: the solved
/// payload JSON, **base64-encoded** (the official altcha transport — the
/// reference server flow is `JSON.parse(atob(payload))`). We decode it before
/// parsing; the `altcha-lib-rs` crate verifies a `Payload` struct but does not
/// handle the base64 envelope itself.
///
/// Returns the challenge `salt` on success so the caller can record it for
/// single-use enforcement. Checks HMAC signature, challenge-hash match, and
/// expiry. Maps every failure to `FORM_BOT_PROTECTION_INVALID` (visitor-
/// fixable: re-solve a fresh challenge).
pub fn verify(payload_b64: &str, hmac_key: &str) -> Result<String, ApiError> {
    let malformed = || {
        ApiError::bad_request("Bot protection payload is malformed")
            .with_code(codes::FORM_BOT_PROTECTION_INVALID)
    };

    let payload_json = STANDARD
        .decode(payload_b64.trim())
        .ok()
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .ok_or_else(malformed)?;

    let mut value: serde_json::Value =
        serde_json::from_str(&payload_json).map_err(|_| malformed())?;
    // The v3 widget reports `took` as a fractional-millisecond float (e.g.
    // 43.6), but `altcha-lib-rs`'s `Payload` types it as `Option<u32>`, so a
    // direct parse fails. `took` is client-reported solve time — it is not part
    // of the signed challenge and plays no role in verification — so drop it.
    if let Some(obj) = value.as_object_mut() {
        obj.remove("took");
    }
    let payload: Payload = serde_json::from_value(value).map_err(|_| malformed())?;

    // `check_expire = true`: reject solutions whose embedded expiry has passed.
    verify_solution(&payload, hmac_key, true).map_err(|e| {
        ApiError::bad_request(format!("Bot protection check failed: {e}"))
            .with_code(codes::FORM_BOT_PROTECTION_INVALID)
    })?;

    Ok(payload.salt)
}

#[cfg(test)]
mod tests {
    use super::*;
    use altcha_lib_rs::{Challenge, solve_challenge};

    const KEY: &str = "test-hmac-key-32-bytes-long-000000";

    /// Solve a freshly-issued challenge the way the browser widget would, and
    /// return the solved payload as **base64-encoded JSON** — the exact wire
    /// format `<altcha-widget>` emits and `verify` consumes.
    fn solve(challenge_json: &str) -> String {
        let challenge: Challenge = serde_json::from_str(challenge_json).unwrap();
        let number = solve_challenge(
            &challenge.challenge,
            &challenge.salt,
            Some(challenge.algorithm),
            Some(challenge.maxnumber),
            0,
        )
        .expect("challenge should be solvable");
        // Emit the JSON exactly as the v3 `<altcha-widget>` does — note `took`
        // is a fractional-millisecond **float** (the widget's solve time), which
        // `altcha-lib-rs` types as `Option<u32>`. `verify` must tolerate it.
        let payload = serde_json::json!({
            "algorithm": challenge.algorithm,
            "challenge": challenge.challenge,
            "number": number,
            "salt": challenge.salt,
            "signature": challenge.signature,
            "took": 43.6,
        });
        STANDARD.encode(serde_json::to_string(&payload).unwrap())
    }

    /// Tracer (#769): issue → solve → verify, entirely in-process. No HTTP
    /// client is constructed anywhere on this path.
    #[test]
    fn tracer_create_solve_verify_roundtrip() {
        let challenge = create_challenge_json(KEY, 1000, 300).unwrap();
        let solved = solve(&challenge);
        let salt = verify(&solved, KEY).expect("valid solution accepted");
        assert!(
            !salt.is_empty(),
            "verify returns the salt for replay tracking"
        );
    }

    #[test]
    fn two_challenges_have_distinct_salts() {
        let a: Challenge =
            serde_json::from_str(&create_challenge_json(KEY, 1000, 300).unwrap()).unwrap();
        let b: Challenge =
            serde_json::from_str(&create_challenge_json(KEY, 1000, 300).unwrap()).unwrap();
        assert_ne!(a.salt, b.salt, "each challenge gets a fresh random salt");
    }

    #[test]
    fn wrong_key_is_rejected_as_invalid() {
        let challenge = create_challenge_json(KEY, 1000, 300).unwrap();
        let solved = solve(&challenge);
        let err = verify(&solved, "a-different-hmac-key").unwrap_err();
        assert_eq!(err.code(), codes::FORM_BOT_PROTECTION_INVALID);
    }

    #[test]
    fn real_v3_widget_payload_parses_past_the_envelope() {
        // A real base64 payload captured from the altcha v3 `<altcha-widget>`
        // in production. Its `took` is a **float** (55.5) — which altcha-lib-rs
        // types as `Option<u32>`, so a naive parse rejects it as "malformed"
        // (the production regression). With a non-matching key it must fail the
        // signature/expiry check instead — proving the real wire format
        // deserializes past the base64 + JSON envelope.
        const REAL: &str = "eyJhbGdvcml0aG0iOiJTSEEtMjU2IiwiY2hhbGxlbmdlIjoiMjJhNmE1MzExOWZkYTc4YzM2MDJjM2FmZTA1MGI5M2FkYjVkNTI1Y2ZkOWY0ZDNhMTExZTZiZWUwYjA3NTc2NSIsIm51bWJlciI6MjcwODMsInNhbHQiOiIwOWUyZDJmNzcxNWNiZjk1OTYyNGQzNzI/ZXhwaXJlcz0xNzc5NTE5ODc5JiIsInNpZ25hdHVyZSI6IjY2ZTJlMWFiYWE3OGRmZjc3ZThlY2ViY2ZmYjczZDJmMWUzNmJhNjEyYTZjYWU1ODYzYzJmZTliNDJjYjk3ODQiLCJ0b29rIjo1NS41fQ==";
        let err = verify(REAL, "non-matching-key").unwrap_err();
        assert!(
            !err.to_string().contains("malformed"),
            "real v3 payload must parse past the envelope, got: {err}"
        );
    }

    #[test]
    fn malformed_payload_is_rejected_as_invalid() {
        // Not valid base64 at all.
        let err = verify("not base64 @@@", KEY).unwrap_err();
        assert_eq!(err.code(), codes::FORM_BOT_PROTECTION_INVALID);

        // Valid base64 whose decoded bytes are not the expected JSON payload.
        let err = verify(&STANDARD.encode("not json at all"), KEY).unwrap_err();
        assert_eq!(err.code(), codes::FORM_BOT_PROTECTION_INVALID);
    }

    #[test]
    fn expired_challenge_is_rejected() {
        // Issue a challenge that is already expired (negative window clamps to
        // 1s, so wait it out deterministically would be flaky — instead build
        // one with a 1s window and verify the expiry path via a tampered ts is
        // covered by the crate; here we assert a far-past expiry rejects).
        let challenge = create_challenge_json(KEY, 1000, 1).unwrap();
        let solved = solve(&challenge);
        std::thread::sleep(std::time::Duration::from_millis(1100));
        let err = verify(&solved, KEY).unwrap_err();
        assert_eq!(err.code(), codes::FORM_BOT_PROTECTION_INVALID);
    }
}
