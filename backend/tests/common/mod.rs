//! Test infrastructure for integration tests
//!
//! Provides helpers to spin up a real Rocket test client backed by an
//! `openyapper_test` PostgreSQL database.

#![allow(dead_code)]

use std::sync::Arc;

use rocket::local::asynchronous::Client;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tempfile::TempDir;
use uuid::Uuid;

use openyapper::config::{DatabaseConfig, SecurityConfig, Settings, StorageConfig};
use openyapper::models::api_key::{ApiKeyPermission, CreateApiKeyResult};
use openyapper::models::site::Site;
use openyapper::services::storage::LocalStorage;
use openyapper::AppState;

/// Everything a test function needs.
pub struct TestContext {
    pub client: Client,
    pub pool: PgPool,
    /// Kept alive so the temp directory isn't deleted until the test ends.
    pub _temp_dir: TempDir,
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

/// Connect to the `openyapper_test` database and run migrations.
pub async fn test_db_pool() -> PgPool {
    let db_url = std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
        "postgres://openyapper:openyapper@localhost:5432/openyapper_test".to_string()
    });

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .expect("Failed to connect to test database. Is openyapper_test created?");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations on test database");

    pool
}

// ---------------------------------------------------------------------------
// AppState builder
// ---------------------------------------------------------------------------

/// Build an `AppState` suitable for tests: real PgPool, local storage in a
/// temp directory, no Redis, no Clerk.
pub fn test_app_state(pool: PgPool, temp_dir: &TempDir) -> AppState {
    let upload_dir = temp_dir.path().to_string_lossy().to_string();

    let settings = Settings {
        database: DatabaseConfig {
            url: String::new(), // not used — pool is pre-built
            ..DatabaseConfig::default()
        },
        security: SecurityConfig::default(),
        storage: StorageConfig {
            provider: "local".to_string(),
            local_upload_dir: upload_dir.clone(),
            local_base_url: "/uploads".to_string(),
            ..StorageConfig::default()
        },
        ..Settings::default()
    };

    let storage: Arc<dyn openyapper::services::storage::StorageBackend> =
        Arc::new(LocalStorage::new(upload_dir, "/uploads".to_string()));

    AppState {
        db: pool,
        settings,
        redis: None,
        clerk_service: None,
        storage,
    }
}

// ---------------------------------------------------------------------------
// Rocket client
// ---------------------------------------------------------------------------

/// Build a fully-wired `TestContext` ready for HTTP assertions.
pub async fn test_context() -> TestContext {
    let pool = test_db_pool().await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let app_state = test_app_state(pool.clone(), &temp_dir);

    let rocket = rocket::build()
        .manage(app_state)
        .mount("/", openyapper::handlers::system::routes())
        .mount("/api/v1", openyapper::handlers::routes());

    let client = Client::tracked(rocket)
        .await
        .expect("Failed to create Rocket test client");

    TestContext {
        client,
        pool,
        _temp_dir: temp_dir,
    }
}

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

/// Insert a site directly via the model layer. Returns the site ID.
pub async fn create_test_site(pool: &PgPool) -> Uuid {
    let slug = format!("test-site-{}", &Uuid::new_v4().to_string()[..8]);
    let req = openyapper::dto::site::CreateSiteRequest {
        name: format!("Test Site {}", &slug),
        slug,
        description: Some("Integration test site".to_string()),
        logo_url: None,
        favicon_url: None,
        theme: None,
        timezone: Some("UTC".to_string()),
        locales: None,
    };

    let site = Site::create(pool, req, None)
        .await
        .expect("Failed to create test site");

    site.id
}

/// Insert an API key for the given site with the given permission level.
/// Returns the **plaintext** key string for use in `X-API-Key` headers.
pub async fn create_test_api_key(
    pool: &PgPool,
    site_id: Uuid,
    permission: ApiKeyPermission,
) -> String {
    let result: CreateApiKeyResult = openyapper::models::api_key::ApiKey::create(
        pool,
        &format!("test-{:?}-key", permission),
        Some("integration test key"),
        permission,
        site_id,
        None, // user_id
        None, // rate_limit_per_second
        None, // rate_limit_per_minute
        None, // rate_limit_per_hour
        None, // rate_limit_per_day
        None, // expires_at
        None, // created_by
    )
    .await
    .expect("Failed to create test API key");

    result.plaintext_key
}

/// Insert a test notification directly via the model layer.
pub async fn create_test_notification(
    pool: &PgPool,
    site_id: Uuid,
    recipient_clerk_id: &str,
) -> openyapper::models::notification::Notification {
    openyapper::models::notification::Notification::create(
        pool,
        site_id,
        recipient_clerk_id,
        Some("actor_clerk_001"),
        "content_submitted",
        "blog",
        Uuid::new_v4(),
        "Test notification",
        None,
    )
    .await
    .expect("Failed to create test notification")
}

/// Insert a test webhook directly via the model layer.
pub async fn create_test_webhook(
    pool: &PgPool,
    site_id: Uuid,
) -> openyapper::models::webhook::Webhook {
    openyapper::models::webhook::Webhook::create(
        pool,
        site_id,
        "https://example.com/hook",
        &Uuid::new_v4().to_string(),
        Some("Test webhook"),
        &["blog.created".to_string(), "blog.updated".to_string()],
    )
    .await
    .expect("Failed to create test webhook")
}

/// Truncate all data tables. Preserves migration-seeded reference data
/// (`environments`, `locales`, `entity_types`) by not truncating them.
pub async fn cleanup_test_data(pool: &PgPool) {
    sqlx::query(
        r#"
        TRUNCATE
            notifications,
            webhook_deliveries, webhooks, redirects,
            audit_logs, change_history,
            content_tags, content_categories,
            tag_localizations, tag_sites, tags,
            category_localizations, category_sites, categories,
            navigation_item_localizations, navigation_items,
            navigation_menu_localizations, navigation_menus,
            social_links,
            legal_item_localizations, legal_items,
            legal_group_localizations, legal_groups,
            legal_document_localizations, legal_documents,
            page_section_localizations, page_sections, pages,
            cv_entry_skills, cv_entry_localizations, cv_entries,
            skill_localizations, skill_sites, skills,
            blog_documents, document_localizations, documents, document_folders,
            blog_photos, blog_links, blog_attachments, blogs,
            content_blocks, content_localizations, content_versions,
            content_sites, contents,
            media_metadata, media_variants, media_sites, media_files,
            media_folders,
            api_key_ip_rules, api_key_usage_daily, api_key_usage, api_keys,
            system_admins, site_memberships,
            site_settings, site_locales, site_domains, sites
        CASCADE
        "#,
    )
    .execute(pool)
    .await
    .expect("Failed to truncate test data");
}
