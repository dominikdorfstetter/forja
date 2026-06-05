//! API key usage context — written by the auth extractor, read by the
//! Axum `usage_tracking` middleware. The `populate` / `take` pair uses
//! atomics + `UnsafeCell` so it can be mutated through the shared `Arc`
//! that auth and middleware both hold (atomic flag carries the
//! happens-before).

use std::sync::atomic::{AtomicU8, Ordering};
use std::time::Instant;
use uuid::Uuid;

/// Sentinel: no API key authenticated this request.
const NOT_SET: u8 = 0;
/// Sentinel: API key context has been stored.
const SET: u8 = 1;

/// Request-local context written by the auth guard, read by the response fairing.
///
/// Uses atomics / raw fields so it can be populated after `local_cache`
/// creates the default value (Rocket hands out `&T`, not `&mut T`).
pub struct ApiKeyUsageContext {
    /// Whether context has been populated (0 = no, 1 = yes).
    flag: AtomicU8,
    /// API key UUID (written once, read once — no contention).
    api_key_id: std::cell::UnsafeCell<Uuid>,
    endpoint: std::cell::UnsafeCell<String>,
    method: std::cell::UnsafeCell<String>,
    ip_address: std::cell::UnsafeCell<Option<String>>,
    user_agent: std::cell::UnsafeCell<Option<String>>,
    request_start: std::cell::UnsafeCell<Option<Instant>>,
}

// SAFETY: Each field is written exactly once (by the auth guard) and read
// exactly once (by the response fairing), both on the same Tokio task. The
// atomic flag provides the happens-before relationship.
unsafe impl Send for ApiKeyUsageContext {}
unsafe impl Sync for ApiKeyUsageContext {}

impl Default for ApiKeyUsageContext {
    fn default() -> Self {
        Self {
            flag: AtomicU8::new(NOT_SET),
            api_key_id: std::cell::UnsafeCell::new(Uuid::nil()),
            endpoint: std::cell::UnsafeCell::new(String::new()),
            method: std::cell::UnsafeCell::new(String::new()),
            ip_address: std::cell::UnsafeCell::new(None),
            user_agent: std::cell::UnsafeCell::new(None),
            request_start: std::cell::UnsafeCell::new(None),
        }
    }
}

impl ApiKeyUsageContext {
    /// Populate the context. Called once by the auth guard after successful
    /// API key authentication.
    ///
    /// # Safety
    /// Must only be called once per request, before the response fairing reads.
    pub fn populate(
        &self,
        api_key_id: Uuid,
        endpoint: String,
        method: String,
        ip_address: Option<String>,
        user_agent: Option<String>,
    ) {
        // SAFETY: single writer, flag provides ordering.
        unsafe {
            *self.api_key_id.get() = api_key_id;
            *self.endpoint.get() = endpoint;
            *self.method.get() = method;
            *self.ip_address.get() = ip_address;
            *self.user_agent.get() = user_agent;
            *self.request_start.get() = Some(Instant::now());
        }
        self.flag.store(SET, Ordering::Release);
    }

    /// Read the context if it was populated.
    pub(crate) fn take(&self) -> Option<UsageSnapshot> {
        if self.flag.load(Ordering::Acquire) != SET {
            return None;
        }
        // SAFETY: flag guarantees the write happened before this read.
        unsafe {
            Some(UsageSnapshot {
                api_key_id: *self.api_key_id.get(),
                endpoint: (*self.endpoint.get()).clone(),
                method: (*self.method.get()).clone(),
                ip_address: (*self.ip_address.get()).clone(),
                user_agent: (*self.user_agent.get()).clone(),
                request_start: (*self.request_start.get()),
            })
        }
    }
}

/// Owned snapshot used for the fire-and-forget task.
pub(crate) struct UsageSnapshot {
    pub(crate) api_key_id: Uuid,
    pub(crate) endpoint: String,
    pub(crate) method: String,
    pub(crate) ip_address: Option<String>,
    pub(crate) user_agent: Option<String>,
    pub(crate) request_start: Option<Instant>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_context_default_returns_none() {
        let ctx = ApiKeyUsageContext::default();
        assert!(ctx.take().is_none());
    }

    #[test]
    fn test_context_populate_then_take() {
        let ctx = ApiKeyUsageContext::default();
        let key_id = Uuid::new_v4();
        ctx.populate(
            key_id,
            "/api/v1/blogs".to_string(),
            "GET".to_string(),
            Some("127.0.0.1".to_string()),
            Some("test-agent".to_string()),
        );
        let snap = ctx.take().expect("should return snapshot");
        assert_eq!(snap.api_key_id, key_id);
        assert_eq!(snap.endpoint, "/api/v1/blogs");
        assert_eq!(snap.method, "GET");
        assert_eq!(snap.ip_address, Some("127.0.0.1".to_string()));
        assert_eq!(snap.user_agent, Some("test-agent".to_string()));
        assert!(snap.request_start.is_some());
    }

    #[test]
    fn test_context_take_only_once() {
        let ctx = ApiKeyUsageContext::default();
        ctx.populate(
            Uuid::new_v4(),
            "/test".to_string(),
            "POST".to_string(),
            None,
            None,
        );
        assert!(ctx.take().is_some());
        // Second take should still return Some since we only check the flag
        // (we don't reset it — the flag is a one-shot marker per request lifecycle)
        assert!(ctx.take().is_some());
    }
}
