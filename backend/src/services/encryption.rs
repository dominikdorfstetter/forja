//! AES-256-GCM encryption for sensitive configuration values (e.g. AI API keys).

use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{AeadCore, Aes256Gcm};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;

use crate::errors::ApiError;

/// Hardcoded dev key (32 bytes, base64). ONLY used when AI_ENCRYPTION_KEY is unset in debug mode.
const DEV_ENCRYPTION_KEY: &str = "Zm9yamEtZGV2LWVuY3J5cHRpb24ta2V5LTMyYnl0ZXM=";

/// Resolve the 32-byte encryption key from config or dev fallback.
pub fn resolve_key(config_value: &str) -> Result<[u8; 32], ApiError> {
    let raw = if config_value.is_empty() {
        if cfg!(debug_assertions) {
            BASE64
                .decode(DEV_ENCRYPTION_KEY)
                .map_err(|e| ApiError::Internal(format!("Bad dev encryption key: {e}")))?
        } else {
            return Err(ApiError::Internal(
                "AI_ENCRYPTION_KEY must be set in production".into(),
            ));
        }
    } else {
        BASE64
            .decode(config_value)
            .map_err(|e| ApiError::Internal(format!("Invalid AI_ENCRYPTION_KEY base64: {e}")))?
    };

    raw.try_into()
        .map_err(|_| ApiError::Internal("AI_ENCRYPTION_KEY must be exactly 32 bytes".into()))
}

/// Encrypt a plaintext string. Returns (ciphertext, nonce).
pub fn encrypt(plaintext: &str, key: &[u8; 32]) -> Result<(Vec<u8>, Vec<u8>), ApiError> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| ApiError::Internal(format!("Cipher init failed: {e}")))?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|e| ApiError::Internal(format!("Encryption failed: {e}")))?;
    Ok((ciphertext, nonce.to_vec()))
}

/// Decrypt ciphertext back to a string.
pub fn decrypt(ciphertext: &[u8], nonce: &[u8], key: &[u8; 32]) -> Result<String, ApiError> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| ApiError::Internal(format!("Cipher init failed: {e}")))?;
    let nonce = aes_gcm::Nonce::from_slice(nonce);
    let plaintext = cipher.decrypt(nonce, ciphertext).map_err(|_| {
        ApiError::Internal(
            "API key decryption failed — key may be corrupted or encryption key changed".into(),
        )
    })?;
    String::from_utf8(plaintext)
        .map_err(|e| ApiError::Internal(format!("Decrypted text is not valid UTF-8: {e}")))
}

/// Mask an API key for display: "sk-abc...xyz"
pub fn mask_api_key(key: &str) -> String {
    if key.len() <= 8 {
        return "****".to_string();
    }
    let prefix = &key[..6];
    let suffix = &key[key.len() - 4..];
    format!("{prefix}...{suffix}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = resolve_key("").unwrap(); // uses dev key
        let plaintext = "sk-test-api-key-12345";
        let (ciphertext, nonce) = encrypt(plaintext, &key).unwrap();
        let decrypted = decrypt(&ciphertext, &nonce, &key).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_decrypt_wrong_key_fails() {
        let key1 = resolve_key("").unwrap();
        let key2 = [1u8; 32];
        let (ciphertext, nonce) = encrypt("secret", &key1).unwrap();
        let result = decrypt(&ciphertext, &nonce, &key2);
        assert!(result.is_err());
    }

    #[test]
    fn test_mask_api_key() {
        assert_eq!(mask_api_key("sk-1234567890abcdef"), "sk-123...cdef");
        assert_eq!(mask_api_key("short"), "****");
    }

    #[test]
    fn test_resolve_key_dev_fallback() {
        let key = resolve_key("");
        assert!(key.is_ok());
        assert_eq!(key.unwrap().len(), 32);
    }

    #[test]
    fn test_resolve_key_custom() {
        let custom = BASE64.encode([42u8; 32]);
        let key = resolve_key(&custom).unwrap();
        assert_eq!(key, [42u8; 32]);
    }
}
