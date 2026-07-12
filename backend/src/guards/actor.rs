//! Unified authenticated-principal value.
//!
//! `Actor` is the canonical representation of "who is making this request",
//! independent of which authentication strategy resolved them. It is the
//! seam the broader codebase will consume in place of the various ad-hoc
//! `auth.0.user_identifier()` / `auth.0.id` derivations scattered across
//! handlers, validation contexts, RBAC checks, and audit logging today.
//!
//! Slice 1 (Clerk only) and Slice 2 (API key + preview) of issue #619 are
//! shipped here; the role-gated newtypes (Slice 3) and the
//! `ValidationContext` migration (Slice 4) follow. The conversion from
//! [`AuthenticatedKey`] is a pure function (`Actor::from_authenticated`)
//! so it is testable without an [`AppState`]; the `FromRequestParts` impl
//! that ties it into the Axum router lives in `axum_app::extractors`.
//!
//! [`AuthenticatedKey`]: crate::guards::auth_guard::AuthenticatedKey
//! [`AppState`]: crate::AppState

use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::errors::codes;
use crate::guards::auth_guard::{AuthSource, AuthenticatedKey};
use crate::models::api_key::ApiKeyPermission;
use crate::models::site_membership::{SiteMembership, SiteRole};

/// The authenticated principal making a request.
#[derive(Debug, Clone)]
pub struct Actor {
    /// Stable identifier — equal to [`AuthenticatedKey::id`] for the same
    /// underlying authentication, so existing audit / webhook columns keep
    /// pointing at the same row.
    pub id: Uuid,
    pub kind: ActorKind,
}

/// Which authentication strategy resolved this `Actor`.
#[derive(Debug, Clone)]
pub enum ActorKind {
    Clerk {
        clerk_user_id: String,
    },
    ApiKey {
        permission: ApiKeyPermission,
        site_id: Option<Uuid>,
    },
    Preview {
        site_id: Uuid,
    },
}

impl Actor {
    /// Get a stable user identifier for ownership checks.
    /// Returns the Clerk user ID for Clerk auth, or `None` for API keys
    /// and preview tokens (neither owns content).
    pub fn user_identifier(&self) -> Option<&str> {
        match &self.kind {
            ActorKind::Clerk { clerk_user_id } => Some(clerk_user_id),
            ActorKind::ApiKey { .. } | ActorKind::Preview { .. } => None,
        }
    }

    /// Alias for `user_identifier`. Returns the Clerk user ID if this Actor
    /// was resolved via Clerk JWT; `None` for API keys and preview tokens.
    pub fn clerk_user_id(&self) -> Option<&str> {
        self.user_identifier()
    }

    /// API-key permission level, if this Actor was resolved via an API key.
    /// `None` for Clerk users (whose permissions come from site roles) and
    /// preview tokens (which are read-only by construction).
    pub fn api_key_permission(&self) -> Option<ApiKeyPermission> {
        match &self.kind {
            ActorKind::ApiKey { permission, .. } => Some(*permission),
            ActorKind::Clerk { .. } | ActorKind::Preview { .. } => None,
        }
    }

    /// Site scope, if this Actor is bound to a specific site. Returns
    /// `Some(site_id)` for site-scoped API keys and preview tokens (which are
    /// always single-site by construction); `None` for unscoped API keys and
    /// Clerk users (whose site access is computed via memberships).
    pub fn scoped_site_id(&self) -> Option<Uuid> {
        match &self.kind {
            ActorKind::ApiKey { site_id, .. } => *site_id,
            ActorKind::Preview { site_id } => Some(*site_id),
            ActorKind::Clerk { .. } => None,
        }
    }

    /// True if this Actor is bound to a specific site.
    pub fn is_site_scoped(&self) -> bool {
        self.scoped_site_id().is_some()
    }

    /// True if this Actor can access the given site, by virtue of either
    /// being unscoped (Clerk / unscoped API key) or being scoped to that
    /// exact site (scoped API key / preview token).
    pub fn has_site_access(&self, site_id: Uuid) -> bool {
        match self.scoped_site_id() {
            None => true,
            Some(scoped) => scoped == site_id,
        }
    }

    /// Returns `Err(Forbidden)` if this Actor doesn't have access to the
    /// given site. Used for API-key / preview-token site-scoping checks.
    pub fn ensure_site_access(&self, site_id: Uuid) -> Result<(), ApiError> {
        if self.has_site_access(site_id) {
            Ok(())
        } else {
            Err(
                ApiError::forbidden("API key does not have access to this site")
                    .with_code(codes::AUTH_API_KEY_SITE_DENIED),
            )
        }
    }

    /// API-key shorthand: can this Actor manage API keys?
    /// True iff the Actor is an API key with Master permission.
    pub fn can_manage_keys(&self) -> bool {
        matches!(self.api_key_permission(), Some(ApiKeyPermission::Master))
    }

    /// API-key shorthand: can this Actor write content via its API-key
    /// permission? Returns false for Clerk users (whose write permission
    /// comes from site roles, not the API key permission scale) and
    /// preview tokens.
    pub fn can_write(&self) -> bool {
        self.api_key_permission()
            .map(|p| p.can_write())
            .unwrap_or(false)
    }

    /// API-key shorthand: does this Actor have admin-level API-key
    /// permission? Returns false for Clerk users and preview tokens.
    pub fn is_admin(&self) -> bool {
        self.api_key_permission()
            .map(|p| p.is_admin())
            .unwrap_or(false)
    }

    /// Resolve the effective site role for this Actor.
    /// - Clerk users: look up site_memberships (system admins get Owner)
    /// - API keys: map ApiKeyPermission to equivalent SiteRole (after site-access check)
    /// - Preview tokens: Viewer on the scoped site only
    pub async fn effective_site_role(
        &self,
        pool: &PgPool,
        site_id: Uuid,
    ) -> Result<Option<SiteRole>, ApiError> {
        match &self.kind {
            ActorKind::Clerk { clerk_user_id } => {
                if SiteMembership::is_system_admin(pool, clerk_user_id).await? {
                    return Ok(Some(SiteRole::Owner));
                }
                let membership =
                    SiteMembership::find_by_clerk_user_and_site(pool, clerk_user_id, site_id)
                        .await?;
                Ok(membership.map(|m| m.role))
            }
            ActorKind::ApiKey {
                permission,
                site_id: scoped,
            } => {
                if let Some(scoped) = scoped
                    && *scoped != site_id
                {
                    return Ok(None);
                }
                let role = match permission {
                    ApiKeyPermission::Master => SiteRole::Owner,
                    ApiKeyPermission::Admin => SiteRole::Admin,
                    ApiKeyPermission::Write => SiteRole::Editor,
                    ApiKeyPermission::Read => SiteRole::Viewer,
                };
                Ok(Some(role))
            }
            ActorKind::Preview { site_id: scoped } => {
                if *scoped != site_id {
                    return Ok(None);
                }
                Ok(Some(SiteRole::Viewer))
            }
        }
    }

    /// Require at least the given site role, returning Forbidden if insufficient.
    pub async fn require_site_role(
        &self,
        pool: &PgPool,
        site_id: Uuid,
        min_role: &SiteRole,
    ) -> Result<SiteRole, ApiError> {
        let role = self
            .effective_site_role(pool, site_id)
            .await?
            .ok_or_else(|| {
                ApiError::forbidden("You do not have access to this site")
                    .with_code(codes::AUTH_SITE_ACCESS_DENIED)
            })?;
        if role.has_at_least(min_role) {
            Ok(role)
        } else {
            Err(
                ApiError::forbidden(format!("Requires at least {} role on this site", min_role))
                    .with_code(codes::AUTH_INSUFFICIENT_ROLE),
            )
        }
    }

    /// Is this Actor a system admin?
    /// - Clerk users: lookup in `system_admins` table
    /// - API keys: Master permission counts as system admin (legacy semantics)
    /// - Preview tokens: never
    pub async fn is_system_admin(&self, pool: &PgPool) -> Result<bool, ApiError> {
        match &self.kind {
            ActorKind::Clerk { clerk_user_id } => {
                SiteMembership::is_system_admin(pool, clerk_user_id).await
            }
            ActorKind::ApiKey { permission, .. } => Ok(*permission == ApiKeyPermission::Master),
            ActorKind::Preview { .. } => Ok(false),
        }
    }

    /// Unified site action authorization. Returns Ok(()) if the Actor has at
    /// least the required role.
    pub async fn authorize_site_action(
        &self,
        pool: &PgPool,
        site_id: Uuid,
        min_role: &SiteRole,
    ) -> Result<(), ApiError> {
        self.require_site_role(pool, site_id, min_role).await?;
        Ok(())
    }

    /// Pure converter from an already-resolved [`AuthenticatedKey`]. Used
    /// by the `FromRequestParts` impl and easy to drive from unit tests.
    pub fn from_authenticated(auth: &AuthenticatedKey) -> Result<Self, ApiError> {
        match &auth.auth_source {
            AuthSource::ClerkJwt { clerk_user_id } => Ok(Self {
                id: auth.id,
                kind: ActorKind::Clerk {
                    clerk_user_id: clerk_user_id.clone(),
                },
            }),
            AuthSource::PreviewToken { site_id } => Ok(Self {
                id: auth.id,
                kind: ActorKind::Preview { site_id: *site_id },
            }),
            AuthSource::ApiKey => Ok(Self {
                id: auth.id,
                kind: ActorKind::ApiKey {
                    permission: auth.permission,
                    site_id: auth.site_id,
                },
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::guards::auth_guard::CLERK_UUID_NAMESPACE;

    fn clerk_authenticated_key(clerk_user_id: &str) -> AuthenticatedKey {
        AuthenticatedKey {
            id: Uuid::new_v5(&CLERK_UUID_NAMESPACE, clerk_user_id.as_bytes()),
            permission: ApiKeyPermission::Read,
            site_id: None,
            auth_source: AuthSource::ClerkJwt {
                clerk_user_id: clerk_user_id.to_string(),
            },
        }
    }

    fn api_key_authenticated(
        permission: ApiKeyPermission,
        site_id: Option<Uuid>,
    ) -> AuthenticatedKey {
        AuthenticatedKey {
            id: Uuid::new_v4(),
            permission,
            site_id,
            auth_source: AuthSource::ApiKey,
        }
    }

    fn preview_authenticated(site_id: Uuid) -> AuthenticatedKey {
        AuthenticatedKey {
            id: Uuid::new_v4(),
            permission: ApiKeyPermission::Read,
            site_id: Some(site_id),
            auth_source: AuthSource::PreviewToken { site_id },
        }
    }

    #[test]
    fn actor_from_authenticated_clerk_jwt_populates_id_and_kind() {
        let auth = clerk_authenticated_key("user_abc123");
        let actor = Actor::from_authenticated(&auth).expect("clerk source must succeed");

        assert_eq!(actor.id, auth.id);
        match actor.kind {
            ActorKind::Clerk { clerk_user_id } => assert_eq!(clerk_user_id, "user_abc123"),
            other => panic!("expected Clerk, got {:?}", other),
        }
    }

    #[test]
    fn actor_from_authenticated_api_key_populates_permission_and_scope() {
        let site = Uuid::new_v4();
        let auth = api_key_authenticated(ApiKeyPermission::Admin, Some(site));
        let actor = Actor::from_authenticated(&auth).unwrap();

        assert_eq!(actor.id, auth.id);
        match actor.kind {
            ActorKind::ApiKey {
                permission,
                site_id,
            } => {
                assert_eq!(permission, ApiKeyPermission::Admin);
                assert_eq!(site_id, Some(site));
            }
            other => panic!("expected ApiKey, got {:?}", other),
        }
    }

    #[test]
    fn actor_from_authenticated_preview_token_uses_preview_variant() {
        // Preview tokens carry their scoped site on the `AuthSource::PreviewToken`
        // variant; the converter routes those to `ActorKind::Preview` rather than
        // `ApiKey` so RBAC and audit code can distinguish them — no sentinel id.
        let site = Uuid::new_v4();
        let auth = preview_authenticated(site);
        let actor = Actor::from_authenticated(&auth).unwrap();

        match actor.kind {
            ActorKind::Preview { site_id } => assert_eq!(site_id, site),
            other => panic!("expected Preview, got {:?}", other),
        }
    }

    #[test]
    fn actor_and_authenticated_key_share_principal() {
        // Tracer bullet: the new seam must produce the same stable identifier
        // as the legacy `AuthenticatedKey.id`. Audit columns, webhook payloads,
        // and per-user rate-limit keys all key on this — divergence here would
        // break them silently across the rest of the migration.
        let auth = clerk_authenticated_key("user_tracer");
        let actor = Actor::from_authenticated(&auth).unwrap();
        assert_eq!(actor.id, auth.id);
    }
}
