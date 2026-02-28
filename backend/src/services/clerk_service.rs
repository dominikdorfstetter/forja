//! Clerk user management service
//!
//! Wraps Clerk Backend API for listing/getting users.

use crate::errors::ApiError;
use serde::Deserialize;

/// Clerk API service
#[derive(Clone)]
pub struct ClerkService {
    secret_key: String,
    client: reqwest::Client,
    base_url: String,
}

/// Raw Clerk user from the API
#[derive(Debug, Deserialize)]
pub struct ClerkApiUser {
    pub id: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email_addresses: Vec<ClerkEmailAddress>,
    pub primary_email_address_id: Option<String>,
    pub image_url: Option<String>,
    pub public_metadata: serde_json::Value,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_sign_in_at: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct ClerkEmailAddress {
    pub id: String,
    pub email_address: String,
}

impl ClerkApiUser {
    /// Get the primary email address
    pub fn primary_email(&self) -> Option<String> {
        if let Some(ref primary_id) = self.primary_email_address_id {
            self.email_addresses
                .iter()
                .find(|e| &e.id == primary_id)
                .map(|e| e.email_address.clone())
        } else {
            self.email_addresses
                .first()
                .map(|e| e.email_address.clone())
        }
    }

    /// Get the CMS role from public_metadata (legacy, kept for Clerk user listing)
    pub fn cms_role(&self) -> String {
        self.public_metadata
            .get("role")
            .and_then(|v| v.as_str())
            .unwrap_or("read")
            .to_string()
    }

    /// Get full display name
    pub fn display_name(&self) -> String {
        match (&self.first_name, &self.last_name) {
            (Some(first), Some(last)) => format!("{} {}", first, last),
            (Some(first), None) => first.clone(),
            (None, Some(last)) => last.clone(),
            (None, None) => self.primary_email().unwrap_or_else(|| self.id.clone()),
        }
    }
}

impl ClerkService {
    pub fn new(secret_key: String) -> Self {
        let base_url = "https://api.clerk.com/v1".to_string();
        assert!(
            base_url.starts_with("https://"),
            "Clerk API base URL must use HTTPS"
        );
        Self {
            secret_key,
            client: reqwest::Client::new(),
            base_url,
        }
    }

    /// Validate that a URL uses HTTPS before sending credentials
    fn require_https(url: &str) -> Result<(), ApiError> {
        if !url.starts_with("https://") {
            return Err(ApiError::Internal(
                "Refusing to send credentials over non-HTTPS connection".to_string(),
            ));
        }
        Ok(())
    }

    /// Sanitize and validate a path parameter to prevent injection and
    /// ensure only safe characters are included in request URLs.
    fn sanitize_path_param(value: &str) -> Result<&str, ApiError> {
        if !value.is_empty()
            && value
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
        {
            Ok(value)
        } else {
            Err(ApiError::BadRequest(
                "Invalid identifier format".to_string(),
            ))
        }
    }

    /// List Clerk users with pagination
    pub async fn list_users(
        &self,
        limit: i64,
        offset: i64,
    ) -> Result<(Vec<ClerkApiUser>, i64), ApiError> {
        let url = format!("{}/users", self.base_url);
        Self::require_https(&url)?;
        let resp = self
            .client
            .get(&url)
            .bearer_auth(&self.secret_key)
            .query(&[("limit", limit.to_string()), ("offset", offset.to_string())])
            .send()
            .await
            .map_err(|_| ApiError::Internal("Clerk API request failed".to_string()))?;

        if !resp.status().is_success() {
            let status = resp.status();
            return Err(ApiError::Internal(format!("Clerk API returned {}", status)));
        }

        let total_count: i64 = resp
            .headers()
            .get("x-total-count")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse().ok())
            .unwrap_or(0);

        let users: Vec<ClerkApiUser> = resp
            .json()
            .await
            .map_err(|e| ApiError::Internal(format!("Failed to parse Clerk users: {}", e)))?;

        Ok((users, total_count))
    }

    /// Get a single Clerk user by ID
    pub async fn get_user(&self, user_id: &str) -> Result<ClerkApiUser, ApiError> {
        let safe_id = Self::sanitize_path_param(user_id)?;
        let url = format!("{}/users/{}", self.base_url, safe_id);
        Self::require_https(&url)?;
        let resp = self
            .client
            .get(&url)
            .bearer_auth(&self.secret_key)
            .send()
            .await
            .map_err(|_| ApiError::Internal("Clerk API request failed".to_string()))?;

        if !resp.status().is_success() {
            let status = resp.status();
            if status.as_u16() == 404 {
                return Err(ApiError::NotFound("Clerk user not found".to_string()));
            }
            return Err(ApiError::Internal(format!("Clerk API returned {}", status)));
        }

        let user: ClerkApiUser = resp
            .json()
            .await
            .map_err(|_| ApiError::Internal("Failed to parse Clerk user response".to_string()))?;

        Ok(user)
    }

    /// Update a Clerk user's CMS role via public_metadata
    pub async fn update_user_role(
        &self,
        user_id: &str,
        role: &str,
    ) -> Result<ClerkApiUser, ApiError> {
        let safe_id = Self::sanitize_path_param(user_id)?;
        let url = format!("{}/users/{}", self.base_url, safe_id);
        Self::require_https(&url)?;
        let body = serde_json::json!({
            "public_metadata": { "role": role }
        });

        let resp = self
            .client
            .patch(&url)
            .bearer_auth(&self.secret_key)
            .json(&body)
            .send()
            .await
            .map_err(|_| ApiError::Internal("Clerk API request failed".to_string()))?;

        if !resp.status().is_success() {
            let status = resp.status();
            if status.as_u16() == 404 {
                return Err(ApiError::NotFound("Clerk user not found".to_string()));
            }
            return Err(ApiError::Internal(format!("Clerk API returned {}", status)));
        }

        let user: ClerkApiUser = resp
            .json()
            .await
            .map_err(|_| ApiError::Internal("Failed to parse Clerk user response".to_string()))?;

        Ok(user)
    }

    /// Delete a Clerk user by ID
    pub async fn delete_user(&self, user_id: &str) -> Result<(), ApiError> {
        let safe_id = Self::sanitize_path_param(user_id)?;
        let url = format!("{}/users/{}", self.base_url, safe_id);
        Self::require_https(&url)?;
        let resp = self
            .client
            .delete(&url)
            .bearer_auth(&self.secret_key)
            .send()
            .await
            .map_err(|_| ApiError::Internal("Clerk API request failed".to_string()))?;

        if !resp.status().is_success() {
            let status = resp.status();
            if status.as_u16() == 404 {
                return Err(ApiError::NotFound("Clerk user not found".to_string()));
            }
            return Err(ApiError::Internal(format!("Clerk API returned {}", status)));
        }

        Ok(())
    }

    /// Lightweight health check - list 1 user to verify Clerk API connectivity
    pub async fn health_check(&self) -> Result<(), String> {
        let url = format!("{}/users", self.base_url);
        if !url.starts_with("https://") {
            return Err("Clerk API base URL must use HTTPS".to_string());
        }
        let resp = self
            .client
            .get(&url)
            .bearer_auth(&self.secret_key)
            .query(&[("limit", "1")])
            .send()
            .await
            .map_err(|_| "Clerk API unreachable".to_string())?;

        if !resp.status().is_success() {
            let status = resp.status();
            return Err(format!("Clerk API returned {}", status));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_user(
        id: &str,
        first: Option<&str>,
        last: Option<&str>,
        emails: Vec<(&str, &str)>,
        primary_email_id: Option<&str>,
        metadata: serde_json::Value,
    ) -> ClerkApiUser {
        ClerkApiUser {
            id: id.to_string(),
            first_name: first.map(|s| s.to_string()),
            last_name: last.map(|s| s.to_string()),
            email_addresses: emails
                .into_iter()
                .map(|(eid, addr)| ClerkEmailAddress {
                    id: eid.to_string(),
                    email_address: addr.to_string(),
                })
                .collect(),
            primary_email_address_id: primary_email_id.map(|s| s.to_string()),
            image_url: None,
            public_metadata: metadata,
            created_at: 0,
            updated_at: 0,
            last_sign_in_at: None,
        }
    }

    // --- primary_email ---

    #[test]
    fn primary_email_matching_id() {
        let user = make_user(
            "user_1",
            None,
            None,
            vec![("em_1", "a@example.com"), ("em_2", "b@example.com")],
            Some("em_2"),
            serde_json::json!({}),
        );
        assert_eq!(user.primary_email(), Some("b@example.com".to_string()));
    }

    #[test]
    fn primary_email_fallback_to_first() {
        let user = make_user(
            "user_1",
            None,
            None,
            vec![("em_1", "first@example.com")],
            None,
            serde_json::json!({}),
        );
        assert_eq!(user.primary_email(), Some("first@example.com".to_string()));
    }

    #[test]
    fn primary_email_no_emails_returns_none() {
        let user = make_user("user_1", None, None, vec![], None, serde_json::json!({}));
        assert_eq!(user.primary_email(), None);
    }

    // --- cms_role ---

    #[test]
    fn cms_role_from_metadata() {
        let user = make_user(
            "user_1",
            None,
            None,
            vec![],
            None,
            serde_json::json!({"role": "admin"}),
        );
        assert_eq!(user.cms_role(), "admin");
    }

    #[test]
    fn cms_role_missing_key_defaults_to_read() {
        let user = make_user("user_1", None, None, vec![], None, serde_json::json!({}));
        assert_eq!(user.cms_role(), "read");
    }

    // --- display_name ---

    #[test]
    fn display_name_first_and_last() {
        let user = make_user(
            "user_1",
            Some("John"),
            Some("Doe"),
            vec![],
            None,
            serde_json::json!({}),
        );
        assert_eq!(user.display_name(), "John Doe");
    }

    #[test]
    fn display_name_first_only() {
        let user = make_user(
            "user_1",
            Some("John"),
            None,
            vec![],
            None,
            serde_json::json!({}),
        );
        assert_eq!(user.display_name(), "John");
    }

    #[test]
    fn display_name_fallback_to_email() {
        let user = make_user(
            "user_1",
            None,
            None,
            vec![("em_1", "fallback@example.com")],
            None,
            serde_json::json!({}),
        );
        assert_eq!(user.display_name(), "fallback@example.com");
    }

    #[test]
    fn display_name_fallback_to_id() {
        let user = make_user("user_abc", None, None, vec![], None, serde_json::json!({}));
        assert_eq!(user.display_name(), "user_abc");
    }
}
