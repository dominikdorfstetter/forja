//! Test infrastructure for integration tests.
//!
//! Spins up the full Axum router against a real `forja_test` PostgreSQL
//! database, served through `axum_test::TestServer`. No Redis, no Clerk,
//! local-only storage in a per-test temp directory.
//!
//! Prereq: `psql -U forja -h localhost -c "CREATE DATABASE forja_test;"`
//! and `TEST_DATABASE_URL` env var (CI sets it).

#![allow(dead_code)]

use std::sync::Arc;

use axum_test::TestServer;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tempfile::TempDir;
use uuid::Uuid;

use forja::config::{DatabaseConfig, SecurityConfig, Settings, StorageConfig};
use forja::models::api_key::{ApiKeyPermission, CreateApiKeyResult};
use forja::models::site::Site;
use forja::models::site_settings::SiteSetting;
use forja::services::storage::LocalStorage;
use forja::AppState;

/// Everything an integration test needs.
pub struct TestContext {
    pub server: TestServer,
    pub pool: PgPool,
    /// The same storage backend the router/workers use — lets tests seed
    /// media bytes and inspect worker-produced artifacts.
    pub storage: Arc<dyn forja::services::storage::StorageBackend>,
    /// Kept alive so the temp upload dir isn't dropped before the test ends.
    pub _temp_dir: TempDir,
}

pub async fn test_db_pool() -> PgPool {
    let db_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://forja:forja@localhost:5432/forja_test".to_string());

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .expect("Failed to connect to forja_test — is the DB created?");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations on test database");

    pool
}

fn test_app_state(pool: PgPool, temp_dir: &TempDir) -> AppState {
    let upload_dir = temp_dir.path().to_string_lossy().to_string();

    // 32-byte test key, base64-encoded. Used for HMAC signing of
    // private-document access tokens and server-side DEK wrapping in tests.
    // Stable across all integration tests so tokens can be verified across
    // the multiple TestServer instances inside a single test run.
    const TEST_DOCUMENT_KEY_B64: &str = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";

    let settings = Settings {
        database: DatabaseConfig {
            url: String::new(), // not used at runtime — pool is pre-built
            ..DatabaseConfig::default()
        },
        security: SecurityConfig {
            document_encryption_key: TEST_DOCUMENT_KEY_B64.to_string(),
            ..SecurityConfig::default()
        },
        storage: StorageConfig {
            provider: "local".to_string(),
            local_upload_dir: upload_dir.clone(),
            local_base_url: "/uploads".to_string(),
            ..StorageConfig::default()
        },
        ..Settings::default()
    };

    let storage: Arc<dyn forja::services::storage::StorageBackend> =
        Arc::new(LocalStorage::new(upload_dir, "/uploads".to_string()));

    AppState {
        db: pool,
        settings,
        redis: None,
        clerk_service: None,
        storage,
        clerk_jwks: None,
        dashboard_csp_template: Arc::from(""),
        demo_guest_key: std::sync::OnceLock::new(),
    }
}

/// Build a fully-wired `TestContext` — real Axum router, real DB pool,
/// temp local storage. The TestServer accepts the full router including
/// every middleware layer (security headers, CORS, rate-limit, etc.).
pub async fn test_context() -> TestContext {
    let pool = test_db_pool().await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let app_state = test_app_state(pool.clone(), &temp_dir);

    let storage = app_state.storage.clone();
    let router = forja::axum_app::build_router(app_state);
    let server = TestServer::new(router);

    TestContext {
        server,
        pool,
        storage,
        _temp_dir: temp_dir,
    }
}

/// Build a `TestContext` with demo mode enabled and a randomly-generated
/// demo guest key. The key is set on AppState before the router is built,
/// matching the boot-time generation in `main.rs`.
pub async fn test_context_demo() -> TestContext {
    let pool = test_db_pool().await;
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let mut app_state = test_app_state(pool.clone(), &temp_dir);
    app_state.settings.demo_mode = true;

    let (plaintext, _prefix, _hash, _version) = forja::models::api_key::ApiKey::generate_key();
    app_state
        .demo_guest_key
        .set(plaintext)
        .expect("demo_guest_key already set");

    let storage = app_state.storage.clone();
    let router = forja::axum_app::build_router(app_state);
    let server = TestServer::new(router);

    TestContext {
        server,
        pool,
        storage,
        _temp_dir: temp_dir,
    }
}

/// Wipe site-scoped tables. Test functions call this before assertions to
/// stay independent of order. Order: child → parent so FKs cascade.
pub async fn cleanup_test_data(pool: &PgPool) {
    let tables = ["api_key_usage", "api_keys", "site_memberships", "sites"];
    for table in tables {
        let _ = sqlx::query(&format!("DELETE FROM {table}"))
            .execute(pool)
            .await;
    }
}

pub async fn create_test_site(pool: &PgPool) -> Uuid {
    let slug = format!("test-site-{}", &Uuid::new_v4().to_string()[..8]);
    let req = forja::dto::site::CreateSiteRequest {
        name: format!("Test Site {}", &slug),
        slug,
        description: Some("Integration test site".to_string()),
        logo_url: None,
        favicon_url: None,
        base_url: None,
        theme: None,
        timezone: Some("UTC".to_string()),
        locales: None,
    };
    let site = Site::create(pool, req, None)
        .await
        .expect("Failed to create test site");
    site.id
}

/// Enable a content module for a test site by setting `module_<name>_enabled`.
///
/// Modules like `portfolio`, `forms`, `legal`, etc. default to **disabled**
/// (the #803 module gate), so any test hitting a gated endpoint must opt the
/// site in first or every request 403s with `MODULE_NOT_ENABLED`.
pub async fn enable_module(pool: &PgPool, site_id: Uuid, module: &str) {
    SiteSetting::upsert(
        pool,
        site_id,
        &format!("module_{module}_enabled"),
        serde_json::json!(true),
        false,
    )
    .await
    .unwrap_or_else(|e| panic!("enable '{module}' module for test site: {e}"));
}

pub async fn create_test_api_key(
    pool: &PgPool,
    site_id: Uuid,
    permission: ApiKeyPermission,
) -> String {
    let result: CreateApiKeyResult = forja::models::api_key::ApiKey::create(
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
        None, // quota_hourly
        None, // quota_daily
        None, // quota_monthly
    )
    .await
    .expect("Failed to create test API key");
    result.plaintext_key
}
