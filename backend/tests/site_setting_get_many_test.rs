//! Issue #869 — `SiteSetting::get_many` multi-key lookup.
//!
//! Pins the contract the SEO envelope relies on: one call returns *every*
//! requested key, using the DB row where present and the known default
//! otherwise — same per-key semantics as `get_value`, but batched.

mod common;

use serial_test::serial;

use forja::models::site::Site;
use forja::models::site_settings::{
    KEY_SEO_DEFAULT_DESCRIPTION, KEY_SEO_DEFAULT_OG_IMAGE_ID, KEY_SEO_TITLE_TEMPLATE, SiteSetting,
};
use forja::utils::seo::SeoContext;

use common::{create_test_site, test_db_pool};

#[tokio::test]
#[serial]
async fn get_many_returns_every_requested_key_db_and_default_mixed() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    // Only one of the three SEO keys is persisted; the other two must fall
    // back to their defaults.
    SiteSetting::upsert(
        &pool,
        site_id,
        KEY_SEO_DEFAULT_DESCRIPTION,
        serde_json::json!("Persisted description"),
        false,
    )
    .await
    .expect("upsert seo description");

    let keys = [
        KEY_SEO_TITLE_TEMPLATE,
        KEY_SEO_DEFAULT_DESCRIPTION,
        KEY_SEO_DEFAULT_OG_IMAGE_ID,
    ];
    let settings = SiteSetting::get_many(&pool, site_id, &keys)
        .await
        .expect("get_many");

    // All three requested keys are present.
    assert_eq!(settings.len(), 3);
    for key in keys {
        assert!(settings.contains_key(key), "missing key {key}");
    }

    // The persisted key returns the DB value...
    assert_eq!(
        settings[KEY_SEO_DEFAULT_DESCRIPTION].as_str(),
        Some("Persisted description")
    );
    // ...the absent keys return their defaults (template default is the
    // "{{title}} | {{site_name}}" string; og-image default is JSON null).
    assert_eq!(
        settings[KEY_SEO_TITLE_TEMPLATE].as_str(),
        Some("{{title}} | {{site_name}}")
    );
    assert!(settings[KEY_SEO_DEFAULT_OG_IMAGE_ID].is_null());
}

#[tokio::test]
#[serial]
async fn seo_context_load_then_apply_fills_meta_from_settings() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    SiteSetting::upsert(
        &pool,
        site_id,
        KEY_SEO_TITLE_TEMPLATE,
        serde_json::json!("{{title}} — {{site_name}}"),
        false,
    )
    .await
    .expect("upsert title template");
    SiteSetting::upsert(
        &pool,
        site_id,
        KEY_SEO_DEFAULT_DESCRIPTION,
        serde_json::json!("Site-wide description"),
        false,
    )
    .await
    .expect("upsert default description");

    let site = Site::find_by_id(&pool, site_id).await.expect("load site");
    let seo = SeoContext::load(&pool, &site)
        .await
        .expect("load SeoContext");

    let mut locs = vec![forja::dto::content::LocalizationResponse {
        id: uuid::Uuid::new_v4(),
        content_id: uuid::Uuid::new_v4(),
        locale_id: uuid::Uuid::new_v4(),
        title: "Hello".to_string(),
        subtitle: None,
        excerpt: None,
        body: None,
        meta_title: None,
        meta_description: None,
        translation_status: forja::models::content::TranslationStatus::Approved,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    }];

    seo.apply(&mut locs);

    assert_eq!(
        locs[0].meta_title.as_deref(),
        Some(format!("Hello — {}", site.name).as_str())
    );
    assert_eq!(
        locs[0].meta_description.as_deref(),
        Some("Site-wide description")
    );
}
