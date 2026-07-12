//! Private-document decryption + lazy key-rotation decisions.
//!
//! Extracts the server-key recovery and DEK-rotation logic that used to live as
//! private helpers fused into `handlers::document` (`resolve_server_keys`,
//! `try_server_key_decrypt`, `lazy_rotate_dek`). Holding the resolved current
//! and previous server keys, it answers two questions independently of HTTP:
//!
//! - **How do we decrypt?** Prefer the token-embedded DEK (self-contained, no
//!   server key touched); otherwise recover via the current server key, then
//!   the previous one.
//! - **Should the wrapped DEK be rotated?** When the stored DEK predates the
//!   current key version (`< 1`) and both keys are configured, the DEK is
//!   rewrapped to the current key — the caller persists it (lazy rotation).
//!
//! Keeping the DB write in the caller is what makes recovery + rotation
//! unit-testable here without a pool: [`decrypt_with_recovery`] returns the
//! rewrapped DEK rather than writing it.
//!
//! [`decrypt_with_recovery`]: DocumentCrypto::decrypt_with_recovery

use crate::config::SecurityConfig;
use crate::errors::{ApiError, codes};
use crate::models::document::DocumentEncryptionMeta;
use crate::services::document_encryption;

/// Outcome of a recovery decrypt.
#[derive(Debug)]
pub struct Recovered {
    /// The decrypted file bytes.
    pub plaintext: Vec<u8>,
    /// When the stored DEK was wrapped with the previous server key version
    /// and both keys are available, the DEK rewrapped with the current key —
    /// the caller should persist it via `DocumentRepo::update_encrypted_dek`.
    /// `None` when no rotation is warranted.
    pub rewrapped_dek: Option<Vec<u8>>,
}

/// Server-key recovery + lazy-rotation decisions for private documents.
pub struct DocumentCrypto {
    current_key: Option<[u8; 32]>,
    old_key: Option<[u8; 32]>,
}

impl DocumentCrypto {
    /// Build from already-resolved keys. Used by tests and internally.
    pub fn from_keys(current_key: Option<[u8; 32]>, old_key: Option<[u8; 32]>) -> Self {
        Self {
            current_key,
            old_key,
        }
    }

    /// Resolve the current and previous server keys from security settings.
    pub fn from_settings(security: &SecurityConfig) -> Result<Self, ApiError> {
        let current = document_encryption::resolve_server_key(&security.document_encryption_key)?;
        let old = document_encryption::resolve_server_key(&security.document_encryption_key_old)?;
        Ok(Self::from_keys(current, old))
    }

    /// The current server key, for wrapping a freshly-encrypted document's DEK.
    pub fn current_server_key(&self) -> Option<[u8; 32]> {
        self.current_key
    }

    /// Version stamp for the current server key (1 when configured), mirroring
    /// the former `resolve_server_keys` helper's second return value.
    pub fn current_key_version(&self) -> Option<i16> {
        self.current_key.map(|_| 1)
    }

    /// The DEK rewrapped to the current key, when the stored DEK is stale
    /// (`encryption_key_version < 1`) and both keys are configured. `None`
    /// otherwise. Pure — the caller persists the result.
    pub fn rewrap_for_rotation(&self, meta: &DocumentEncryptionMeta) -> Option<Vec<u8>> {
        if matches!(meta.encryption_key_version, Some(v) if v >= 1) {
            return None;
        }
        let encrypted_dek = meta.encrypted_dek.as_deref()?;
        let current = self.current_key?;
        let old = self.old_key?;
        document_encryption::rotate_dek(encrypted_dek, &old, &current).ok()
    }

    /// Decrypt `ciphertext`, preferring the token-embedded DEK; on its absence
    /// recover via the current server key, then the previous one. When a server
    /// key path is used and the stored DEK is stale, the rewrapped DEK for lazy
    /// rotation is returned alongside the plaintext.
    pub fn decrypt_with_recovery(
        &self,
        ciphertext: &[u8],
        nonce: &[u8],
        token_dek: Option<[u8; 32]>,
        meta: &DocumentEncryptionMeta,
    ) -> Result<Recovered, ApiError> {
        // 1. Token-embedded DEK — self-contained; the server keys aren't touched.
        if let Some(dek) = token_dek {
            let plaintext = document_encryption::decrypt_with_dek(ciphertext, nonce, &dek)
                .map_err(|_| {
                    ApiError::internal("Decryption failed with token-embedded key")
                        .with_code(codes::DOCUMENT_DECRYPTION_FAILED)
                })?;
            return Ok(Recovered {
                plaintext,
                rewrapped_dek: None,
            });
        }

        // 2. Server-key recovery.
        let encrypted_dek = meta.encrypted_dek.as_deref().ok_or_else(|| {
            ApiError::internal(
                "Cannot decrypt: token has no embedded key and no server key configured",
            )
            .with_code(codes::DOCUMENT_DECRYPTION_FAILED)
        })?;

        // Current key first.
        if let Some(current) = self.current_key
            && let Ok(plaintext) = document_encryption::decrypt_document_with_server_key(
                ciphertext,
                nonce,
                encrypted_dek,
                &current,
            )
        {
            return Ok(Recovered {
                plaintext,
                rewrapped_dek: self.rewrap_for_rotation(meta),
            });
        }

        // Previous key fallback; rewrap to the current key for lazy rotation.
        if let Some(old) = self.old_key
            && let Ok(plaintext) = document_encryption::decrypt_document_with_server_key(
                ciphertext,
                nonce,
                encrypted_dek,
                &old,
            )
        {
            return Ok(Recovered {
                plaintext,
                rewrapped_dek: self.rewrap_for_rotation(meta),
            });
        }

        Err(ApiError::internal(
            "Cannot decrypt: token has no embedded key and no server key configured",
        )
        .with_code(codes::DOCUMENT_DECRYPTION_FAILED))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn meta_with(encrypted_dek: Option<Vec<u8>>, version: Option<i16>) -> DocumentEncryptionMeta {
        DocumentEncryptionMeta {
            is_private: true,
            password_hash: None,
            encryption_salt: None,
            encryption_nonce: None,
            encrypted_dek,
            encryption_key_version: version,
            private_access_expires_at: None,
            private_failed_attempt_count: 0,
            private_locked_until: None,
        }
    }

    #[test]
    fn token_dek_path_decrypts_without_touching_server_keys() {
        let password = "correct horse battery staple";
        let enc = document_encryption::encrypt_document(b"hello world", password, None, None)
            .expect("encrypt");
        let dek = document_encryption::derive_key(password, &enc.salt).expect("derive");

        // No server keys configured at all — token path must still work.
        let crypto = DocumentCrypto::from_keys(None, None);
        let meta = meta_with(None, None);
        let recovered = crypto
            .decrypt_with_recovery(&enc.ciphertext, &enc.nonce, Some(dek), &meta)
            .expect("token decrypt");

        assert_eq!(recovered.plaintext, b"hello world");
        assert!(
            recovered.rewrapped_dek.is_none(),
            "token path never rotates"
        );
    }

    #[test]
    fn current_server_key_decrypts_without_rotation_when_current_version() {
        let current = [7u8; 32];
        let enc =
            document_encryption::encrypt_document(b"server bytes", "pw", Some(&current), Some(1))
                .expect("encrypt");
        let crypto = DocumentCrypto::from_keys(Some(current), None);
        let meta = meta_with(enc.encrypted_dek.clone(), Some(1));

        let recovered = crypto
            .decrypt_with_recovery(&enc.ciphertext, &enc.nonce, None, &meta)
            .expect("server-key decrypt");

        assert_eq!(recovered.plaintext, b"server bytes");
        assert!(
            recovered.rewrapped_dek.is_none(),
            "current-version DEK is not rotated"
        );
    }

    #[test]
    fn old_key_fallback_decrypts_and_lazy_rotation_fires_once() {
        let current = [1u8; 32];
        let old = [2u8; 32];
        // Encrypt with the OLD key at the pre-rotation version (0).
        let enc = document_encryption::encrypt_document(b"legacy bytes", "pw", Some(&old), Some(0))
            .expect("encrypt");
        let crypto = DocumentCrypto::from_keys(Some(current), Some(old));
        let meta = meta_with(enc.encrypted_dek.clone(), Some(0));

        let recovered = crypto
            .decrypt_with_recovery(&enc.ciphertext, &enc.nonce, None, &meta)
            .expect("old-key fallback decrypt");

        assert_eq!(recovered.plaintext, b"legacy bytes");
        let rewrapped = recovered
            .rewrapped_dek
            .expect("stale DEK must be rewrapped to the current key");
        // The rewrapped DEK unwraps under the current key — rotation is real.
        let plaintext = document_encryption::decrypt_document_with_server_key(
            &enc.ciphertext,
            &enc.nonce,
            &rewrapped,
            &current,
        )
        .expect("rewrapped DEK decrypts under current key");
        assert_eq!(plaintext, b"legacy bytes");
    }

    #[test]
    fn missing_dek_and_no_token_is_an_error() {
        let crypto = DocumentCrypto::from_keys(Some([9u8; 32]), None);
        let meta = meta_with(None, None);
        let err = crypto
            .decrypt_with_recovery(b"x", b"y", None, &meta)
            .expect_err("no token and no wrapped DEK must fail");
        assert_eq!(err.code(), codes::DOCUMENT_DECRYPTION_FAILED);
    }
}
