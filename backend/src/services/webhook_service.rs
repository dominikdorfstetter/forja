//! Webhook dispatch service
//!
//! Fire-and-forget webhook delivery with retries and HMAC-SHA256 signing.

use sha2::{Digest, Sha256};
use sqlx::{self, PgPool};
use uuid::Uuid;

use crate::models::webhook::{Webhook, WebhookDelivery};

/// Dispatch webhooks for a content event (fire-and-forget via tokio::spawn).
pub fn dispatch(
    pool: PgPool,
    site_id: Uuid,
    event_type: &str,
    entity_id: Uuid,
    payload: serde_json::Value,
) {
    let event_type = event_type.to_string();
    tokio::spawn(async move {
        if let Err(e) = dispatch_inner(&pool, site_id, &event_type, entity_id, &payload).await {
            tracing::warn!("Webhook dispatch failed: {e}");
        }
    });
}

async fn dispatch_inner(
    pool: &PgPool,
    site_id: Uuid,
    event_type: &str,
    entity_id: Uuid,
    data: &serde_json::Value,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let webhooks = Webhook::find_active_for_site(pool, site_id).await?;

    for webhook in webhooks {
        // If events list is non-empty, filter by subscription
        if !webhook.events.is_empty() && !webhook.events.iter().any(|e| e == event_type) {
            continue;
        }

        let payload = serde_json::json!({
            "event": event_type,
            "entity_id": entity_id,
            "site_id": site_id,
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "data": data,
        });

        deliver(pool, &webhook, event_type, &payload).await;
    }

    Ok(())
}

/// Attempt delivery with up to 3 retries and exponential backoff.
pub async fn deliver(
    pool: &PgPool,
    webhook: &Webhook,
    event_type: &str,
    payload: &serde_json::Value,
) {
    let body = serde_json::to_string(payload).unwrap_or_default();
    let signature = compute_hmac_sha256(&webhook.secret, &body);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default();

    for attempt in 1..=3i16 {
        let result = client
            .post(&webhook.url)
            .header("Content-Type", "application/json")
            .header("X-Webhook-Signature", &signature)
            .header("X-Webhook-Event", event_type)
            .body(body.clone())
            .send()
            .await;

        match result {
            Ok(response) => {
                let status_code = response.status().as_u16() as i16;
                let response_body = response.text().await.ok();
                let _ = WebhookDelivery::create(
                    pool,
                    webhook.id,
                    event_type,
                    payload,
                    Some(status_code),
                    response_body.as_deref(),
                    None,
                    attempt,
                )
                .await;

                if (200..300).contains(&(status_code as u16)) {
                    return; // Success — no retry
                }
            }
            Err(e) => {
                let _ = WebhookDelivery::create(
                    pool,
                    webhook.id,
                    event_type,
                    payload,
                    None,
                    None,
                    Some(&e.to_string()),
                    attempt,
                )
                .await;
            }
        }

        if attempt < 3 {
            let backoff = std::time::Duration::from_secs(1 << (attempt - 1)); // 1s, 2s
            tokio::time::sleep(backoff).await;
        }
    }
}

/// Send a single test delivery to a webhook and return the delivery record.
pub async fn deliver_test(
    pool: &PgPool,
    webhook: &Webhook,
) -> Result<WebhookDelivery, Box<dyn std::error::Error + Send + Sync>> {
    let payload = serde_json::json!({
        "event": "webhook.test",
        "site_id": webhook.site_id,
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "data": { "test": true },
    });

    deliver(pool, webhook, "webhook.test", &payload).await;

    // Return the most recent delivery for this webhook
    let delivery = sqlx::query_as::<_, WebhookDelivery>(
        "SELECT * FROM webhook_deliveries WHERE webhook_id = $1 ORDER BY delivered_at DESC LIMIT 1",
    )
    .bind(webhook.id)
    .fetch_one(pool)
    .await?;

    Ok(delivery)
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
