//! Cryptographic key generation and encryption for ActivityPub federation.
//!
//! Supports RSA (2048-bit) and Ed25519 keypairs. Private keys are encrypted
//! at rest using AES-256-GCM via the existing `encryption` service.

use aes_gcm::aead::OsRng;
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use ed25519_dalek::SigningKey;
use rsa::pkcs8::EncodePrivateKey;
use rsa::pkcs8::EncodePublicKey;
use rsa::pkcs8::LineEnding;
use rsa::RsaPrivateKey;

use crate::errors::ApiError;
use crate::services::encryption;

/// Generate a 2048-bit RSA keypair.
///
/// Returns `(private_key_der_bytes, public_key_pem_string)`.
pub fn generate_rsa_keypair() -> Result<(Vec<u8>, String), ApiError> {
    let mut rng = OsRng;
    let private_key = RsaPrivateKey::new(&mut rng, 2048)
        .map_err(|e| ApiError::internal(format!("RSA key generation failed: {e}")))?;

    let private_key_der = private_key
        .to_pkcs8_der()
        .map_err(|e| ApiError::internal(format!("Private key DER encoding failed: {e}")))?;

    let public_key_pem = private_key
        .to_public_key()
        .to_public_key_pem(LineEnding::LF)
        .map_err(|e| ApiError::internal(format!("Public key PEM encoding failed: {e}")))?;

    Ok((private_key_der.as_bytes().to_vec(), public_key_pem))
}

/// Generate an Ed25519 keypair.
///
/// Returns `(32-byte_secret_key, base64_public_key)`.
pub fn generate_ed25519_keypair() -> Result<(Vec<u8>, String), ApiError> {
    let mut csprng = OsRng;
    let signing_key = SigningKey::generate(&mut csprng);

    let secret_bytes = signing_key.to_bytes().to_vec();
    let public_key_b64 = BASE64.encode(signing_key.verifying_key().as_bytes());

    Ok((secret_bytes, public_key_b64))
}

/// Encrypt a private key for storage.
///
/// Base64-encodes the raw bytes then encrypts with AES-256-GCM.
/// Returns `(ciphertext, nonce)`.
pub fn encrypt_private_key(
    key_bytes: &[u8],
    encryption_key: &[u8; 32],
) -> Result<(Vec<u8>, Vec<u8>), ApiError> {
    let encoded = BASE64.encode(key_bytes);
    encryption::encrypt(&encoded, encryption_key)
}

/// Decrypt a stored private key.
///
/// Decrypts with AES-256-GCM then base64-decodes back to raw bytes.
pub fn decrypt_private_key(
    ciphertext: &[u8],
    nonce: &[u8],
    encryption_key: &[u8; 32],
) -> Result<Vec<u8>, ApiError> {
    let decoded_str = encryption::decrypt(ciphertext, nonce, encryption_key)?;
    BASE64
        .decode(&decoded_str)
        .map_err(|e| ApiError::internal(format!("Base64 decode of decrypted key failed: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::encryption::resolve_key;

    #[test]
    fn test_generate_rsa_keypair_produces_valid_pem() {
        let (private_key, public_key_pem) = generate_rsa_keypair().unwrap();
        assert!(public_key_pem.starts_with("-----BEGIN PUBLIC KEY-----"));
        assert!(public_key_pem.ends_with("-----END PUBLIC KEY-----\n"));
        assert!(!private_key.is_empty());
    }

    #[test]
    fn test_generate_ed25519_keypair_produces_32_byte_keys() {
        let (private_key, public_key) = generate_ed25519_keypair().unwrap();
        assert_eq!(private_key.len(), 32);
        assert!(!public_key.is_empty());
        // Verify the public key is valid base64
        let decoded = BASE64.decode(&public_key).unwrap();
        assert_eq!(decoded.len(), 32);
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = resolve_key("").unwrap(); // dev fallback key
        let test_data = b"test private key material";

        let (ciphertext, nonce) = encrypt_private_key(test_data, &key).unwrap();
        let decrypted = decrypt_private_key(&ciphertext, &nonce, &key).unwrap();

        assert_eq!(decrypted, test_data);
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip_with_rsa_key() {
        let key = resolve_key("").unwrap();
        let (private_key_der, _) = generate_rsa_keypair().unwrap();

        let (ciphertext, nonce) = encrypt_private_key(&private_key_der, &key).unwrap();
        let decrypted = decrypt_private_key(&ciphertext, &nonce, &key).unwrap();

        assert_eq!(decrypted, private_key_der);
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip_with_ed25519_key() {
        let key = resolve_key("").unwrap();
        let (secret_bytes, _) = generate_ed25519_keypair().unwrap();

        let (ciphertext, nonce) = encrypt_private_key(&secret_bytes, &key).unwrap();
        let decrypted = decrypt_private_key(&ciphertext, &nonce, &key).unwrap();

        assert_eq!(decrypted, secret_bytes);
    }
}
