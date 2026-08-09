//! Preview token service
//!
//! Generates and validates short-lived JWTs for draft content preview.
//! Tokens are signed with HMAC-SHA256 using a shared secret between the
//! backend and frontend templates.

use chrono::{Duration, Utc};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::{ApiError, codes};

/// Claims embedded in a preview token JWT.
#[derive(Debug, Serialize, Deserialize)]
pub struct PreviewTokenClaims {
    /// Site ID this token grants preview access to
    pub sub: String,
    /// Issued at (Unix timestamp)
    pub iat: i64,
    /// Expiry (Unix timestamp)
    pub exp: i64,
    /// Token purpose identifier
    pub purpose: String,
}

const TOKEN_LIFETIME_MINUTES: i64 = 5;
const TOKEN_PURPOSE: &str = "preview";

/// Generate a short-lived preview token for a site.
pub fn generate(site_id: Uuid, secret: &str) -> Result<(String, i64), ApiError> {
    let now = Utc::now();
    let exp = now + Duration::minutes(TOKEN_LIFETIME_MINUTES);

    let claims = PreviewTokenClaims {
        sub: site_id.to_string(),
        iat: now.timestamp(),
        exp: exp.timestamp(),
        purpose: TOKEN_PURPOSE.to_string(),
    };

    let token = jsonwebtoken::encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| {
        ApiError::internal(format!("Failed to generate preview token: {e}"))
            .with_code(codes::INTERNAL_ERROR)
    })?;

    Ok((token, exp.timestamp()))
}

/// Validate a preview token and return the site ID it grants access to.
pub fn validate(token: &str, secret: &str) -> Result<Uuid, ApiError> {
    let validation = Validation {
        validate_aud: false,
        ..Validation::default()
    };

    let data = jsonwebtoken::decode::<PreviewTokenClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map_err(|_| {
        ApiError::unauthorized("Invalid or expired preview token")
            .with_code(codes::AUTH_TOKEN_INVALID)
    })?;

    if data.claims.purpose != TOKEN_PURPOSE {
        return Err(
            ApiError::unauthorized("Invalid token purpose").with_code(codes::AUTH_TOKEN_INVALID)
        );
    }

    Uuid::parse_str(&data.claims.sub).map_err(|_| {
        ApiError::unauthorized("Invalid token subject").with_code(codes::AUTH_TOKEN_INVALID)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_SECRET: &str = "test-preview-secret-at-least-32-bytes-long";

    #[test]
    fn test_generate_and_validate() {
        let site_id = Uuid::new_v4();
        let (token, _exp) = generate(site_id, TEST_SECRET).unwrap();
        let validated_site_id = validate(&token, TEST_SECRET).unwrap();
        assert_eq!(site_id, validated_site_id);
    }

    #[test]
    fn test_reject_wrong_secret() {
        let site_id = Uuid::new_v4();
        let (token, _) = generate(site_id, TEST_SECRET).unwrap();
        let result = validate(&token, "wrong-secret");
        assert!(result.is_err());
    }

    #[test]
    fn test_reject_garbage_token() {
        let result = validate("not-a-jwt", TEST_SECRET);
        assert!(result.is_err());
    }

    #[test]
    fn test_token_contains_correct_site_id() {
        let site_id = Uuid::new_v4();
        let (token, _) = generate(site_id, TEST_SECRET).unwrap();

        let mut validation = Validation::default();
        validation.validate_aud = false;
        let data = jsonwebtoken::decode::<PreviewTokenClaims>(
            &token,
            &DecodingKey::from_secret(TEST_SECRET.as_bytes()),
            &validation,
        )
        .unwrap();

        assert_eq!(data.claims.sub, site_id.to_string());
        assert_eq!(data.claims.purpose, "preview");
        assert!(data.claims.exp > data.claims.iat);
    }
}
