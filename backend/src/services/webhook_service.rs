//! Webhook dispatch service
//!
//! Queue-based webhook delivery with retries and HMAC-SHA256 signing.
//! Events are persisted to the retry queue before delivery, ensuring
//! no events are lost on server restart.

use sha2::{Digest, Sha256};
use sqlx::{self, PgPool};
use uuid::Uuid;

use crate::models::webhook::{Webhook, WebhookDelivery, WebhookDispatchBuffer, WebhookRetryJob};
use crate::services::url_validation;

const DELIVERY_TIMEOUT_SECS: u64 = 10;

/// Dispatch webhooks for a content event.
///
/// Persists each matching webhook delivery to the retry queue before returning,
/// ensuring events survive server restarts. The retry worker handles actual
/// delivery within its poll interval.
pub(crate) async fn dispatch(
    pool: &PgPool,
    site_id: Uuid,
    event_type: &str,
    entity_id: Uuid,
    payload: &serde_json::Value,
) {
    let webhooks = match Webhook::find_active_for_site(pool, site_id).await {
        Ok(w) => w,
        Err(e) => {
            tracing::warn!("Webhook dispatch: failed to query webhooks: {e}");
            return;
        }
    };

    for webhook in webhooks {
        if !webhook.events.is_empty() && !webhook.events.iter().any(|e| e == event_type) {
            continue;
        }

        let envelope = serde_json::json!({
            "event": event_type,
            "entity_id": entity_id,
            "site_id": site_id,
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "data": payload,
        });

        if webhook.debounce_seconds > 0 {
            if let Err(e) = WebhookDispatchBuffer::upsert(
                pool,
                webhook.id,
                site_id,
                &envelope,
                webhook.debounce_seconds,
            )
            .await
            {
                tracing::warn!(
                    webhook_id = %webhook.id,
                    event = %event_type,
                    "Webhook dispatch: failed to buffer (debounce): {e}"
                );
            }
        } else if let Err(e) =
            WebhookRetryJob::enqueue_dispatch(pool, webhook.id, event_type, &envelope).await
        {
            tracing::warn!(
                webhook_id = %webhook.id,
                event = %event_type,
                "Webhook dispatch: failed to enqueue: {e}"
            );
        }
    }
}

/// Attempt delivery once. On failure, enqueue for background retry.
pub async fn deliver(
    pool: &PgPool,
    webhook: &Webhook,
    event_type: &str,
    payload: &serde_json::Value,
    encryption_key: &[u8; 32],
) {
    let (status_code, error_message, delivery_id) =
        attempt_delivery(pool, webhook, event_type, payload, 1, encryption_key).await;

    // If first attempt failed, enqueue for background retry
    if status_code.is_none() || !is_success(status_code) {
        let error = error_message.unwrap_or_else(|| "Non-2xx status".to_string());
        let _ =
            WebhookRetryJob::enqueue(pool, webhook.id, event_type, payload, delivery_id, &error)
                .await;
    }
}

/// Execute a single delivery attempt and log it.
/// Returns (status_code, error_message, delivery_id).
pub async fn attempt_delivery(
    pool: &PgPool,
    webhook: &Webhook,
    event_type: &str,
    payload: &serde_json::Value,
    attempt: i16,
    encryption_key: &[u8; 32],
) -> (Option<i16>, Option<String>, Option<Uuid>) {
    // Defense-in-depth: re-validate URL at delivery time in case DNS changed
    // since webhook creation or the webhook was created before SSRF checks
    // existed. Resolve once and pin the IP on the reqwest client below so a
    // DNS-rebinding attacker cannot flip the address between validation and
    // connection.
    let (host, pinned_addr) = match url_validation::validate_and_resolve_url(&webhook.url).await {
        Ok(pair) => pair,
        Err(e) => {
            tracing::warn!(
                webhook_id = %webhook.id,
                url = %webhook.url,
                "Webhook delivery blocked by SSRF validation: {e}"
            );
            let error = format!("SSRF validation failed: {e}");
            let delivery = WebhookDelivery::create(
                pool,
                webhook.id,
                event_type,
                payload,
                None,
                None,
                Some(&error),
                attempt,
            )
            .await
            .ok();
            let delivery_id = delivery.map(|d| d.id);
            return (None, Some(error), delivery_id);
        }
    };

    // Serialize the payload. A failure here previously defaulted to an empty
    // body, which was then signed, sent, and recorded as delivered — silent
    // corruption. Treat it as a delivery failure instead: record + return early.
    let body = match serde_json::to_string(payload) {
        Ok(b) => b,
        Err(e) => {
            tracing::error!(
                webhook_id = %webhook.id,
                event_type = %event_type,
                "Webhook delivery skipped — payload serialization failed: {e}"
            );
            let error = format!("Payload serialization failed: {e}");
            let delivery = WebhookDelivery::create(
                pool,
                webhook.id,
                event_type,
                payload,
                None,
                None,
                Some(&error),
                attempt,
            )
            .await
            .ok();
            let delivery_id = delivery.map(|d| d.id);
            return (None, Some(error), delivery_id);
        }
    };

    // Decrypt the webhook secret for HMAC signing.
    let plaintext_secret = match webhook.decrypt_secret(encryption_key) {
        Ok(s) => s,
        Err(e) => {
            tracing::warn!(
                webhook_id = %webhook.id,
                "Webhook delivery skipped — secret decryption failed: {e}"
            );
            let error = format!("Secret decryption failed: {e}");
            let delivery = WebhookDelivery::create(
                pool,
                webhook.id,
                event_type,
                payload,
                None,
                None,
                Some(&error),
                attempt,
            )
            .await
            .ok();
            let delivery_id = delivery.map(|d| d.id);
            return (None, Some(error), delivery_id);
        }
    };

    let signature = compute_hmac_sha256(&plaintext_secret, &body);

    // Pin DNS resolution to the validated public IP. Without this, reqwest
    // would run its own DNS lookup and could connect to a different address
    // than the one we checked — the classic TOCTOU path for DNS rebinding.
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(DELIVERY_TIMEOUT_SECS))
        .resolve(&host, pinned_addr)
        .build()
        .unwrap_or_default();

    let result = client
        .post(&webhook.url)
        .header("Content-Type", "application/json")
        .header("X-Webhook-Signature", &signature)
        .header("X-Webhook-Event", event_type)
        .body(body)
        .send()
        .await;

    match result {
        Ok(response) => {
            let status_code = response.status().as_u16() as i16;
            let response_body = response.text().await.ok();
            let delivery = WebhookDelivery::create(
                pool,
                webhook.id,
                event_type,
                payload,
                Some(status_code),
                response_body.as_deref(),
                None,
                attempt,
            )
            .await
            .ok();
            let delivery_id = delivery.map(|d| d.id);

            if is_success(Some(status_code)) {
                (Some(status_code), None, delivery_id)
            } else {
                (
                    Some(status_code),
                    Some(format!("HTTP {}", status_code)),
                    delivery_id,
                )
            }
        }
        Err(e) => {
            let error = e.to_string();
            let delivery = WebhookDelivery::create(
                pool,
                webhook.id,
                event_type,
                payload,
                None,
                None,
                Some(&error),
                attempt,
            )
            .await
            .ok();
            let delivery_id = delivery.map(|d| d.id);
            (None, Some(error), delivery_id)
        }
    }
}

pub fn is_success(status_code: Option<i16>) -> bool {
    status_code.is_some_and(|s| (200..300).contains(&(s as u16)))
}

/// Send a single test delivery to a webhook and return the delivery record.
pub async fn deliver_test(
    pool: &PgPool,
    webhook: &Webhook,
    encryption_key: &[u8; 32],
) -> Result<WebhookDelivery, Box<dyn std::error::Error + Send + Sync>> {
    let payload = serde_json::json!({
        "event": "webhook.test",
        "site_id": webhook.site_id,
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "data": { "test": true },
    });

    deliver(pool, webhook, "webhook.test", &payload, encryption_key).await;

    // Return the most recent delivery for this webhook
    let delivery = sqlx::query_as::<_, WebhookDelivery>(
        "SELECT * FROM webhook_deliveries WHERE webhook_id = $1 ORDER BY delivered_at DESC LIMIT 1",
    )
    .bind(webhook.id)
    .fetch_one(pool)
    .await?;

    Ok(delivery)
}

/// Deliver a batched payload from a debounce buffer.
///
/// Enqueues the batch as a retry job — actual delivery (with secret
/// decryption) happens in the retry worker, which holds the encryption key.
pub async fn deliver_batch(
    pool: &PgPool,
    webhook: &Webhook,
    events: &serde_json::Value,
    event_count: usize,
) {
    let batch_payload = serde_json::json!({
        "event": "batch",
        "events": events,
        "site_id": webhook.site_id,
        "batch_window_seconds": webhook.debounce_seconds,
        "event_count": event_count,
    });

    if let Err(e) =
        WebhookRetryJob::enqueue_dispatch(pool, webhook.id, "batch", &batch_payload).await
    {
        tracing::warn!(
            webhook_id = %webhook.id,
            "Batch delivery: failed to enqueue: {e}"
        );
    }
}

/// Compute HMAC-SHA256 hex digest using the standard HMAC algorithm.
/// HMAC(K, m) = H((K' ^ opad) || H((K' ^ ipad) || m))
pub fn compute_hmac_sha256(secret: &str, body: &str) -> String {
    const BLOCK_SIZE: usize = 64; // SHA-256 block size
    let key = secret.as_bytes();

    // If key is longer than block size, hash it first
    let key_prime = if key.len() > BLOCK_SIZE {
        let mut hasher = Sha256::new();
        hasher.update(key);
        hasher.finalize().to_vec()
    } else {
        key.to_vec()
    };

    // Pad key to block size
    let mut padded_key = [0u8; BLOCK_SIZE];
    padded_key[..key_prime.len()].copy_from_slice(&key_prime);

    // Inner and outer padded keys
    let mut ipad = [0x36u8; BLOCK_SIZE];
    let mut opad = [0x5cu8; BLOCK_SIZE];
    for i in 0..BLOCK_SIZE {
        ipad[i] ^= padded_key[i];
        opad[i] ^= padded_key[i];
    }

    // Inner hash: H(ipad || message)
    let mut inner = Sha256::new();
    inner.update(ipad);
    inner.update(body.as_bytes());
    let inner_hash = inner.finalize();

    // Outer hash: H(opad || inner_hash)
    let mut outer = Sha256::new();
    outer.update(opad);
    outer.update(inner_hash);
    let result = outer.finalize();

    // Convert to hex string
    result.iter().map(|b| format!("{:02x}", b)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::encryption;

    /// Tracer bullet: encrypt webhook secret → decrypt → HMAC must match plaintext HMAC.
    #[test]
    fn encrypted_secret_hmac_matches_plaintext_hmac() {
        let plaintext = "whsec_abc123def456ghi789jkl012mno345pq";
        let body = r#"{"event":"test","data":{}}"#;

        // HMAC with plaintext secret (current behavior)
        let expected_hmac = compute_hmac_sha256(plaintext, body);

        // Encrypt the secret using the dev key
        let key = encryption::resolve_key("").expect("dev key resolves");
        let (ciphertext, nonce) = encryption::encrypt(plaintext, &key).expect("encrypts");

        // Ciphertext must differ from plaintext (proving encryption happened)
        let ciphertext_str = String::from_utf8_lossy(&ciphertext).to_string();
        assert_ne!(
            ciphertext_str, plaintext,
            "encrypted secret must differ from plaintext"
        );

        // Decrypt and verify HMAC matches
        let decrypted = encryption::decrypt(&ciphertext, &nonce, &key).expect("decrypts");
        assert_eq!(decrypted, plaintext, "roundtrip preserves plaintext");
        let actual_hmac = compute_hmac_sha256(&decrypted, body);
        assert_eq!(
            actual_hmac, expected_hmac,
            "HMAC with decrypted secret matches plaintext HMAC"
        );
    }

    /// Wrong key must not decrypt successfully.
    #[test]
    fn encrypted_secret_wrong_key_fails() {
        let plaintext = "whsec_test_secret_value_12345";
        let key = encryption::resolve_key("").expect("dev key resolves");
        let (ciphertext, nonce) = encryption::encrypt(plaintext, &key).expect("encrypts");

        let wrong_key: [u8; 32] = [0xAB; 32];
        let result = encryption::decrypt(&ciphertext, &nonce, &wrong_key);
        assert!(result.is_err(), "decryption with wrong key must fail");
    }

    #[test]
    fn hmac_sha256_rfc4231_test_vector_2() {
        // RFC 4231 Test Case 2: key = "Jefe", data = "what do ya want for nothing?"
        let result = compute_hmac_sha256("Jefe", "what do ya want for nothing?");
        assert_eq!(
            result,
            "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"
        );
    }

    #[test]
    fn hmac_sha256_empty_body() {
        // Should produce a valid HMAC, not panic
        let result = compute_hmac_sha256("secret", "");
        assert_eq!(result.len(), 64); // 32 bytes hex-encoded
    }

    #[test]
    fn hmac_sha256_empty_secret() {
        let result = compute_hmac_sha256("", "hello");
        assert_eq!(result.len(), 64);
    }

    #[test]
    fn hmac_sha256_long_key_triggers_hash_first() {
        // Key longer than 64 bytes triggers the hash-key-first branch
        let long_key = "a".repeat(100);
        let result = compute_hmac_sha256(&long_key, "test");
        assert_eq!(result.len(), 64);
        // Different key should produce different HMAC
        let other = compute_hmac_sha256("short", "test");
        assert_ne!(result, other);
    }

    #[test]
    fn hmac_sha256_deterministic() {
        let a = compute_hmac_sha256("key", "data");
        let b = compute_hmac_sha256("key", "data");
        assert_eq!(a, b);
    }
}
