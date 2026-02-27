//! HTTP-level integration tests
//!
//! These tests exercise the full Rocket server stack (routing, auth guards,
//! database queries, error responses) against a real `openyapper_test`
//! PostgreSQL database.
//!
//! # Prerequisites
//!
//! ```bash
//! # Create the test database (one-time)
//! psql -U openyapper -h localhost -c "CREATE DATABASE openyapper_test;"
//!
//! # Run
//! cd backend
//! TEST_DATABASE_URL="postgres://openyapper:openyapper@localhost:5432/openyapper_test" \
//!   cargo test --test integration_tests
//! ```

mod common;

use common::{
    cleanup_test_data, create_test_api_key, create_test_notification, create_test_site,
    create_test_webhook, test_context,
};
use openyapper::models::api_key::ApiKeyPermission;
use rocket::http::{Header, Status};
use serial_test::serial;

// =========================================================================
// 1. Health check
// =========================================================================

#[rocket::async_test]
#[serial]
async fn test_health_check() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let response = ctx.client.get("/health").dispatch().await;
    assert_eq!(response.status(), Status::Ok);

    let body: serde_json::Value = response.into_json().await.expect("valid JSON");
    assert!(
        body["status"] == "healthy" || body["status"] == "degraded",
        "Expected healthy or degraded, got: {}",
        body["status"]
    );

    // Database must be up
    let services = body["services"].as_array().expect("services array");
    let db_service = services
        .iter()
        .find(|s| s["name"] == "database")
        .expect("database service in health response");
    assert_eq!(db_service["status"], "up");
}

// =========================================================================
// 2. Config endpoint (no auth)
// =========================================================================

#[rocket::async_test]
#[serial]
async fn test_config_endpoint() {
    let ctx = test_context().await;

    let response = ctx.client.get("/api/v1/config").dispatch().await;
    assert_eq!(response.status(), Status::Ok);

    let body: serde_json::Value = response.into_json().await.expect("valid JSON");
    assert_eq!(body["app_name"], "OpenYapper");
}

// =========================================================================
// 3. No auth → 401
// =========================================================================

#[rocket::async_test]
#[serial]
async fn test_no_auth_returns_401() {
    let ctx = test_context().await;

    let response = ctx.client.get("/api/v1/sites").dispatch().await;
    assert_eq!(response.status(), Status::Unauthorized);
}

// =========================================================================
// 4. Invalid API key → 401
// =========================================================================

#[rocket::async_test]
#[serial]
async fn test_invalid_key_returns_401() {
    let ctx = test_context().await;

    let response = ctx
        .client
        .get("/api/v1/sites")
        .header(Header::new("X-API-Key", "oy_bogus_keyvalue12345"))
        .dispatch()
        .await;

    assert_eq!(response.status(), Status::Unauthorized);
}

// =========================================================================
// 5. Site list → get → update
// =========================================================================

#[rocket::async_test]
#[serial]
async fn test_site_list_get_update() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    // Create a site + master API key directly in DB
    let site_id = create_test_site(&ctx.pool).await;
    let master_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Master).await;

    // --- List sites ---
    let response = ctx
        .client
        .get("/api/v1/sites")
        .header(Header::new("X-API-Key", master_key.clone()))
        .dispatch()
        .await;
    assert_eq!(response.status(), Status::Ok);

    let sites: serde_json::Value = response.into_json().await.expect("valid JSON");
    let sites_arr = sites.as_array().expect("sites array");
    assert!(
        sites_arr.iter().any(|s| s["id"] == site_id.to_string()),
        "Created site must appear in list"
    );

    // --- Get site by ID ---
    let response = ctx
        .client
        .get(format!("/api/v1/sites/{}", site_id))
        .header(Header::new("X-API-Key", master_key.clone()))
        .dispatch()
        .await;
    assert_eq!(response.status(), Status::Ok);

    let site: serde_json::Value = response.into_json().await.expect("valid JSON");
    assert_eq!(site["id"], site_id.to_string());
    assert!(site["is_active"].as_bool().unwrap());

    // --- Update site ---
    let update_body = serde_json::json!({
        "name": "Updated Integration Site",
        "description": "Updated by integration test"
    });

    let response = ctx
        .client
        .put(format!("/api/v1/sites/{}", site_id))
        .header(Header::new("X-API-Key", master_key.clone()))
        .header(Header::new("Content-Type", "application/json"))
        .body(update_body.to_string())
        .dispatch()
        .await;
    assert_eq!(response.status(), Status::Ok);

    let updated: serde_json::Value = response.into_json().await.expect("valid JSON");
    assert_eq!(updated["name"], "Updated Integration Site");
    assert_eq!(updated["description"], "Updated by integration test");
}

// =========================================================================
// 6. Site delete
// =========================================================================

#[rocket::async_test]
#[serial]
async fn test_site_delete() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let master_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Master).await;

    // Delete
    let response = ctx
        .client
        .delete(format!("/api/v1/sites/{}", site_id))
        .header(Header::new("X-API-Key", master_key.clone()))
        .dispatch()
        .await;
    assert_eq!(response.status(), Status::NoContent);

    // GET should return 404 (soft-deleted)
    let response = ctx
        .client
        .get(format!("/api/v1/sites/{}", site_id))
        .header(Header::new("X-API-Key", master_key.clone()))
        .dispatch()
        .await;
    assert_eq!(response.status(), Status::NotFound);
}

// =========================================================================
// 7. Blog CRUD
// =========================================================================

#[rocket::async_test]
#[serial]
async fn test_blog_crud() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;

    // --- Create blog ---
    let create_body = serde_json::json!({
        "slug": "integration-test-blog",
        "author": "Test Author",
        "published_date": "2025-01-15",
        "site_ids": [site_id],
        "status": "Draft"
    });

    let response = ctx
        .client
        .post("/api/v1/blogs")
        .header(Header::new("X-API-Key", write_key.clone()))
        .header(Header::new("Content-Type", "application/json"))
        .body(create_body.to_string())
        .dispatch()
        .await;
    assert_eq!(
        response.status(),
        Status::Created,
        "create_blog should return 201"
    );

    let blog: serde_json::Value = response.into_json().await.expect("valid JSON");
    let blog_id = blog["id"].as_str().expect("blog id").to_string();
    assert_eq!(blog["slug"], "integration-test-blog");

    // --- List blogs for site ---
    let response = ctx
        .client
        .get(format!("/api/v1/sites/{}/blogs", site_id))
        .header(Header::new("X-API-Key", write_key.clone()))
        .dispatch()
        .await;
    assert_eq!(response.status(), Status::Ok);

    let list: serde_json::Value = response.into_json().await.expect("valid JSON");
    assert!(
        list["data"].as_array().expect("data array").len() >= 1,
        "Blog list must contain at least the created blog"
    );

    // --- Get blog by ID ---
    let response = ctx
        .client
        .get(format!("/api/v1/blogs/{}", blog_id))
        .header(Header::new("X-API-Key", write_key.clone()))
        .dispatch()
        .await;
    assert_eq!(response.status(), Status::Ok);

    let fetched: serde_json::Value = response.into_json().await.expect("valid JSON");
    assert_eq!(fetched["slug"], "integration-test-blog");

    // --- Update blog ---
    let update_body = serde_json::json!({
        "author": "Updated Author"
    });

    let response = ctx
        .client
        .put(format!("/api/v1/blogs/{}", blog_id))
        .header(Header::new("X-API-Key", write_key.clone()))
        .header(Header::new("Content-Type", "application/json"))
        .body(update_body.to_string())
        .dispatch()
        .await;
    assert_eq!(response.status(), Status::Ok);

    let updated: serde_json::Value = response.into_json().await.expect("valid JSON");
    assert_eq!(updated["author"], "Updated Author");

    // --- Delete blog ---
    let response = ctx
        .client
        .delete(format!("/api/v1/blogs/{}", blog_id))
        .header(Header::new("X-API-Key", write_key.clone()))
        .dispatch()
        .await;
    assert_eq!(response.status(), Status::NoContent);
}

// =========================================================================
// 8. Navigation menu & items
// =========================================================================

#[rocket::async_test]
#[serial]
async fn test_navigation_menu_and_items() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;

    // --- Create a navigation menu ---
    let menu_body = serde_json::json!({
        "slug": "test-primary",
        "description": "Primary navigation",
        "max_depth": 3
    });

    let response = ctx
        .client
        .post(format!("/api/v1/sites/{}/menus", site_id))
        .header(Header::new("X-API-Key", write_key.clone()))
        .header(Header::new("Content-Type", "application/json"))
        .body(menu_body.to_string())
        .dispatch()
        .await;
    assert_eq!(
        response.status(),
        Status::Created,
        "create_navigation_menu should return 201"
    );

    let menu: serde_json::Value = response.into_json().await.expect("valid JSON");
    let menu_id = menu["id"].as_str().expect("menu id").to_string();
    assert_eq!(menu["slug"], "test-primary");

    // --- List menus ---
    let response = ctx
        .client
        .get(format!("/api/v1/sites/{}/menus", site_id))
        .header(Header::new("X-API-Key", write_key.clone()))
        .dispatch()
        .await;
    assert_eq!(response.status(), Status::Ok);

    let menus: serde_json::Value = response.into_json().await.expect("valid JSON");
    let menus_arr = menus.as_array().expect("menus array");
    assert!(
        menus_arr.iter().any(|m| m["id"] == menu_id),
        "Created menu must appear in list"
    );

    // --- Create a navigation item in that menu ---
    let item_body = serde_json::json!({
        "menu_id": menu_id,
        "site_id": site_id,
        "external_url": "https://example.com/about",
        "display_order": 1
    });

    let response = ctx
        .client
        .post(format!("/api/v1/sites/{}/navigation", site_id))
        .header(Header::new("X-API-Key", write_key.clone()))
        .header(Header::new("Content-Type", "application/json"))
        .body(item_body.to_string())
        .dispatch()
        .await;
    assert_eq!(
        response.status(),
        Status::Created,
        "create_navigation_item should return 201"
    );

    // --- List items in the menu ---
    let response = ctx
        .client
        .get(format!("/api/v1/menus/{}/items", menu_id))
        .header(Header::new("X-API-Key", write_key.clone()))
        .dispatch()
        .await;
    assert_eq!(response.status(), Status::Ok);

    let items: serde_json::Value = response.into_json().await.expect("valid JSON");
    let items_arr = items.as_array().expect("navigation items array");
    assert!(
        !items_arr.is_empty(),
        "Menu items list must contain the created item"
    );
}

// =========================================================================
// 9. Validation → ProblemDetails
// =========================================================================

#[rocket::async_test]
#[serial]
async fn test_validation_returns_problem_details() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;

    // Send a blog creation request with missing required fields
    let bad_body = serde_json::json!({
        "slug": "",
        "author": "",
        "published_date": "2025-01-15",
        "site_ids": [site_id]
    });

    let response = ctx
        .client
        .post("/api/v1/blogs")
        .header(Header::new("X-API-Key", write_key.clone()))
        .header(Header::new("Content-Type", "application/json"))
        .body(bad_body.to_string())
        .dispatch()
        .await;

    // Expect 400 or 422 for validation errors
    let status = response.status().code;
    assert!(
        status == 400 || status == 422,
        "Expected 400 or 422, got {}",
        status
    );

    let body: serde_json::Value = response.into_json().await.expect("valid JSON");

    // RFC 7807 fields
    assert!(
        body.get("type").is_some(),
        "ProblemDetails must have 'type'"
    );
    assert!(
        body.get("title").is_some(),
        "ProblemDetails must have 'title'"
    );
    assert!(
        body.get("status").is_some(),
        "ProblemDetails must have 'status'"
    );
}

// =========================================================================
// 10. Read key cannot create content
// =========================================================================

#[rocket::async_test]
#[serial]
async fn test_read_key_cannot_create() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let read_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let create_body = serde_json::json!({
        "slug": "unauthorized-blog",
        "author": "Nobody",
        "published_date": "2025-06-01",
        "site_ids": [site_id]
    });

    let response = ctx
        .client
        .post("/api/v1/blogs")
        .header(Header::new("X-API-Key", read_key.clone()))
        .header(Header::new("Content-Type", "application/json"))
        .body(create_body.to_string())
        .dispatch()
        .await;

    assert_eq!(
        response.status(),
        Status::Forbidden,
        "Read-only key must not be able to create blogs"
    );
}

// =========================================================================
// 11. Notification model — integration tests
// =========================================================================

#[rocket::async_test]
#[serial]
async fn test_notification_create() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let notification = create_test_notification(&ctx.pool, site_id, "clerk_user_001").await;

    assert_eq!(notification.site_id, site_id);
    assert_eq!(notification.recipient_clerk_id, "clerk_user_001");
    assert_eq!(notification.notification_type, "content_submitted");
    assert!(!notification.is_read);
    assert!(notification.read_at.is_none());
}

#[rocket::async_test]
#[serial]
async fn test_notification_find_for_user() {
    use openyapper::models::notification::Notification;

    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    create_test_notification(&ctx.pool, site_id, "clerk_user_a").await;
    create_test_notification(&ctx.pool, site_id, "clerk_user_a").await;
    create_test_notification(&ctx.pool, site_id, "clerk_user_b").await;

    let results = Notification::find_for_user(&ctx.pool, "clerk_user_a", site_id, 50, 0)
        .await
        .unwrap();
    assert_eq!(results.len(), 2);

    // Should NOT include clerk_user_b's notification
    assert!(results
        .iter()
        .all(|n| n.recipient_clerk_id == "clerk_user_a"));
}

#[rocket::async_test]
#[serial]
async fn test_notification_count_for_user() {
    use openyapper::models::notification::Notification;

    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    create_test_notification(&ctx.pool, site_id, "clerk_counter").await;
    create_test_notification(&ctx.pool, site_id, "clerk_counter").await;
    create_test_notification(&ctx.pool, site_id, "clerk_other").await;

    let count = Notification::count_for_user(&ctx.pool, "clerk_counter", site_id)
        .await
        .unwrap();
    assert_eq!(count, 2);
}

#[rocket::async_test]
#[serial]
async fn test_notification_count_unread() {
    use openyapper::models::notification::Notification;

    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let n1 = create_test_notification(&ctx.pool, site_id, "clerk_unread").await;
    create_test_notification(&ctx.pool, site_id, "clerk_unread").await;

    // Mark one as read
    Notification::mark_read(&ctx.pool, n1.id).await.unwrap();

    let unread = Notification::count_unread(&ctx.pool, "clerk_unread", site_id)
        .await
        .unwrap();
    assert_eq!(unread, 1);
}

#[rocket::async_test]
#[serial]
async fn test_notification_mark_read() {
    use openyapper::models::notification::Notification;

    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let n = create_test_notification(&ctx.pool, site_id, "clerk_read").await;
    assert!(!n.is_read);

    let updated = Notification::mark_read(&ctx.pool, n.id).await.unwrap();
    assert!(updated.is_read);
    assert!(updated.read_at.is_some());
}

#[rocket::async_test]
#[serial]
async fn test_notification_mark_all_read() {
    use openyapper::models::notification::Notification;

    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    create_test_notification(&ctx.pool, site_id, "clerk_bulk").await;
    create_test_notification(&ctx.pool, site_id, "clerk_bulk").await;
    create_test_notification(&ctx.pool, site_id, "clerk_bulk").await;

    let updated_count = Notification::mark_all_read(&ctx.pool, "clerk_bulk", site_id)
        .await
        .unwrap();
    assert_eq!(updated_count, 3);

    let unread = Notification::count_unread(&ctx.pool, "clerk_bulk", site_id)
        .await
        .unwrap();
    assert_eq!(unread, 0);
}

// =========================================================================
// 12. Webhook model — integration tests
// =========================================================================

#[rocket::async_test]
#[serial]
async fn test_webhook_create() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let webhook = create_test_webhook(&ctx.pool, site_id).await;

    assert_eq!(webhook.site_id, site_id);
    assert_eq!(webhook.url, "https://example.com/hook");
    assert!(webhook.is_active);
    assert_eq!(webhook.events.len(), 2);
}

#[rocket::async_test]
#[serial]
async fn test_webhook_find_by_id() {
    use openyapper::models::webhook::Webhook;

    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let created = create_test_webhook(&ctx.pool, site_id).await;

    let found = Webhook::find_by_id(&ctx.pool, created.id).await.unwrap();
    assert_eq!(found.id, created.id);
    assert_eq!(found.url, created.url);
}

#[rocket::async_test]
#[serial]
async fn test_webhook_find_all_for_site_paginated() {
    use openyapper::models::webhook::Webhook;

    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    create_test_webhook(&ctx.pool, site_id).await;
    create_test_webhook(&ctx.pool, site_id).await;
    create_test_webhook(&ctx.pool, site_id).await;

    // First page
    let page1 = Webhook::find_all_for_site(&ctx.pool, site_id, 2, 0)
        .await
        .unwrap();
    assert_eq!(page1.len(), 2);

    // Second page
    let page2 = Webhook::find_all_for_site(&ctx.pool, site_id, 2, 2)
        .await
        .unwrap();
    assert_eq!(page2.len(), 1);
}

#[rocket::async_test]
#[serial]
async fn test_webhook_find_active_for_site() {
    use openyapper::models::webhook::Webhook;

    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let w1 = create_test_webhook(&ctx.pool, site_id).await;
    create_test_webhook(&ctx.pool, site_id).await;

    // Deactivate one
    Webhook::update(&ctx.pool, w1.id, None, None, None, Some(false))
        .await
        .unwrap();

    let active = Webhook::find_active_for_site(&ctx.pool, site_id)
        .await
        .unwrap();
    assert_eq!(active.len(), 1);
}

#[rocket::async_test]
#[serial]
async fn test_webhook_update() {
    use openyapper::models::webhook::Webhook;

    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let webhook = create_test_webhook(&ctx.pool, site_id).await;

    let updated = Webhook::update(
        &ctx.pool,
        webhook.id,
        Some("https://updated.example.com/hook"),
        Some("Updated description"),
        None,
        Some(false),
    )
    .await
    .unwrap();

    assert_eq!(updated.url, "https://updated.example.com/hook");
    assert_eq!(updated.description.as_deref(), Some("Updated description"));
    assert!(!updated.is_active);
}

#[rocket::async_test]
#[serial]
async fn test_webhook_delete() {
    use openyapper::models::webhook::Webhook;

    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let webhook = create_test_webhook(&ctx.pool, site_id).await;

    Webhook::delete(&ctx.pool, webhook.id).await.unwrap();

    let result = Webhook::find_by_id(&ctx.pool, webhook.id).await;
    assert!(result.is_err());
}

#[rocket::async_test]
#[serial]
async fn test_webhook_delivery_create_and_find() {
    use openyapper::models::webhook::WebhookDelivery;

    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let webhook = create_test_webhook(&ctx.pool, site_id).await;

    let payload = serde_json::json!({"event": "blog.created", "entity_id": "123"});
    let delivery = WebhookDelivery::create(
        &ctx.pool,
        webhook.id,
        "blog.created",
        &payload,
        Some(200),
        Some("OK"),
        None,
        1,
    )
    .await
    .unwrap();

    assert_eq!(delivery.webhook_id, webhook.id);
    assert_eq!(delivery.status_code, Some(200));

    let deliveries = WebhookDelivery::find_for_webhook(&ctx.pool, webhook.id, 50, 0)
        .await
        .unwrap();
    assert_eq!(deliveries.len(), 1);
    assert_eq!(deliveries[0].id, delivery.id);
}

// =========================================================================
// 13. Site model — integration tests
// =========================================================================

#[rocket::async_test]
#[serial]
async fn test_site_create_defaults() {
    use openyapper::models::site::Site;

    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let site = Site::find_by_id(&ctx.pool, site_id).await.unwrap();

    assert!(site.is_active);
    assert!(!site.is_deleted);
    assert_eq!(site.timezone, "UTC");
}

#[rocket::async_test]
#[serial]
async fn test_site_find_by_id() {
    use openyapper::models::site::Site;

    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let site = Site::find_by_id(&ctx.pool, site_id).await.unwrap();
    assert_eq!(site.id, site_id);
}

#[rocket::async_test]
#[serial]
async fn test_site_find_by_slug() {
    use openyapper::models::site::Site;

    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let site = Site::find_by_id(&ctx.pool, site_id).await.unwrap();

    let found = Site::find_by_slug(&ctx.pool, &site.slug).await.unwrap();
    assert_eq!(found.id, site_id);
}

#[rocket::async_test]
#[serial]
async fn test_site_find_all_excludes_deleted() {
    use openyapper::models::site::Site;

    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site1_id = create_test_site(&ctx.pool).await;
    let site2_id = create_test_site(&ctx.pool).await;

    // Soft-delete site2
    Site::soft_delete(&ctx.pool, site2_id).await.unwrap();

    let all_sites = Site::find_all(&ctx.pool).await.unwrap();
    assert!(all_sites.iter().any(|s| s.id == site1_id));
    assert!(!all_sites.iter().any(|s| s.id == site2_id));
}

#[rocket::async_test]
#[serial]
async fn test_site_update() {
    use openyapper::dto::site::UpdateSiteRequest;
    use openyapper::models::site::Site;

    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let updated = Site::update(
        &ctx.pool,
        site_id,
        UpdateSiteRequest {
            name: Some("Renamed Site".to_string()),
            description: Some("New description".to_string()),
            slug: None,
            logo_url: None,
            favicon_url: None,
            theme: None,
            timezone: None,
            is_active: None,
        },
    )
    .await
    .unwrap();

    assert_eq!(updated.name, "Renamed Site");
    assert_eq!(updated.description.as_deref(), Some("New description"));
}

#[rocket::async_test]
#[serial]
async fn test_site_soft_delete_hides_from_find() {
    use openyapper::models::site::Site;

    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    Site::soft_delete(&ctx.pool, site_id).await.unwrap();

    let result = Site::find_by_id(&ctx.pool, site_id).await;
    assert!(result.is_err());
}

#[rocket::async_test]
#[serial]
async fn test_site_find_by_id_nonexistent() {
    use openyapper::models::site::Site;

    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let result = Site::find_by_id(&ctx.pool, uuid::Uuid::new_v4()).await;
    assert!(result.is_err());
}

// =========================================================================
// 14. Webhook CRUD via HTTP — handler integration tests
// =========================================================================

#[rocket::async_test]
#[serial]
async fn test_webhook_crud_lifecycle() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let admin_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Admin).await;

    // --- Create ---
    let create_body = serde_json::json!({
        "url": "https://hooks.example.com/receiver",
        "description": "Test webhook",
        "events": ["blog.created", "blog.updated"]
    });

    let response = ctx
        .client
        .post(format!("/api/v1/sites/{}/webhooks", site_id))
        .header(Header::new("X-API-Key", admin_key.clone()))
        .header(Header::new("Content-Type", "application/json"))
        .body(create_body.to_string())
        .dispatch()
        .await;
    assert_eq!(response.status(), Status::Created);

    let webhook: serde_json::Value = response.into_json().await.expect("valid JSON");
    let webhook_id = webhook["id"].as_str().expect("webhook id").to_string();
    assert_eq!(webhook["url"], "https://hooks.example.com/receiver");

    // --- List ---
    let response = ctx
        .client
        .get(format!("/api/v1/sites/{}/webhooks", site_id))
        .header(Header::new("X-API-Key", admin_key.clone()))
        .dispatch()
        .await;
    assert_eq!(response.status(), Status::Ok);

    let list: serde_json::Value = response.into_json().await.expect("valid JSON");
    assert!(list["data"].as_array().unwrap().len() >= 1);

    // --- Get ---
    let response = ctx
        .client
        .get(format!("/api/v1/webhooks/{}", webhook_id))
        .header(Header::new("X-API-Key", admin_key.clone()))
        .dispatch()
        .await;
    assert_eq!(response.status(), Status::Ok);

    // --- Update ---
    let update_body = serde_json::json!({
        "url": "https://hooks.example.com/updated",
        "is_active": false
    });
    let response = ctx
        .client
        .put(format!("/api/v1/webhooks/{}", webhook_id))
        .header(Header::new("X-API-Key", admin_key.clone()))
        .header(Header::new("Content-Type", "application/json"))
        .body(update_body.to_string())
        .dispatch()
        .await;
    assert_eq!(response.status(), Status::Ok);

    let updated: serde_json::Value = response.into_json().await.expect("valid JSON");
    assert_eq!(updated["url"], "https://hooks.example.com/updated");
    assert_eq!(updated["is_active"], false);

    // --- Delete ---
    let response = ctx
        .client
        .delete(format!("/api/v1/webhooks/{}", webhook_id))
        .header(Header::new("X-API-Key", admin_key.clone()))
        .dispatch()
        .await;
    assert_eq!(response.status(), Status::NoContent);
}

#[rocket::async_test]
#[serial]
async fn test_webhook_write_key_gets_403() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let write_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Write).await;

    let create_body = serde_json::json!({
        "url": "https://hooks.example.com/receiver",
        "events": ["blog.created"]
    });

    let response = ctx
        .client
        .post(format!("/api/v1/sites/{}/webhooks", site_id))
        .header(Header::new("X-API-Key", write_key.clone()))
        .header(Header::new("Content-Type", "application/json"))
        .body(create_body.to_string())
        .dispatch()
        .await;

    assert_eq!(
        response.status(),
        Status::Forbidden,
        "Write key should not be able to create webhooks (requires Admin)"
    );
}

#[rocket::async_test]
#[serial]
async fn test_webhook_deliveries_endpoint() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let admin_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Admin).await;

    // Create webhook directly in DB
    let webhook = create_test_webhook(&ctx.pool, site_id).await;

    // Create a delivery record
    openyapper::models::webhook::WebhookDelivery::create(
        &ctx.pool,
        webhook.id,
        "blog.created",
        &serde_json::json!({"test": true}),
        Some(200),
        Some("OK"),
        None,
        1,
    )
    .await
    .unwrap();

    let response = ctx
        .client
        .get(format!("/api/v1/webhooks/{}/deliveries", webhook.id))
        .header(Header::new("X-API-Key", admin_key.clone()))
        .dispatch()
        .await;
    assert_eq!(response.status(), Status::Ok);

    let body: serde_json::Value = response.into_json().await.expect("valid JSON");
    assert_eq!(body["data"].as_array().expect("data array").len(), 1);
    assert!(body["meta"]["total_items"].as_u64().unwrap_or(0) >= 1);
}

#[rocket::async_test]
#[serial]
async fn test_webhook_invalid_url_returns_error() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let admin_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Admin).await;

    let bad_body = serde_json::json!({
        "url": "not-a-valid-url",
        "events": ["blog.created"]
    });

    let response = ctx
        .client
        .post(format!("/api/v1/sites/{}/webhooks", site_id))
        .header(Header::new("X-API-Key", admin_key.clone()))
        .header(Header::new("Content-Type", "application/json"))
        .body(bad_body.to_string())
        .dispatch()
        .await;

    let status = response.status().code;
    assert!(
        status == 400 || status == 422,
        "Expected validation error (400/422), got {}",
        status
    );
}

// =========================================================================
// 15. Notification + auth — handler integration tests
// =========================================================================

#[rocket::async_test]
#[serial]
async fn test_notification_api_key_gets_403() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let read_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    // Notification endpoints require Clerk JWT, API key should get 403
    let response = ctx
        .client
        .get(format!("/api/v1/sites/{}/notifications", site_id))
        .header(Header::new("X-API-Key", read_key.clone()))
        .dispatch()
        .await;

    assert_eq!(
        response.status(),
        Status::Forbidden,
        "API key on notification endpoints should return 403"
    );
}

#[rocket::async_test]
#[serial]
async fn test_notification_unread_count_no_auth_returns_401() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;

    let response = ctx
        .client
        .get(format!(
            "/api/v1/sites/{}/notifications/unread-count",
            site_id
        ))
        .dispatch()
        .await;

    assert_eq!(response.status(), Status::Unauthorized);
}

#[rocket::async_test]
#[serial]
async fn test_site_members_with_master_key() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let master_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Master).await;

    let response = ctx
        .client
        .get(format!("/api/v1/sites/{}/members", site_id))
        .header(Header::new("X-API-Key", master_key.clone()))
        .dispatch()
        .await;

    // Should succeed (200) — empty list is fine
    assert_eq!(response.status(), Status::Ok);
}

#[rocket::async_test]
#[serial]
async fn test_site_members_read_key_cannot_add() {
    let ctx = test_context().await;
    cleanup_test_data(&ctx.pool).await;

    let site_id = create_test_site(&ctx.pool).await;
    let read_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    // Read key can list members (Viewer access), but cannot add members (requires Admin)
    let add_body = serde_json::json!({
        "clerk_user_id": "user_test_readonly",
        "role": "viewer"
    });

    let response = ctx
        .client
        .post(format!("/api/v1/sites/{}/members", site_id))
        .header(Header::new("X-API-Key", read_key.clone()))
        .header(Header::new("Content-Type", "application/json"))
        .body(add_body.to_string())
        .dispatch()
        .await;

    assert_eq!(
        response.status(),
        Status::Forbidden,
        "Read key should not be able to add site members"
    );
}
