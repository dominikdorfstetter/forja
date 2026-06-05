//! HTTP-level integration tests against the full Axum router + a real
//! `forja_test` PostgreSQL database.
//!
//! These cover the request/response surface that lib unit tests can't:
//! the assembled middleware chain, RFC 7807 error envelope, OpenAPI
//! split, and the auth gate. Per-feature CRUD coverage lives in the
//! lib-side bundle tests; this file is the cross-cutting smoke test.
//!
//! ## Prereq
//!
//! ```bash
//! psql -U forja -h localhost -c "CREATE DATABASE forja_test;"
//! TEST_DATABASE_URL="postgres://forja:forja@localhost:5432/forja_test" \
//!   cargo test --test integration_tests
//! ```
//!
//! Tests use `serial_test` because they share one database; running in
//! parallel would race on `cleanup_test_data`.

mod common;

use common::{
    cleanup_test_data, create_test_api_key, create_test_site, test_context, test_context_demo,
    test_db_pool,
};
use forja::models::api_key::ApiKeyPermission;
use forja::models::site_membership::{SiteMembership, SiteRole};
use serial_test::serial;
use sqlx::Row;
use uuid::Uuid;

// ── Health check ────────────────────────────────────────────────────────

#[tokio::test]
#[serial]
async fn health_check_returns_status_with_db_up() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let resp = ctx.server.get("/health").await;
    resp.assert_status_ok();

    let body: serde_json::Value = resp.json();
    let status = body["status"].as_str().expect("status field");
    assert!(
        status == "healthy" || status == "degraded",
        "expected healthy/degraded, got {status}"
    );
    let services = body["services"].as_array().expect("services array");
    let db = services
        .iter()
        .find(|s| s["name"] == "database")
        .expect("database in services");
    assert_eq!(db["status"], "up");
}

// ── Public endpoints (no auth required) ─────────────────────────────────

#[tokio::test]
#[serial]
async fn config_endpoint_returns_app_metadata() {
    let ctx = test_context().await;

    let resp = ctx.server.get("/api/v1/config").await;
    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    assert_eq!(body["app_name"], "Forja");
}

// ── Auth gate ───────────────────────────────────────────────────────────

#[tokio::test]
#[serial]
async fn no_credentials_returns_401() {
    let ctx = test_context().await;

    let resp = ctx.server.get("/api/v1/sites").await;
    assert_eq!(resp.status_code(), 401);
}

#[tokio::test]
#[serial]
async fn bogus_api_key_returns_401() {
    let ctx = test_context().await;

    let resp = ctx
        .server
        .get("/api/v1/sites")
        .add_header("x-api-key", "fk_bogus_keyvalue1234567890")
        .await;
    assert_eq!(resp.status_code(), 401);
}

#[tokio::test]
#[serial]
async fn valid_read_key_returns_200_on_sites() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;
    let site_id = create_test_site(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get("/api/v1/sites")
        .add_header("x-api-key", key.as_str())
        .await;
    resp.assert_status_ok();
}

// ── Public-read endpoints must honor their declared api_key auth (#855) ──
//
// The global environment + locale catalog reads advertise
// `security(("api_key" = []))` + a 401 in their OpenAPI annotation. During
// the Rocket->Axum port the guard argument was dropped, leaving them
// silently public. These lock the contract: no credentials → 401, valid
// key → 200.

#[tokio::test]
#[serial]
async fn environments_list_requires_auth() {
    let ctx = test_context().await;
    let resp = ctx.server.get("/api/v1/environments").await;
    assert_eq!(resp.status_code(), 401);
}

#[tokio::test]
#[serial]
async fn environment_by_id_requires_auth() {
    let ctx = test_context().await;
    // Auth is checked before the DB lookup, so a random id still 401s.
    let resp = ctx
        .server
        .get(&format!("/api/v1/environments/{}", Uuid::new_v4()))
        .await;
    assert_eq!(resp.status_code(), 401);
}

#[tokio::test]
#[serial]
async fn default_environment_requires_auth() {
    let ctx = test_context().await;
    let resp = ctx.server.get("/api/v1/environments/default").await;
    assert_eq!(resp.status_code(), 401);
}

#[tokio::test]
#[serial]
async fn locales_list_requires_auth() {
    let ctx = test_context().await;
    let resp = ctx.server.get("/api/v1/locales").await;
    assert_eq!(resp.status_code(), 401);
}

#[tokio::test]
#[serial]
async fn locale_by_id_requires_auth() {
    let ctx = test_context().await;
    let resp = ctx
        .server
        .get(&format!("/api/v1/locales/{}", Uuid::new_v4()))
        .await;
    assert_eq!(resp.status_code(), 401);
}

#[tokio::test]
#[serial]
async fn locale_by_code_requires_auth() {
    let ctx = test_context().await;
    let resp = ctx.server.get("/api/v1/locales/by-code/en").await;
    assert_eq!(resp.status_code(), 401);
}

/// Regression guard for the fix: `ReadKey` is the minimal correct gate —
/// any valid key (here a site-scoped Read key) must still read the global
/// catalogs. Catches an accidental over-tightening to Admin/Master.
#[tokio::test]
#[serial]
async fn public_catalogs_accept_valid_read_key() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;
    let site_id = create_test_site(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let envs = ctx
        .server
        .get("/api/v1/environments")
        .add_header("x-api-key", key.as_str())
        .await;
    envs.assert_status_ok();

    let locales = ctx
        .server
        .get("/api/v1/locales")
        .add_header("x-api-key", key.as_str())
        .await;
    locales.assert_status_ok();
}

// ── Error envelope (RFC 7807 ProblemDetails) ────────────────────────────

#[tokio::test]
#[serial]
async fn unknown_route_returns_problem_details_404() {
    let ctx = test_context().await;

    let resp = ctx.server.get("/api/v1/this-route-does-not-exist").await;
    assert_eq!(resp.status_code(), 404);
    let body: serde_json::Value = resp.json();
    assert_eq!(body["status"], 404);
    assert_eq!(body["code"], "NOT_FOUND");
    assert!(
        body["type"]
            .as_str()
            .is_some_and(|t| t.contains("not_found")),
        "type should reference not_found, got {body:?}"
    );
}

#[tokio::test]
#[serial]
async fn no_credentials_returns_problem_details_shape() {
    let ctx = test_context().await;

    let resp = ctx.server.get("/api/v1/sites").await;
    assert_eq!(resp.status_code(), 401);
    let body: serde_json::Value = resp.json();
    assert_eq!(body["status"], 401);
    assert!(body["title"].as_str().is_some());
    assert!(body["code"].as_str().is_some());
    // The "type" URI is required by RFC 7807.
    assert!(body["type"].as_str().is_some());
}

// ── OpenAPI split ───────────────────────────────────────────────────────

#[tokio::test]
#[serial]
async fn consumer_openapi_serves_filtered_spec() {
    let ctx = test_context().await;

    let resp = ctx.server.get("/api-docs/consumer/openapi.json").await;
    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    assert_eq!(body["info"]["title"], "Forja Consumer API");
    let paths = body["paths"].as_object().expect("paths object");
    // Sanity: a known consumer path is in, a known admin-only one isn't.
    assert!(
        paths.contains_key("/api/v1/sites/{slug}/sitemap.xml"),
        "consumer should expose sitemap.xml"
    );
    assert!(
        !paths.contains_key("/api/v1/sites/{site_id}/webhooks"),
        "consumer should NOT expose webhook CRUD"
    );
}

#[tokio::test]
#[serial]
async fn admin_openapi_requires_session() {
    let ctx = test_context().await;

    let resp = ctx.server.get("/api-docs/admin/openapi.json").await;
    assert_eq!(resp.status_code(), 403);
}

// ── Security headers (single sample — the rest are unit-tested) ─────────

#[tokio::test]
#[serial]
async fn responses_include_static_security_headers() {
    let ctx = test_context().await;

    let resp = ctx.server.get("/health").await;
    let headers = resp.headers();
    assert_eq!(
        headers
            .get("x-content-type-options")
            .and_then(|v| v.to_str().ok()),
        Some("nosniff")
    );
    assert!(
        headers.contains_key("strict-transport-security"),
        "HSTS header missing"
    );
    // CSP fallback should be set on /health since the handler doesn't set its own.
    assert!(
        headers.contains_key("content-security-policy"),
        "CSP header missing"
    );
}

// ── Local file server (for media URLs that route through /uploads) ──────

#[tokio::test]
#[serial]
async fn missing_local_upload_returns_404() {
    let ctx = test_context().await;

    // The temp upload dir is empty for fresh tests, so any path 404s.
    // What we're locking in: the /uploads/* mount exists and ServeDir
    // returns a normal 404 (not a routing miss). A routing miss would
    // come back as our ProblemDetails 404; ServeDir returns plain text.
    let resp = ctx.server.get("/uploads/does-not-exist.png").await;
    assert_eq!(resp.status_code(), 404);
}

// ── Demo guest token ────────────────────────────────────────────────────

#[tokio::test]
#[serial]
async fn guest_token_demo_mode_returns_usable_key() {
    let ctx = test_context_demo().await;
    cleanup_test_data(&ctx.pool).await;

    // Create the demo site that the handler looks for
    let demo_site_req = forja::dto::site::CreateSiteRequest {
        name: "John Forja".to_string(),
        slug: "john-forja".to_string(),
        description: Some("Demo site".to_string()),
        logo_url: None,
        favicon_url: None,
        base_url: None,
        theme: None,
        timezone: Some("UTC".to_string()),
        locales: None,
    };
    let _demo_site = forja::models::site::Site::create(&ctx.pool, demo_site_req, None)
        .await
        .expect("Failed to create demo site");

    // Step 1: Get the guest token
    let resp = ctx.server.get("/api/v1/auth/guest").await;
    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    let api_key = body["api_key"].as_str().expect("api_key field");

    // Key must not be the old compile-time constant
    assert_ne!(
        api_key, "dk_guest_demo0000000000000000000000000000",
        "guest key must not be the old hardcoded constant"
    );

    // Key must start with "dk_"
    assert!(
        api_key.starts_with("dk_"),
        "guest key must start with dk_ prefix"
    );

    assert_eq!(body["site_name"], "John Forja");
    assert_eq!(body["site_slug"], "john-forja");

    // Step 2: Use the key to read the demo site
    let sites_resp = ctx
        .server
        .get("/api/v1/sites")
        .add_header("x-api-key", api_key)
        .await;
    sites_resp.assert_status_ok();

    // Clean up guest key row for subsequent test isolation
    sqlx::query("DELETE FROM api_keys WHERE name = 'Demo Guest Key'")
        .execute(&ctx.pool)
        .await
        .ok();
}

#[tokio::test]
#[serial]
async fn guest_token_rejects_old_hardcoded_key() {
    let ctx = test_context_demo().await;
    cleanup_test_data(&ctx.pool).await;

    // Create the demo site
    let demo_site_req = forja::dto::site::CreateSiteRequest {
        name: "John Forja".to_string(),
        slug: "john-forja".to_string(),
        description: Some("Demo site".to_string()),
        logo_url: None,
        favicon_url: None,
        base_url: None,
        theme: None,
        timezone: Some("UTC".to_string()),
        locales: None,
    };
    forja::models::site::Site::create(&ctx.pool, demo_site_req, None)
        .await
        .expect("Failed to create demo site");

    // Get the real guest token first (this also inserts it into DB)
    let resp = ctx.server.get("/api/v1/auth/guest").await;
    resp.assert_status_ok();

    // The old hardcoded key must be rejected (it was hashed with SHA-256
    // but the DB now has an Argon2 hash)
    let old_key = "dk_guest_demo0000000000000000000000000000";
    let sites_resp = ctx
        .server
        .get("/api/v1/sites")
        .add_header("x-api-key", old_key)
        .await;
    assert_eq!(sites_resp.status_code(), 401);

    // Clean up
    sqlx::query("DELETE FROM api_keys WHERE name = 'Demo Guest Key'")
        .execute(&ctx.pool)
        .await
        .ok();
}

#[tokio::test]
#[serial]
async fn guest_token_disabled_when_demo_mode_off() {
    let ctx = test_context().await;

    let resp = ctx.server.get("/api/v1/auth/guest").await;
    assert_eq!(resp.status_code(), 404);
}

// ── Auth brute-force rate limiter ─────────────────────────────────────

/// Tracer bullet: valid request to auth endpoint passes through even with
/// the auth rate-limit middleware layer applied (no Redis in test → fail-open).
#[tokio::test]
#[serial]
async fn auth_rate_limit_passes_valid_request() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;
    let site_id = create_test_site(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let resp = ctx
        .server
        .get("/api/v1/auth/me")
        .add_header("x-api-key", key.as_str())
        .await;
    assert_eq!(resp.status_code(), 200);
}

/// Multiple invalid auth attempts still return 401 when rate limiter is
/// in fail-open mode (no Redis → counter bypass).
#[tokio::test]
#[serial]
async fn auth_rate_limit_invalid_returns_401_without_redis() {
    let ctx = test_context().await;

    for _ in 0..10 {
        let resp = ctx
            .server
            .get("/api/v1/auth/me")
            .add_header("x-api-key", "fk_bogus_keyvalue1234567890")
            .await;
        assert_eq!(resp.status_code(), 401);
    }
}

/// Non-auth paths are not affected by the auth rate-limit middleware.
#[tokio::test]
#[serial]
async fn auth_rate_limit_does_not_affect_non_auth_paths() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;
    let site_id = create_test_site(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    for _ in 0..10 {
        let resp = ctx
            .server
            .get("/api/v1/sites")
            .add_header("x-api-key", key.as_str())
            .await;
        assert_eq!(resp.status_code(), 200);
    }
}

/// Invalid auth returns ProblemDetails envelope (unchanged by middleware).
#[tokio::test]
#[serial]
async fn auth_rate_limit_invalid_returns_problem_details() {
    let ctx = test_context().await;

    let resp = ctx.server.get("/api/v1/auth/me").await;
    assert_eq!(resp.status_code(), 401);
    let body: serde_json::Value = resp.json();
    assert_eq!(body["status"], 401);
    assert!(body["title"].as_str().is_some());
    assert!(body["type"].as_str().is_some());
}

// ── Audit completeness: site ownership transfer (issue #830) ───────────────

/// Tracer bullet: transferring site ownership must leave an audit trail.
///
/// The handler can't be driven over HTTP from here — it requires a Clerk
/// principal and `ValidatedJson` is a sealed, in-crate-only type — so the
/// audited transfer lives in `site_membership_service`, which this exercises
/// directly. Lives in the CI-run `integration_tests` binary (the per-feature
/// `tests/*.rs` files are dev-only) because #830 is a security regression:
/// an unaudited ownership change must never silently ship again.
#[tokio::test]
#[serial]
async fn transfer_ownership_writes_audit_row() {
    let pool = test_db_pool().await;
    cleanup_test_data(&pool).await;
    let site_id = create_test_site(&pool).await;

    let old_owner = "user_old_owner_830";
    let new_owner = "user_new_owner_830";
    SiteMembership::create(&pool, old_owner, site_id, &SiteRole::Owner, None)
        .await
        .expect("seed old owner");
    SiteMembership::create(&pool, new_owner, site_id, &SiteRole::Admin, None)
        .await
        .expect("seed new owner");

    // The caller's stable principal id — recorded as the audit actor.
    let actor_id = Uuid::new_v4();

    forja::services::site_membership_service::transfer_ownership(
        &pool, site_id, actor_id, old_owner, new_owner,
    )
    .await
    .expect("audited transfer succeeds");

    // Regression: the role swap itself still happens.
    let promoted = SiteMembership::find_by_clerk_user_and_site(&pool, new_owner, site_id)
        .await
        .unwrap()
        .expect("new owner membership exists");
    assert_eq!(
        promoted.role,
        SiteRole::Owner,
        "new owner promoted to Owner"
    );
    let demoted = SiteMembership::find_by_clerk_user_and_site(&pool, old_owner, site_id)
        .await
        .unwrap()
        .expect("old owner membership exists");
    assert_eq!(demoted.role, SiteRole::Admin, "old owner demoted to Admin");

    // The fix: exactly one ownership_transfer audit row, keyed to the site,
    // carrying the actor and who-handed-off-to-whom.
    let rows = sqlx::query(
        "SELECT user_id, action::text, metadata FROM audit_logs \
         WHERE entity_type = 'site' AND entity_id = $1 AND action = 'ownership_transfer'",
    )
    .bind(site_id)
    .fetch_all(&pool)
    .await
    .expect("query audit rows");

    assert_eq!(
        rows.len(),
        1,
        "ownership transfer must write exactly one audit row"
    );
    let row = &rows[0];
    let recorded_actor: Option<Uuid> = row.get(0);
    assert_eq!(
        recorded_actor,
        Some(actor_id),
        "audit row records the transferring actor"
    );
    let action: String = row.get(1);
    assert_eq!(action, "ownership_transfer");
    let metadata: serde_json::Value = row.get(2);
    assert_eq!(metadata["previous_owner"], old_owner);
    assert_eq!(metadata["new_owner"], new_owner);
}

// ── Cross-tenant write guard: update_member_role (security) ────────────────

/// A site role update must not mutate a membership that belongs to a
/// *different* site, even when the caller is an Owner of the site named in
/// the path. The role UPDATE used to run unscoped and the cross-site check
/// happened *after* it committed, so an Owner of any throwaway site could
/// change (and escalate) a membership on someone else's site — unaudited.
///
/// Drives the real HTTP handler with an API key (Master → Owner clears
/// `member:update_role`), so it exercises the exact production path.
#[tokio::test]
#[serial]
async fn update_member_role_cannot_mutate_a_membership_on_another_site() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let attacker_site = create_test_site(&ctx.pool).await;
    let victim_site = create_test_site(&ctx.pool).await;

    // Victim membership lives on victim_site as a lowly Viewer.
    let victim_clerk = "user_victim_crosstenant";
    let victim = SiteMembership::create(
        &ctx.pool,
        victim_clerk,
        victim_site,
        &SiteRole::Viewer,
        None,
    )
    .await
    .expect("seed victim membership");

    // Attacker holds Owner-equivalent (Master) only on attacker_site.
    let key = create_test_api_key(&ctx.pool, attacker_site, ApiKeyPermission::Master).await;

    // Route the victim's member_id through the attacker's own site, asking
    // to promote them to Owner.
    let resp = ctx
        .server
        .put(&format!(
            "/api/v1/sites/{attacker_site}/members/{}/role",
            victim.id
        ))
        .add_header("x-api-key", key.as_str())
        .json(&serde_json::json!({ "role": "owner" }))
        .await;

    assert_eq!(
        resp.status_code(),
        404,
        "a member_id from another site must be rejected as not-found"
    );

    // The security invariant: the victim's role is untouched.
    let after = SiteMembership::find_by_clerk_user_and_site(&ctx.pool, victim_clerk, victim_site)
        .await
        .unwrap()
        .expect("victim membership still exists");
    assert_eq!(
        after.role,
        SiteRole::Viewer,
        "cross-site update must NOT mutate the victim's role"
    );

    // And nothing was audited against the victim membership.
    let audit_count: i64 = sqlx::query(
        "SELECT COUNT(*) FROM audit_logs WHERE entity_type = 'member' AND entity_id = $1",
    )
    .bind(victim.id)
    .fetch_one(&ctx.pool)
    .await
    .unwrap()
    .get(0);
    assert_eq!(
        audit_count, 0,
        "no audit row for a rejected cross-site update"
    );
}

// ── Audit completeness: self-leave (issue #830 sibling) ────────────────────

/// Tracer bullet: a self-leave must leave an audit trail. Like
/// `transfer_ownership`, `leave_site` is Clerk-gated and thus unreachable
/// from the API-key-only harness, so its audited form lives in
/// `site_membership_service` and is driven directly here in the CI binary.
#[tokio::test]
#[serial]
async fn leave_site_writes_delete_audit_row() {
    let pool = test_db_pool().await;
    cleanup_test_data(&pool).await;
    let site_id = create_test_site(&pool).await;

    // The site keeps an Owner; a non-owner Editor leaves.
    SiteMembership::create(&pool, "user_owner_keep", site_id, &SiteRole::Owner, None)
        .await
        .expect("seed owner");
    let leaver = SiteMembership::create(&pool, "user_leaver", site_id, &SiteRole::Editor, None)
        .await
        .expect("seed leaver");

    let actor_id = Uuid::new_v4();
    forja::services::site_membership_service::leave_site(&pool, site_id, actor_id, "user_leaver")
        .await
        .expect("leave succeeds");

    // Regression: the membership is actually gone.
    let gone = SiteMembership::find_by_clerk_user_and_site(&pool, "user_leaver", site_id)
        .await
        .unwrap();
    assert!(gone.is_none(), "leaver membership deleted");

    // The fix: exactly one delete audit row keyed to the membership, stamped
    // with the leaving actor.
    let rows = sqlx::query(
        "SELECT user_id FROM audit_logs \
         WHERE entity_type = 'member' AND entity_id = $1 AND action = 'delete'",
    )
    .bind(leaver.id)
    .fetch_all(&pool)
    .await
    .expect("query audit rows");
    assert_eq!(
        rows.len(),
        1,
        "self-leave must write exactly one delete audit row"
    );
    let recorded_actor: Option<Uuid> = rows[0].get(0);
    assert_eq!(
        recorded_actor,
        Some(actor_id),
        "audit row records the leaver"
    );
}

/// The Owner self-leave guard is preserved by the extraction: an Owner is
/// rejected, the membership survives, and nothing is audited.
#[tokio::test]
#[serial]
async fn leave_site_owner_is_rejected_and_not_audited() {
    let pool = test_db_pool().await;
    cleanup_test_data(&pool).await;
    let site_id = create_test_site(&pool).await;

    let owner = SiteMembership::create(&pool, "user_sole_owner", site_id, &SiteRole::Owner, None)
        .await
        .expect("seed owner");

    let err = forja::services::site_membership_service::leave_site(
        &pool,
        site_id,
        Uuid::new_v4(),
        "user_sole_owner",
    )
    .await
    .expect_err("owner self-leave must be rejected");
    assert_eq!(err.code(), "SITE_OWNER_CANNOT_LEAVE");

    // Membership survived.
    let still_there =
        SiteMembership::find_by_clerk_user_and_site(&pool, "user_sole_owner", site_id)
            .await
            .unwrap();
    assert!(
        still_there.is_some(),
        "owner membership must survive a rejected leave"
    );

    // Nothing audited.
    let audit_count: i64 = sqlx::query(
        "SELECT COUNT(*) FROM audit_logs WHERE entity_type = 'member' AND entity_id = $1",
    )
    .bind(owner.id)
    .fetch_one(&pool)
    .await
    .unwrap()
    .get(0);
    assert_eq!(audit_count, 0, "a rejected owner-leave writes no audit row");
}

// ── Audit coverage: HTTP-reachable membership mutations ────────────────────
//
// add/update/remove already audit inline and are drivable by the API-key
// harness, so a service extraction would be ceremony. These CI tests lock
// their audit rows against regression directly over HTTP instead — the
// coverage that was missing, without the refactor.

#[tokio::test]
#[serial]
async fn add_site_member_writes_create_audit_row() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;
    let site_id = create_test_site(&ctx.pool).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Master).await;

    let resp = ctx
        .server
        .post(&format!("/api/v1/sites/{site_id}/members"))
        .add_header("x-api-key", key.as_str())
        .json(&serde_json::json!({ "clerk_user_id": "user_added_member", "role": "editor" }))
        .await;
    assert_eq!(resp.status_code(), 201);
    let body: serde_json::Value = resp.json();
    let member_id = Uuid::parse_str(body["id"].as_str().expect("response carries member id"))
        .expect("member id is a uuid");

    let count: i64 = sqlx::query(
        "SELECT COUNT(*) FROM audit_logs \
         WHERE entity_type = 'member' AND entity_id = $1 AND action = 'create'",
    )
    .bind(member_id)
    .fetch_one(&ctx.pool)
    .await
    .unwrap()
    .get(0);
    assert_eq!(
        count, 1,
        "adding a member writes exactly one create audit row"
    );
}

#[tokio::test]
#[serial]
async fn update_member_role_writes_update_audit_row() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;
    let site_id = create_test_site(&ctx.pool).await;
    let target = SiteMembership::create(
        &ctx.pool,
        "user_role_target",
        site_id,
        &SiteRole::Viewer,
        None,
    )
    .await
    .expect("seed target member");
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Master).await;

    let resp = ctx
        .server
        .put(&format!(
            "/api/v1/sites/{site_id}/members/{}/role",
            target.id
        ))
        .add_header("x-api-key", key.as_str())
        .json(&serde_json::json!({ "role": "editor" }))
        .await;
    assert_eq!(resp.status_code(), 200);

    let rows = sqlx::query(
        "SELECT metadata FROM audit_logs \
         WHERE entity_type = 'member' AND entity_id = $1 AND action = 'update'",
    )
    .bind(target.id)
    .fetch_all(&ctx.pool)
    .await
    .unwrap();
    assert_eq!(
        rows.len(),
        1,
        "a role update writes exactly one update audit row"
    );
    let metadata: serde_json::Value = rows[0].get(0);
    assert_eq!(
        metadata["new_role"], "Editor",
        "audit metadata records the new role"
    );
}

#[tokio::test]
#[serial]
async fn remove_site_member_writes_delete_audit_row() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;
    let site_id = create_test_site(&ctx.pool).await;
    let target = SiteMembership::create(
        &ctx.pool,
        "user_remove_target",
        site_id,
        &SiteRole::Author,
        None,
    )
    .await
    .expect("seed target member");
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Master).await;

    let resp = ctx
        .server
        .delete(&format!("/api/v1/sites/{site_id}/members/{}", target.id))
        .add_header("x-api-key", key.as_str())
        .await;
    assert_eq!(resp.status_code(), 204);

    let count: i64 = sqlx::query(
        "SELECT COUNT(*) FROM audit_logs \
         WHERE entity_type = 'member' AND entity_id = $1 AND action = 'delete'",
    )
    .bind(target.id)
    .fetch_one(&ctx.pool)
    .await
    .unwrap()
    .get(0);
    assert_eq!(
        count, 1,
        "removing a member writes exactly one delete audit row"
    );
}
