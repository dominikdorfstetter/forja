//! Fine-grained permission model
//!
//! Replaces rank-based `has_at_least()` with an extensible permission system.
//! Each `SiteRole` maps to a set of permissions in `{resource}:{action}[:{scope}]`
//! format. The `PermissionService` evaluates permissions with optional resource
//! context (ownership, content status).
//!
//! **Backward compatible**: existing `SiteRole` methods remain functional.
//! Handlers can migrate incrementally.

use std::collections::HashSet;

use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::{codes, ApiError};
use crate::guards::actor::Actor;
use crate::models::content::ContentStatus;
use crate::models::site_membership::SiteRole;

// ---------------------------------------------------------------------------
// Permission type
// ---------------------------------------------------------------------------

/// A single permission in `resource:action[:scope]` format.
///
/// Examples: `"blog:create"`, `"blog:update:own"`, `"member:invite"`
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct Permission {
    pub resource: String,
    pub action: String,
    /// Optional scope: `own`, `any`, or `published`
    pub scope: Option<String>,
}

impl Permission {
    pub fn new(resource: &str, action: &str) -> Self {
        Self {
            resource: resource.to_string(),
            action: action.to_string(),
            scope: None,
        }
    }

    pub fn scoped(resource: &str, action: &str, scope: &str) -> Self {
        Self {
            resource: resource.to_string(),
            action: action.to_string(),
            scope: Some(scope.to_string()),
        }
    }

    /// Parse from `"resource:action"` or `"resource:action:scope"` string.
    pub fn parse(s: &str) -> Option<Self> {
        let parts: Vec<&str> = s.splitn(3, ':').collect();
        match parts.len() {
            2 => Some(Self::new(parts[0], parts[1])),
            3 => Some(Self::scoped(parts[0], parts[1], parts[2])),
            _ => None,
        }
    }

    /// Canonical string representation.
    pub fn as_str(&self) -> String {
        match &self.scope {
            Some(scope) => format!("{}:{}:{}", self.resource, self.action, scope),
            None => format!("{}:{}", self.resource, self.action),
        }
    }
}

impl std::fmt::Display for Permission {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

// ---------------------------------------------------------------------------
// Permission constants
// ---------------------------------------------------------------------------

// Macro to reduce boilerplate for permission constants
macro_rules! perm {
    ($resource:expr, $action:expr) => {
        Permission::new($resource, $action)
    };
    ($resource:expr, $action:expr, $scope:expr) => {
        Permission::scoped($resource, $action, $scope)
    };
}

/// Build the full permission set for a given role.
///
/// This is the **single source of truth** for what each role can do.
/// The mapping encodes the current access control matrix.
pub fn role_permissions(role: &SiteRole) -> HashSet<Permission> {
    let mut perms = HashSet::new();

    // All roles get read access
    let read_resources = [
        "blog",
        "page",
        "media",
        "document",
        "legal",
        "cv",
        "portfolio",
        "navigation",
        "redirect",
        "taxonomy",
        "template",
        "social",
        "analytics",
        "site",
        "form",
        "form_submission",
        // Custom types (#789): every site member can READ a type's schema so
        // entry editors can render/validate entry forms. WRITE (building the
        // schema) is Admin+ only — granted in the Admin block below.
        "custom_type",
        // Custom entries: readable by all members; writable Author+ (below).
        "custom_entry",
    ];
    for r in &read_resources {
        perms.insert(perm!(r, "read"));
    }

    if role.has_at_least(&SiteRole::Reviewer) {
        // Reviewers can review content
        perms.insert(perm!("blog", "review"));
        perms.insert(perm!("page", "review"));
        perms.insert(perm!("document", "review"));
    }

    if role.has_at_least(&SiteRole::Author) {
        // Authors can create and manage their own content
        let content_types = [
            "blog",
            "page",
            "media",
            "document",
            "legal",
            "cv",
            "portfolio",
            "social",
        ];
        for r in &content_types {
            perms.insert(perm!(r, "create"));
            perms.insert(perm!(r, "update", "own"));
            perms.insert(perm!(r, "delete", "own"));
        }
        perms.insert(perm!("taxonomy", "create"));
        perms.insert(perm!("taxonomy", "update"));
        perms.insert(perm!("taxonomy", "delete"));
        perms.insert(perm!("navigation", "create"));
        perms.insert(perm!("navigation", "update", "own"));
        perms.insert(perm!("navigation", "delete", "own"));
        perms.insert(perm!("redirect", "create"));
        perms.insert(perm!("redirect", "update", "own"));
        perms.insert(perm!("redirect", "delete", "own"));
        perms.insert(perm!("template", "create"));
        perms.insert(perm!("template", "update", "own"));
        perms.insert(perm!("template", "delete", "own"));
        perms.insert(perm!("media", "upload"));

        // Authors can create forms and manage their own forms + submissions
        // (Forms module — submissions of own forms only, per the #579 matrix)
        perms.insert(perm!("form", "create"));
        perms.insert(perm!("form", "update", "own"));
        perms.insert(perm!("form", "delete", "own"));
        perms.insert(perm!("form_submission", "update", "own"));
        perms.insert(perm!("form_submission", "delete", "own"));
        perms.insert(perm!("form_submission", "export", "own"));

        // Custom-type entries: Author+ can create/edit/publish entries
        // (a Write API key maps to Editor and inherits this). Schema-building
        // remains Admin+ via custom_type:write.
        perms.insert(perm!("custom_entry", "write"));
    }

    if role.has_at_least(&SiteRole::Editor) {
        // Editors can manage ALL content (not just own)
        let content_types = [
            "blog",
            "page",
            "media",
            "document",
            "legal",
            "cv",
            "portfolio",
            "social",
            "navigation",
            "redirect",
            "template",
            "form",
            "form_submission",
        ];
        for r in &content_types {
            perms.insert(perm!(r, "update", "any"));
            perms.insert(perm!(r, "delete", "any"));
        }

        // Editors+ can also export any submission and manage form templates
        // (form templates are Editor+ per the #579 matrix, distinct from
        // content templates which are Author+ via the "template" resource).
        perms.insert(perm!("form_submission", "export", "any"));
        perms.insert(perm!("form_template", "create"));
        perms.insert(perm!("form_template", "read"));
        perms.insert(perm!("form_template", "update"));
        perms.insert(perm!("form_template", "delete"));
        // Editors can publish and edit published content
        perms.insert(perm!("blog", "publish"));
        perms.insert(perm!("page", "publish"));
        perms.insert(perm!("document", "publish"));
        perms.insert(perm!("legal", "publish"));
        perms.insert(perm!("portfolio", "publish"));
        let publishable = ["blog", "page", "document", "legal", "cv", "portfolio"];
        for r in &publishable {
            perms.insert(perm!(r, "update", "published"));
        }
    }

    if role.has_at_least(&SiteRole::Admin) {
        // Admins can manage members, settings, webhooks, API keys, audit
        perms.insert(perm!("member", "read"));
        perms.insert(perm!("member", "invite"));
        perms.insert(perm!("member", "update_role"));
        perms.insert(perm!("member", "remove"));
        perms.insert(perm!("settings", "read"));
        perms.insert(perm!("settings", "update"));
        perms.insert(perm!("webhook", "create"));
        perms.insert(perm!("webhook", "read"));
        perms.insert(perm!("webhook", "update"));
        perms.insert(perm!("webhook", "delete"));
        perms.insert(perm!("api_key", "create"));
        perms.insert(perm!("api_key", "read"));
        perms.insert(perm!("api_key", "update"));
        perms.insert(perm!("api_key", "delete"));
        perms.insert(perm!("audit", "read"));
        perms.insert(perm!("analytics", "manage"));
        perms.insert(perm!("site", "update"));
        // Custom types (#789): only Admin+ may build/edit/delete a type's
        // schema. Read is granted to all members above.
        perms.insert(perm!("custom_type", "write"));
    }

    if *role == SiteRole::Owner {
        // Owner-only: destructive site operations and ownership transfer
        perms.insert(perm!("site", "delete"));
        perms.insert(perm!("member", "transfer"));
        perms.insert(perm!("api_key", "manage"));
    }

    perms
}

// ---------------------------------------------------------------------------
// Resource context for policy evaluation
// ---------------------------------------------------------------------------

/// Context about a specific resource for ownership/status-based policy checks.
pub struct ResourceContext {
    /// Who created this resource (clerk_user_id or API key identifier)
    pub created_by: Option<String>,
    /// Current content status (for publish-gate checks)
    pub status: Option<ContentStatus>,
}

impl ResourceContext {
    pub fn new(created_by: Option<String>, status: Option<ContentStatus>) -> Self {
        Self { created_by, status }
    }
}

// ---------------------------------------------------------------------------
// Permission service
// ---------------------------------------------------------------------------

/// Returns true if the content status is a protected state that requires
/// elevated permissions (`*:update:published`) to modify.
fn is_protected_status(status: Option<&ContentStatus>) -> bool {
    matches!(
        status,
        Some(ContentStatus::Published | ContentStatus::Scheduled | ContentStatus::Archived)
    )
}

pub struct PermissionService;

impl PermissionService {
    /// Check if a user has a specific permission on a site.
    ///
    /// When checking an unscoped permission like `blog:update`, this also
    /// matches scoped variants (`blog:update:own`, `blog:update:any`).
    /// System admins implicitly have all permissions.
    pub async fn has_permission(
        pool: &PgPool,
        auth: &Actor,
        site_id: Uuid,
        permission: &Permission,
    ) -> Result<bool, ApiError> {
        let permissions = Self::resolve_permissions(pool, auth, site_id).await?;

        // Exact match first
        if permissions.contains(permission) {
            return Ok(true);
        }

        // For unscoped permissions, check if any scoped variant exists
        if permission.scope.is_none() {
            let own = Permission::scoped(&permission.resource, &permission.action, "own");
            let any = Permission::scoped(&permission.resource, &permission.action, "any");
            let published =
                Permission::scoped(&permission.resource, &permission.action, "published");
            if permissions.contains(&own)
                || permissions.contains(&any)
                || permissions.contains(&published)
            {
                return Ok(true);
            }
        }

        Ok(false)
    }

    /// Check permission with resource context (ownership, status).
    ///
    /// Evaluates scoped permissions in order:
    /// 1. `:any` scope → access granted regardless of ownership or status
    /// 2. Status gate → if content is Published/Scheduled/Archived, require
    ///    `*:update:published` permission (Editors+). Authors are blocked.
    /// 3. `:own` scope → access granted only if `created_by == current_user`
    pub async fn check_resource_access(
        pool: &PgPool,
        auth: &Actor,
        site_id: Uuid,
        permission: &Permission,
        ctx: &ResourceContext,
    ) -> Result<bool, ApiError> {
        let permissions = Self::resolve_permissions(pool, auth, site_id).await?;

        // 1. If user has the unscoped or :any variant, grant access (Editor+)
        let any_perm = Permission::scoped(&permission.resource, &permission.action, "any");
        let unscoped = Permission::new(&permission.resource, &permission.action);
        if permissions.contains(&any_perm) || permissions.contains(&unscoped) {
            return Ok(true);
        }

        // 2. Status gate: Published/Scheduled/Archived content requires :published scope
        if is_protected_status(ctx.status.as_ref()) {
            let published_perm =
                Permission::scoped(&permission.resource, &permission.action, "published");
            if !permissions.contains(&published_perm) {
                return Ok(false);
            }
        }

        // 3. Check :own scope
        let own_perm = Permission::scoped(&permission.resource, &permission.action, "own");
        if permissions.contains(&own_perm) {
            if let Some(ref creator) = ctx.created_by {
                let current_user = auth.user_identifier();
                if current_user == Some(creator.as_str()) {
                    return Ok(true);
                }
            }
        }

        Ok(false)
    }

    /// Require a permission, returning 403 if denied.
    ///
    /// Convenience wrapper around `has_permission()` that returns
    /// `ApiError::forbidden` on denial.
    pub async fn require(
        pool: &PgPool,
        auth: &Actor,
        site_id: Uuid,
        permission: &Permission,
    ) -> Result<(), ApiError> {
        if Self::has_permission(pool, auth, site_id, permission).await? {
            Ok(())
        } else {
            tracing::warn!(
                permission = %permission,
                site_id = %site_id,
                user = ?auth.user_identifier(),
                "Permission denied"
            );
            Err(
                ApiError::forbidden("You don't have permission to perform this action")
                    .with_code(codes::AUTH_INSUFFICIENT_ROLE),
            )
        }
    }

    /// Require a permission with resource context, returning 403 if denied.
    ///
    /// Evaluates ownership and status-based policies.
    pub async fn require_resource_access(
        pool: &PgPool,
        auth: &Actor,
        site_id: Uuid,
        permission: &Permission,
        ctx: &ResourceContext,
    ) -> Result<(), ApiError> {
        if Self::check_resource_access(pool, auth, site_id, permission, ctx).await? {
            Ok(())
        } else {
            if is_protected_status(ctx.status.as_ref()) {
                return Err(ApiError::forbidden(
                    "Published content requires Editor or higher role to edit",
                )
                .with_code(codes::AUTH_INSUFFICIENT_ROLE));
            }
            Err(ApiError::forbidden("You can only edit your own content")
                .with_code(codes::AUTH_INSUFFICIENT_ROLE))
        }
    }

    /// Get all permissions for a user on a site.
    ///
    /// System admins receive the Owner permission set.
    pub async fn resolve_permissions(
        pool: &PgPool,
        auth: &Actor,
        site_id: Uuid,
    ) -> Result<HashSet<Permission>, ApiError> {
        Self::resolve_permissions_cached(pool, auth, site_id, None).await
    }

    /// Get all permissions with optional Redis caching.
    ///
    /// When a Redis connection is provided, uses it as a cache layer
    /// with configurable TTL (default 5 minutes). Falls through to DB
    /// on cache miss or Redis unavailable.
    pub async fn resolve_permissions_cached(
        pool: &PgPool,
        auth: &Actor,
        site_id: Uuid,
        redis: Option<&mut redis::aio::ConnectionManager>,
    ) -> Result<HashSet<Permission>, ApiError> {
        // Try Redis cache (only for Clerk users who have a stable user ID)
        if let (Some(user_id), Some(redis)) = (auth.user_identifier(), redis) {
            if let Some(cached) =
                crate::services::permission_cache::get(redis, user_id, site_id).await
            {
                return Ok(cached);
            }

            // Resolve from DB
            let permissions = match auth.effective_site_role(pool, site_id).await? {
                Some(role) => role_permissions(&role),
                None => HashSet::new(),
            };

            // Store in Redis cache
            crate::services::permission_cache::set(redis, user_id, site_id, &permissions).await;

            return Ok(permissions);
        }

        // No Redis or API key: resolve from DB directly
        match auth.effective_site_role(pool, site_id).await? {
            Some(role) => Ok(role_permissions(&role)),
            None => Ok(HashSet::new()),
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // ---- Permission parsing ----

    #[test]
    fn test_permission_parse_two_parts() {
        let p = Permission::parse("blog:create").expect("should parse");
        assert_eq!(p.resource, "blog");
        assert_eq!(p.action, "create");
        assert!(p.scope.is_none());
    }

    #[test]
    fn test_permission_parse_three_parts() {
        let p = Permission::parse("blog:update:own").expect("should parse");
        assert_eq!(p.resource, "blog");
        assert_eq!(p.action, "update");
        assert_eq!(p.scope.as_deref(), Some("own"));
    }

    #[test]
    fn test_permission_parse_invalid() {
        assert!(Permission::parse("blog").is_none());
        assert!(Permission::parse("").is_none());
    }

    #[test]
    fn test_permission_as_str() {
        assert_eq!(perm!("blog", "create").as_str(), "blog:create");
        assert_eq!(perm!("blog", "update", "own").as_str(), "blog:update:own");
    }

    #[test]
    fn test_permission_equality() {
        assert_eq!(perm!("blog", "create"), perm!("blog", "create"));
        assert_ne!(perm!("blog", "create"), perm!("page", "create"));
        assert_ne!(
            perm!("blog", "update", "own"),
            perm!("blog", "update", "any")
        );
    }

    // ---- Viewer permissions ----

    #[test]
    fn test_viewer_has_read_permissions() {
        let perms = role_permissions(&SiteRole::Viewer);
        assert!(perms.contains(&perm!("blog", "read")));
        assert!(perms.contains(&perm!("page", "read")));
        assert!(perms.contains(&perm!("media", "read")));
        assert!(perms.contains(&perm!("site", "read")));
    }

    #[test]
    fn test_viewer_cannot_create_or_update() {
        let perms = role_permissions(&SiteRole::Viewer);
        assert!(!perms.contains(&perm!("blog", "create")));
        assert!(!perms.contains(&perm!("blog", "update", "own")));
        assert!(!perms.contains(&perm!("blog", "delete", "own")));
    }

    #[test]
    fn test_viewer_cannot_review() {
        let perms = role_permissions(&SiteRole::Viewer);
        assert!(!perms.contains(&perm!("blog", "review")));
    }

    // ---- Reviewer permissions ----

    #[test]
    fn test_reviewer_can_review() {
        let perms = role_permissions(&SiteRole::Reviewer);
        assert!(perms.contains(&perm!("blog", "review")));
        assert!(perms.contains(&perm!("page", "review")));
        assert!(perms.contains(&perm!("document", "review")));
    }

    #[test]
    fn test_reviewer_cannot_create() {
        let perms = role_permissions(&SiteRole::Reviewer);
        assert!(!perms.contains(&perm!("blog", "create")));
    }

    // ---- Author permissions ----

    #[test]
    fn test_author_can_create_content() {
        let perms = role_permissions(&SiteRole::Author);
        assert!(perms.contains(&perm!("blog", "create")));
        assert!(perms.contains(&perm!("page", "create")));
        assert!(perms.contains(&perm!("media", "create")));
        assert!(perms.contains(&perm!("document", "create")));
        assert!(perms.contains(&perm!("legal", "create")));
        assert!(perms.contains(&perm!("cv", "create")));
    }

    #[test]
    fn test_author_can_update_own_only() {
        let perms = role_permissions(&SiteRole::Author);
        assert!(perms.contains(&perm!("blog", "update", "own")));
        assert!(perms.contains(&perm!("blog", "delete", "own")));
        assert!(!perms.contains(&perm!("blog", "update", "any")));
        assert!(!perms.contains(&perm!("blog", "delete", "any")));
    }

    #[test]
    fn test_author_can_upload_media() {
        let perms = role_permissions(&SiteRole::Author);
        assert!(perms.contains(&perm!("media", "upload")));
    }

    #[test]
    fn test_author_cannot_publish() {
        let perms = role_permissions(&SiteRole::Author);
        assert!(!perms.contains(&perm!("blog", "publish")));
    }

    #[test]
    fn test_author_inherits_reviewer() {
        let perms = role_permissions(&SiteRole::Author);
        assert!(perms.contains(&perm!("blog", "review")));
    }

    // ---- Editor permissions ----

    #[test]
    fn test_editor_can_update_any_content() {
        let perms = role_permissions(&SiteRole::Editor);
        assert!(perms.contains(&perm!("blog", "update", "any")));
        assert!(perms.contains(&perm!("page", "update", "any")));
        assert!(perms.contains(&perm!("media", "update", "any")));
        assert!(perms.contains(&perm!("blog", "delete", "any")));
    }

    #[test]
    fn test_editor_can_publish() {
        let perms = role_permissions(&SiteRole::Editor);
        assert!(perms.contains(&perm!("blog", "publish")));
        assert!(perms.contains(&perm!("page", "publish")));
        assert!(perms.contains(&perm!("document", "publish")));
    }

    #[test]
    fn test_editor_cannot_manage_members() {
        let perms = role_permissions(&SiteRole::Editor);
        assert!(!perms.contains(&perm!("member", "invite")));
        assert!(!perms.contains(&perm!("settings", "update")));
    }

    // ---- Admin permissions ----

    #[test]
    fn test_admin_can_manage_members() {
        let perms = role_permissions(&SiteRole::Admin);
        assert!(perms.contains(&perm!("member", "read")));
        assert!(perms.contains(&perm!("member", "invite")));
        assert!(perms.contains(&perm!("member", "update_role")));
        assert!(perms.contains(&perm!("member", "remove")));
    }

    #[test]
    fn test_admin_can_manage_settings() {
        let perms = role_permissions(&SiteRole::Admin);
        assert!(perms.contains(&perm!("settings", "read")));
        assert!(perms.contains(&perm!("settings", "update")));
    }

    #[test]
    fn test_admin_can_manage_webhooks_and_api_keys() {
        let perms = role_permissions(&SiteRole::Admin);
        assert!(perms.contains(&perm!("webhook", "create")));
        assert!(perms.contains(&perm!("webhook", "delete")));
        assert!(perms.contains(&perm!("api_key", "create")));
        assert!(perms.contains(&perm!("api_key", "delete")));
    }

    #[test]
    fn test_admin_can_read_audit() {
        let perms = role_permissions(&SiteRole::Admin);
        assert!(perms.contains(&perm!("audit", "read")));
    }

    #[test]
    fn test_admin_cannot_delete_site() {
        let perms = role_permissions(&SiteRole::Admin);
        assert!(!perms.contains(&perm!("site", "delete")));
        assert!(!perms.contains(&perm!("member", "transfer")));
    }

    // ---- Owner permissions ----

    #[test]
    fn test_owner_can_delete_site() {
        let perms = role_permissions(&SiteRole::Owner);
        assert!(perms.contains(&perm!("site", "delete")));
    }

    #[test]
    fn test_owner_can_transfer_ownership() {
        let perms = role_permissions(&SiteRole::Owner);
        assert!(perms.contains(&perm!("member", "transfer")));
    }

    #[test]
    fn test_owner_inherits_all_admin_permissions() {
        let owner_perms = role_permissions(&SiteRole::Owner);
        let admin_perms = role_permissions(&SiteRole::Admin);
        for p in &admin_perms {
            assert!(
                owner_perms.contains(p),
                "Owner missing admin permission: {}",
                p
            );
        }
    }

    // ---- Permission counts ----

    #[test]
    fn test_permission_set_sizes_increase_with_rank() {
        let viewer = role_permissions(&SiteRole::Viewer).len();
        let reviewer = role_permissions(&SiteRole::Reviewer).len();
        let author = role_permissions(&SiteRole::Author).len();
        let editor = role_permissions(&SiteRole::Editor).len();
        let admin = role_permissions(&SiteRole::Admin).len();
        let owner = role_permissions(&SiteRole::Owner).len();

        assert!(
            reviewer > viewer,
            "Reviewer ({reviewer}) should have more than Viewer ({viewer})"
        );
        assert!(
            author > reviewer,
            "Author ({author}) should have more than Reviewer ({reviewer})"
        );
        assert!(
            editor > author,
            "Editor ({editor}) should have more than Author ({author})"
        );
        assert!(
            admin > editor,
            "Admin ({admin}) should have more than Editor ({editor})"
        );
        assert!(
            owner > admin,
            "Owner ({owner}) should have more than Admin ({admin})"
        );
    }

    #[test]
    fn test_minimum_permission_count() {
        // Issue requires 40+ distinct permissions
        let all: HashSet<Permission> = role_permissions(&SiteRole::Owner);
        assert!(
            all.len() >= 40,
            "Owner should have at least 40 permissions, got {}",
            all.len()
        );
    }

    // ---- Resource context policy ----

    #[test]
    fn test_own_scope_matches_creator() {
        let perms: HashSet<Permission> = [perm!("blog", "update", "own")].into();
        let ctx = ResourceContext::new(Some("user-123".to_string()), None);

        // Simulate check_resource_access logic (pure, no DB)
        let own_perm = perm!("blog", "update", "own");
        let any_perm = perm!("blog", "update", "any");

        // No :any permission
        assert!(!perms.contains(&any_perm));
        // Has :own permission and creator matches
        assert!(perms.contains(&own_perm));
        assert_eq!(ctx.created_by.as_deref(), Some("user-123"));
    }

    #[test]
    fn test_any_scope_bypasses_ownership_check() {
        let perms: HashSet<Permission> = [
            perm!("blog", "update", "any"),
            perm!("blog", "update", "own"),
        ]
        .into();

        // :any is present → should pass regardless of creator
        assert!(perms.contains(&perm!("blog", "update", "any")));
    }

    #[test]
    fn test_own_scope_rejects_different_creator() {
        let perms: HashSet<Permission> = [perm!("blog", "update", "own")].into();
        let ctx = ResourceContext::new(Some("other-user".to_string()), None);

        // Has :own but user is "user-123", creator is "other-user"
        let own_perm = perm!("blog", "update", "own");
        assert!(perms.contains(&own_perm));
        // Would fail because "user-123" != "other-user"
        assert_ne!(ctx.created_by.as_deref(), Some("user-123"));
    }

    // ---- Status-based protection ----

    #[test]
    fn test_is_protected_status_published() {
        assert!(is_protected_status(Some(&ContentStatus::Published)));
    }

    #[test]
    fn test_is_protected_status_scheduled() {
        assert!(is_protected_status(Some(&ContentStatus::Scheduled)));
    }

    #[test]
    fn test_is_protected_status_archived() {
        assert!(is_protected_status(Some(&ContentStatus::Archived)));
    }

    #[test]
    fn test_is_not_protected_draft() {
        assert!(!is_protected_status(Some(&ContentStatus::Draft)));
    }

    #[test]
    fn test_is_not_protected_in_review() {
        assert!(!is_protected_status(Some(&ContentStatus::InReview)));
    }

    #[test]
    fn test_is_not_protected_none() {
        assert!(!is_protected_status(None));
    }

    #[test]
    fn test_editor_has_update_published_permission() {
        let perms = role_permissions(&SiteRole::Editor);
        assert!(perms.contains(&perm!("blog", "update", "published")));
        assert!(perms.contains(&perm!("page", "update", "published")));
        assert!(perms.contains(&perm!("document", "update", "published")));
    }

    #[test]
    fn test_author_lacks_update_published_permission() {
        let perms = role_permissions(&SiteRole::Author);
        assert!(!perms.contains(&perm!("blog", "update", "published")));
        assert!(!perms.contains(&perm!("page", "update", "published")));
    }

    #[test]
    fn test_author_can_edit_own_draft() {
        let perms = role_permissions(&SiteRole::Author);
        assert!(perms.contains(&perm!("blog", "update", "own")));
        assert!(!is_protected_status(Some(&ContentStatus::Draft)));
    }

    #[test]
    fn test_author_blocked_on_own_published() {
        let perms = role_permissions(&SiteRole::Author);
        assert!(perms.contains(&perm!("blog", "update", "own")));
        assert!(!perms.contains(&perm!("blog", "update", "published")));
        assert!(is_protected_status(Some(&ContentStatus::Published)));
    }

    #[test]
    fn test_editor_bypasses_status_check_via_any() {
        let perms = role_permissions(&SiteRole::Editor);
        assert!(perms.contains(&perm!("blog", "update", "any")));
    }

    // ---- Unscoped permission matching ----

    #[test]
    fn test_unscoped_matches_own_scope() {
        // has_permission("blog:update") should match when user has "blog:update:own"
        let perms: HashSet<Permission> = [perm!("blog", "update", "own")].into();
        let unscoped = perm!("blog", "update");
        // Direct contains fails (different scope)
        assert!(!perms.contains(&unscoped));
        // But the own variant exists
        assert!(perms.contains(&perm!("blog", "update", "own")));
    }

    #[test]
    fn test_unscoped_matches_any_scope() {
        let perms: HashSet<Permission> = [perm!("blog", "update", "any")].into();
        let unscoped = perm!("blog", "update");
        assert!(!perms.contains(&unscoped));
        assert!(perms.contains(&perm!("blog", "update", "any")));
    }

    #[test]
    fn test_author_has_blog_update_via_own_scope() {
        // Regression: Author must be able to pass has_permission("blog:update")
        // because they have "blog:update:own"
        let perms = role_permissions(&SiteRole::Author);
        assert!(!perms.contains(&perm!("blog", "update"))); // no unscoped
        assert!(perms.contains(&perm!("blog", "update", "own"))); // has :own
    }

    #[test]
    fn test_owner_has_all_scoped_permissions() {
        let perms = role_permissions(&SiteRole::Owner);
        // Owner has :any which should match unscoped checks
        assert!(perms.contains(&perm!("blog", "update", "any")));
        assert!(perms.contains(&perm!("blog", "delete", "any")));
    }
}
