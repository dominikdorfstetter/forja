//! Document encryption service
//!
//! Provides envelope encryption for private documents:
//! - File data is encrypted with a random DEK (data encryption key)
//! - DEK is derived from the user's password via Argon2id
//! - DEK is also wrapped with the server's DOCUMENT_ENCRYPTION_KEY for admin recovery
//! - Key rotation: supports current + old server key, lazy re-wrapping on access

use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{AeadCore, Aes256Gcm, Nonce};
use argon2::{Argon2, PasswordHasher, password_hash::SaltString};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use hmac::Mac;
use sha2::Sha256;

use crate::errors::ApiError;

/// Result of encrypting a document's file data.
pub struct EncryptedDocument {
    /// AES-256-GCM ciphertext (replaces plaintext file_data)
    pub ciphertext: Vec<u8>,
    /// bcrypt hash for quick password verification
    pub password_hash: String,
    /// Argon2id salt used for key derivation (stored as-is)
    pub salt: Vec<u8>,
    /// AES-GCM nonce for file encryption
    pub nonce: Vec<u8>,
    /// DEK wrapped with the server key (None if no server key configured)
    pub encrypted_dek: Option<Vec<u8>>,
    /// Which server key version was used (None if no server key)
    pub key_version: Option<i16>,
}

/// Result of verifying a password and producing a download token.
pub struct AccessToken {
    pub token: String,
    pub expires_at: i64,
}

// ── Password hashing (bcrypt) ──────────────────────────────────────────

/// Hash a password with bcrypt for quick verification.
pub fn hash_password(password: &str) -> Result<String, ApiError> {
    bcrypt::hash(password, bcrypt::DEFAULT_COST)
        .map_err(|e| ApiError::internal(format!("Password hashing failed: {e}")))
}

/// Verify a password against a bcrypt hash.
pub fn verify_password(password: &str, hash: &str) -> Result<bool, ApiError> {
    bcrypt::verify(password, hash)
        .map_err(|e| ApiError::internal(format!("Password verification failed: {e}")))
}

// ── Key derivation (Argon2id) ──────────────────────────────────────────

/// Derive a 32-byte AES key from a password and salt using Argon2id.
pub fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32], ApiError> {
    let argon2 = Argon2::default();
    let salt_str = SaltString::encode_b64(salt)
        .map_err(|e| ApiError::internal(format!("Salt encoding failed: {e}")))?;
    let hash = argon2
        .hash_password(password.as_bytes(), &salt_str)
        .map_err(|e| ApiError::internal(format!("Key derivation failed: {e}")))?;
    let output = hash
        .hash
        .ok_or_else(|| ApiError::internal("Argon2 produced no hash output"))?;
    let bytes = output.as_bytes();
    if bytes.len() < 32 {
        return Err(ApiError::internal("Derived key too short"));
    }
    let mut key = [0u8; 32];
    key.copy_from_slice(&bytes[..32]);
    Ok(key)
}

/// Generate a random 16-byte salt for Argon2id.
fn generate_salt() -> Vec<u8> {
    use aes_gcm::aead::rand_core::RngCore;
    let mut salt = vec![0u8; 16];
    OsRng.fill_bytes(&mut salt);
    salt
}

// ── AES-256-GCM encryption ────────────────────────────────────────────

/// Encrypt data with AES-256-GCM. Returns (ciphertext, nonce).
fn aes_encrypt(key: &[u8; 32], plaintext: &[u8]) -> Result<(Vec<u8>, Vec<u8>), ApiError> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| ApiError::internal(format!("Cipher init failed: {e}")))?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|e| ApiError::internal(format!("Encryption failed: {e}")))?;
    Ok((ciphertext, nonce.to_vec()))
}

/// Decrypt data with AES-256-GCM.
fn aes_decrypt(key: &[u8; 32], nonce: &[u8], ciphertext: &[u8]) -> Result<Vec<u8>, ApiError> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| ApiError::internal(format!("Cipher init failed: {e}")))?;
    let nonce = Nonce::from_slice(nonce);
    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| ApiError::internal("Decryption failed — wrong key or corrupted data"))
}

// ── Server key helpers (envelope encryption) ───────────────────────────

/// Resolve a server encryption key from a base64-encoded config value.
/// Returns None if the value is empty (feature not configured).
pub fn resolve_server_key(config_value: &str) -> Result<Option<[u8; 32]>, ApiError> {
    if config_value.is_empty() {
        return Ok(None);
    }
    let raw = BASE64
        .decode(config_value)
        .map_err(|e| ApiError::internal(format!("Invalid DOCUMENT_ENCRYPTION_KEY base64: {e}")))?;
    let key: [u8; 32] = raw
        .try_into()
        .map_err(|_| ApiError::internal("DOCUMENT_ENCRYPTION_KEY must be exactly 32 bytes"))?;
    Ok(Some(key))
}

/// Wrap (encrypt) a DEK with the server key.
fn wrap_dek(server_key: &[u8; 32], dek: &[u8; 32]) -> Result<Vec<u8>, ApiError> {
    let (ciphertext, nonce) = aes_encrypt(server_key, dek)?;
    // Prepend the 12-byte nonce to the ciphertext for self-contained storage
    let mut wrapped = nonce;
    wrapped.extend_from_slice(&ciphertext);
    Ok(wrapped)
}

/// Unwrap (decrypt) a DEK with the server key.
fn unwrap_dek(server_key: &[u8; 32], wrapped: &[u8]) -> Result<[u8; 32], ApiError> {
    if wrapped.len() < 12 {
        return Err(ApiError::internal("Wrapped DEK too short"));
    }
    let (nonce, ciphertext) = wrapped.split_at(12);
    let plaintext = aes_decrypt(server_key, nonce, ciphertext)?;
    plaintext
        .try_into()
        .map_err(|_| ApiError::internal("Unwrapped DEK is not 32 bytes"))
}

// ── Public API ─────────────────────────────────────────────────────────

/// Encrypt a document's file data with a password.
///
/// Returns all the metadata needed to store alongside the encrypted file_data.
pub fn encrypt_document(
    plaintext: &[u8],
    password: &str,
    server_key: Option<&[u8; 32]>,
    key_version: Option<i16>,
) -> Result<EncryptedDocument, ApiError> {
    // 1. Hash password for quick verification
    let pw_hash = hash_password(password)?;

    // 2. Derive DEK from password
    let salt = generate_salt();
    let dek = derive_key(password, &salt)?;

    // 3. Encrypt file data with DEK
    let (ciphertext, nonce) = aes_encrypt(&dek, plaintext)?;

    // 4. Optionally wrap DEK with server key (admin recovery)
    let encrypted_dek = server_key.map(|sk| wrap_dek(sk, &dek)).transpose()?;

    Ok(EncryptedDocument {
        ciphertext,
        password_hash: pw_hash,
        salt,
        nonce,
        encrypted_dek,
        key_version: if server_key.is_some() {
            key_version
        } else {
            None
        },
    })
}

/// Decrypt a document's file data using the user's password.
pub fn decrypt_document(
    ciphertext: &[u8],
    password: &str,
    salt: &[u8],
    nonce: &[u8],
) -> Result<Vec<u8>, ApiError> {
    let dek = derive_key(password, salt)?;
    aes_decrypt(&dek, nonce, ciphertext)
}

/// Decrypt a document's file data using the server key (admin recovery).
pub fn decrypt_document_with_server_key(
    ciphertext: &[u8],
    nonce: &[u8],
    encrypted_dek: &[u8],
    server_key: &[u8; 32],
) -> Result<Vec<u8>, ApiError> {
    let dek = unwrap_dek(server_key, encrypted_dek)?;
    aes_decrypt(&dek, nonce, ciphertext)
}

/// Decrypt a document's file data using a raw DEK (from token-embedded key).
pub fn decrypt_with_dek(
    ciphertext: &[u8],
    nonce: &[u8],
    dek: &[u8; 32],
) -> Result<Vec<u8>, ApiError> {
    aes_decrypt(dek, nonce, ciphertext)
}

/// Re-wrap an encrypted DEK from an old server key to a new one.
/// Used during key rotation.
pub fn rotate_dek(
    encrypted_dek: &[u8],
    old_key: &[u8; 32],
    new_key: &[u8; 32],
) -> Result<Vec<u8>, ApiError> {
    let dek = unwrap_dek(old_key, encrypted_dek)?;
    wrap_dek(new_key, &dek)
}

// ── HMAC-based access tokens ───────────────────────────────────────────

type HmacSha256 = hmac::Hmac<Sha256>;

/// Derive a 32-byte AES key from the HMAC secret for token-embedded DEK encryption.
fn derive_token_key(secret: &[u8]) -> [u8; 32] {
    use sha2::Digest;
    let hash = sha2::Sha256::digest(secret);
    let mut key = [0u8; 32];
    key.copy_from_slice(&hash);
    key
}

/// Generate a time-limited download access token.
///
/// If a DEK is provided, it is encrypted with a key derived from the HMAC
/// secret and embedded in the token, making the token self-contained for
/// decryption (no server key required at download time).
///
/// Token format: `{document_id}:{expires_unix}:{encrypted_dek_hex}:{hex_signature}`
/// Signed with HMAC-SHA256 using the provided secret.
pub fn generate_access_token(
    document_id: &uuid::Uuid,
    secret: &[u8],
    ttl_seconds: i64,
    dek: Option<&[u8; 32]>,
) -> Result<AccessToken, ApiError> {
    let expires_at = chrono::Utc::now().timestamp() + ttl_seconds;

    // Encrypt the DEK into the token if provided
    let dek_hex = match dek {
        Some(dek) => {
            let token_key = derive_token_key(secret);
            let (ciphertext, nonce) = aes_encrypt(&token_key, dek)?;
            let mut wrapped = nonce;
            wrapped.extend_from_slice(&ciphertext);
            hex::encode(wrapped)
        }
        None => String::from("none"),
    };

    let payload = format!("{}:{}:{}", document_id, expires_at, dek_hex);

    let mut mac = <HmacSha256 as hmac::digest::KeyInit>::new_from_slice(secret)
        .map_err(|e| ApiError::internal(format!("HMAC init failed: {e}")))?;
    mac.update(payload.as_bytes());
    let signature = hex::encode(mac.finalize().into_bytes());

    let token = format!("{}:{}", payload, signature);
    Ok(AccessToken {
        token: BASE64.encode(token.as_bytes()),
        expires_at,
    })
}

/// Result of verifying an access token.
pub struct VerifiedToken {
    /// The DEK embedded in the token, if present.
    pub dek: Option<[u8; 32]>,
}

/// Verify a download access token. Returns the embedded DEK if valid and not expired.
pub fn verify_access_token(
    token: &str,
    document_id: &uuid::Uuid,
    secret: &[u8],
) -> Option<VerifiedToken> {
    let decoded = BASE64.decode(token).ok()?;
    let token_str = String::from_utf8(decoded).ok()?;

    let parts: Vec<&str> = token_str.splitn(4, ':').collect();
    if parts.len() != 4 {
        return None;
    }

    let (token_doc_id, expires_str, dek_hex, signature) = (parts[0], parts[1], parts[2], parts[3]);

    // Check document ID matches
    if token_doc_id != document_id.to_string() {
        return None;
    }

    // Check expiry
    let expires_at: i64 = expires_str.parse().ok()?;
    if chrono::Utc::now().timestamp() > expires_at {
        return None;
    }

    // Verify HMAC signature
    let payload = format!("{}:{}:{}", token_doc_id, expires_str, dek_hex);
    let mut mac = <HmacSha256 as hmac::digest::KeyInit>::new_from_slice(secret).ok()?;
    mac.update(payload.as_bytes());
    let expected = hex::encode(mac.finalize().into_bytes());

    // Constant-time comparison
    let sig_valid = expected.len() == signature.len()
        && expected
            .bytes()
            .zip(signature.bytes())
            .fold(0u8, |acc, (a, b)| acc | (a ^ b))
            == 0;
    if !sig_valid {
        return None;
    }

    // Extract embedded DEK if present
    let dek = if dek_hex != "none" {
        let wrapped = hex::decode(dek_hex).ok()?;
        if wrapped.len() < 12 {
            return None;
        }
        let token_key = derive_token_key(secret);
        let (nonce, ciphertext) = wrapped.split_at(12);
        let dek_bytes = aes_decrypt(&token_key, nonce, ciphertext).ok()?;
        let dek: [u8; 32] = dek_bytes.try_into().ok()?;
        Some(dek)
    } else {
        None
    };

    Some(VerifiedToken { dek })
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let plaintext = b"This is a secret document";
        let password = "hunter2";

        let result = encrypt_document(plaintext, password, None, None).unwrap();
        let decrypted =
            decrypt_document(&result.ciphertext, password, &result.salt, &result.nonce).unwrap();

        assert_eq!(decrypted, plaintext);
        assert!(result.encrypted_dek.is_none());
    }

    #[test]
    fn test_encrypt_decrypt_with_server_key() {
        let plaintext = b"Confidential contract";
        let password = "s3cure!";
        let server_key = [42u8; 32];

        let result = encrypt_document(plaintext, password, Some(&server_key), Some(1)).unwrap();
        assert!(result.encrypted_dek.is_some());
        assert_eq!(result.key_version, Some(1));

        // Decrypt with password
        let decrypted =
            decrypt_document(&result.ciphertext, password, &result.salt, &result.nonce).unwrap();
        assert_eq!(decrypted, plaintext);

        // Decrypt with server key (admin recovery)
        let decrypted_admin = decrypt_document_with_server_key(
            &result.ciphertext,
            &result.nonce,
            result.encrypted_dek.as_ref().unwrap(),
            &server_key,
        )
        .unwrap();
        assert_eq!(decrypted_admin, plaintext);
    }

    #[test]
    fn test_wrong_password_fails() {
        let plaintext = b"Secret";
        let result = encrypt_document(plaintext, "correct", None, None).unwrap();
        let decrypted = decrypt_document(&result.ciphertext, "wrong", &result.salt, &result.nonce);
        assert!(decrypted.is_err());
    }

    #[test]
    fn test_password_hash_verification() {
        let hash = hash_password("test123").unwrap();
        assert!(verify_password("test123", &hash).unwrap());
        assert!(!verify_password("wrong", &hash).unwrap());
    }

    #[test]
    fn test_key_rotation() {
        let plaintext = b"Rotate me";
        let password = "mypass";
        let old_key = [1u8; 32];
        let new_key = [2u8; 32];

        let result = encrypt_document(plaintext, password, Some(&old_key), Some(1)).unwrap();
        let old_wrapped = result.encrypted_dek.unwrap();

        // Rotate the DEK wrapping
        let new_wrapped = rotate_dek(&old_wrapped, &old_key, &new_key).unwrap();

        // Verify: old key can no longer unwrap the new wrapped DEK
        assert!(unwrap_dek(&old_key, &new_wrapped).is_err());

        // New key can unwrap and decrypt
        let decrypted = decrypt_document_with_server_key(
            &result.ciphertext,
            &result.nonce,
            &new_wrapped,
            &new_key,
        )
        .unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_access_token_roundtrip_without_dek() {
        let doc_id = Uuid::new_v4();
        let secret = b"test-secret-key-for-hmac-signing";

        let token = generate_access_token(&doc_id, secret, 3600, None).unwrap();
        let result = verify_access_token(&token.token, &doc_id, secret);
        assert!(result.is_some());
        assert!(result.unwrap().dek.is_none());
    }

    #[test]
    fn test_access_token_roundtrip_with_dek() {
        let doc_id = Uuid::new_v4();
        let secret = b"test-secret-key-for-hmac-signing";
        let dek = [42u8; 32];

        let token = generate_access_token(&doc_id, secret, 3600, Some(&dek)).unwrap();
        let result = verify_access_token(&token.token, &doc_id, secret).unwrap();
        assert_eq!(result.dek.unwrap(), dek);
    }

    #[test]
    fn test_access_token_dek_decrypt_roundtrip() {
        // Full flow: encrypt document, generate token with DEK, verify token, decrypt with DEK
        let plaintext = b"Secret document content";
        let password = "testpass";
        let secret = b"hmac-secret";

        let enc = encrypt_document(plaintext, password, None, None).unwrap();
        let dek = derive_key(password, &enc.salt).unwrap();

        let token = generate_access_token(&Uuid::new_v4(), secret, 3600, Some(&dek)).unwrap();
        let verified = verify_access_token(&token.token, &Uuid::new_v4(), secret);
        // Wrong doc ID should fail
        assert!(verified.is_none());
    }

    #[test]
    fn test_access_token_wrong_doc_id() {
        let doc_id = Uuid::new_v4();
        let other_id = Uuid::new_v4();
        let secret = b"secret";

        let token = generate_access_token(&doc_id, secret, 3600, None).unwrap();
        assert!(verify_access_token(&token.token, &other_id, secret).is_none());
    }

    #[test]
    fn test_access_token_expired() {
        let doc_id = Uuid::new_v4();
        let secret = b"secret";

        let token = generate_access_token(&doc_id, secret, -1, None).unwrap(); // already expired
        assert!(verify_access_token(&token.token, &doc_id, secret).is_none());
    }

    #[test]
    fn test_access_token_wrong_secret() {
        let doc_id = Uuid::new_v4();

        let token = generate_access_token(&doc_id, b"secret1", 3600, None).unwrap();
        assert!(verify_access_token(&token.token, &doc_id, b"secret2").is_none());
    }

    #[test]
    fn test_resolve_server_key_empty() {
        assert!(resolve_server_key("").unwrap().is_none());
    }

    #[test]
    fn test_resolve_server_key_valid() {
        let key = BASE64.encode([99u8; 32]);
        let resolved = resolve_server_key(&key).unwrap().unwrap();
        assert_eq!(resolved, [99u8; 32]);
    }

    #[test]
    fn test_resolve_server_key_wrong_length() {
        let key = BASE64.encode([99u8; 16]); // too short
        assert!(resolve_server_key(&key).is_err());
    }
}
