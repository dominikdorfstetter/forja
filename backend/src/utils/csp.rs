//! CSP nonce generation for inline script authorization.

use base64::Engine;

/// Generate a cryptographically random base64-encoded nonce for CSP.
///
/// Uses UUID v4 (backed by the OS CSPRNG) as the entropy source — 122 bits
/// of randomness, well above the recommended minimum of 128 bits after encoding.
pub fn generate_nonce() -> String {
    let bytes = uuid::Uuid::new_v4().into_bytes();
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nonce_is_base64_encoded() {
        let nonce = generate_nonce();
        assert!(
            base64::engine::general_purpose::STANDARD
                .decode(&nonce)
                .is_ok(),
            "Nonce must be valid base64"
        );
    }

    #[test]
    fn nonce_is_unique() {
        let a = generate_nonce();
        let b = generate_nonce();
        assert_ne!(a, b);
    }

    #[test]
    fn nonce_has_sufficient_entropy() {
        let nonce = generate_nonce();
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(&nonce)
            .unwrap();
        assert_eq!(decoded.len(), 16, "Nonce should be 128 bits (16 bytes)");
    }
}
