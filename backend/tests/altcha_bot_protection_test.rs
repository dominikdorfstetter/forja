//! ALTCHA bot-protection data-model tests (#768, #768b).
//!
//! Exercises the `site_bot_protection` model in both modes and the
//! single-use consumed-challenge guard directly against the DB — no HTTP.

mod common;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::{Duration, Utc};
use serde_json::json;
use uuid::Uuid;

use forja::dto::forms::{BotProtectionMode, CreateFormRequest, FormBotProtection};
use forja::models::api_key::ApiKeyPermission;
use forja::models::forms::Form;
use forja::models::site_bot_protection::{ConsumedChallenge, SiteBotProtection, UpsertParams};
use forja::models::site_settings::SiteSetting;

use common::{create_test_api_key, create_test_site, test_context, test_db_pool, TestContext};

/// A fixed 32-byte key — these tests only assert round-trip, not key handling.
const KEY: [u8; 32] = [7u8; 32];

/// Tracer (#768): an ALTCHA-mode row round-trips with a null verify_url and a
/// decryptable HMAC key.
#[tokio::test]
async fn altcha_mode_row_roundtrips() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    let stored = SiteBotProtection::upsert(
        &pool,
        site_id,
        UpsertParams {
            mode: BotProtectionMode::Altcha,
            provider_label: "ALTCHA (self-hosted)",
            verify_url: None,
            secret_plaintext: "the-hmac-key",
            altcha_max_number: None,
            altcha_expiry_seconds: None,
        },
        &KEY,
    )
    .await
    .expect("upsert altcha row");

    assert_eq!(stored.mode, BotProtectionMode::Altcha);
    assert!(stored.verify_url.is_none());

    let found = SiteBotProtection::find_for_site(&pool, site_id)
        .await
        .expect("find")
        .expect("row exists");
    assert_eq!(found.mode, BotProtectionMode::Altcha);
    assert!(found.verify_url.is_none());
    assert_eq!(found.decrypt_secret(&KEY).unwrap(), "the-hmac-key");
    // Defaults applied when params unset.
    assert_eq!(found.effective_max_number(), 50_000);
    assert_eq!(found.effective_expiry_seconds(), 300);
}

/// Remote-mode rows keep the vendor verify URL (no regression for #608 sites).
#[tokio::test]
async fn remote_mode_row_roundtrips() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    SiteBotProtection::upsert(
        &pool,
        site_id,
        UpsertParams {
            mode: BotProtectionMode::Remote,
            provider_label: "Turnstile",
            verify_url: Some("https://example.com/siteverify"),
            secret_plaintext: "vendor-secret",
            altcha_max_number: None,
            altcha_expiry_seconds: None,
        },
        &KEY,
    )
    .await
    .expect("upsert remote row");

    let found = SiteBotProtection::find_for_site(&pool, site_id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(found.mode, BotProtectionMode::Remote);
    assert_eq!(
        found.verify_url.as_deref(),
        Some("https://example.com/siteverify")
    );
}

/// Switching a site remote→altcha→remote round-trips each way; the upsert
/// overwrites the prior mode and verify_url.
#[tokio::test]
async fn switching_modes_overwrites_cleanly() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    SiteBotProtection::upsert(
        &pool,
        site_id,
        UpsertParams {
            mode: BotProtectionMode::Remote,
            provider_label: "Turnstile",
            verify_url: Some("https://example.com/siteverify"),
            secret_plaintext: "vendor-secret",
            altcha_max_number: None,
            altcha_expiry_seconds: None,
        },
        &KEY,
    )
    .await
    .unwrap();

    SiteBotProtection::upsert(
        &pool,
        site_id,
        UpsertParams {
            mode: BotProtectionMode::Altcha,
            provider_label: "ALTCHA (self-hosted)",
            verify_url: None,
            secret_plaintext: "hmac-key",
            altcha_max_number: None,
            altcha_expiry_seconds: None,
        },
        &KEY,
    )
    .await
    .unwrap();

    let found = SiteBotProtection::find_for_site(&pool, site_id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(found.mode, BotProtectionMode::Altcha);
    assert!(
        found.verify_url.is_none(),
        "stale remote verify_url must not survive the switch to altcha"
    );
}

/// Replay guard (#768b): the first use of a salt is accepted, a second use is
/// rejected, and a distinct salt is independent.
#[tokio::test]
async fn consumed_challenge_blocks_replay() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let salt = format!("salt-{}", Uuid::new_v4());
    let expires = Utc::now() + Duration::seconds(300);

    let first = ConsumedChallenge::try_consume(&pool, site_id, &salt, expires)
        .await
        .unwrap();
    assert!(first, "first use of a salt is accepted");

    let second = ConsumedChallenge::try_consume(&pool, site_id, &salt, expires)
        .await
        .unwrap();
    assert!(!second, "replay of the same salt is rejected");

    let other = format!("salt-{}", Uuid::new_v4());
    let independent = ConsumedChallenge::try_consume(&pool, site_id, &other, expires)
        .await
        .unwrap();
    assert!(independent, "a distinct salt is unaffected");
}

/// Pruning removes only already-expired consumed rows.
#[tokio::test]
async fn prune_expired_removes_only_stale_rows() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    let stale = format!("salt-stale-{}", Uuid::new_v4());
    let fresh = format!("salt-fresh-{}", Uuid::new_v4());
    ConsumedChallenge::try_consume(&pool, site_id, &stale, Utc::now() - Duration::seconds(10))
        .await
        .unwrap();
    ConsumedChallenge::try_consume(&pool, site_id, &fresh, Utc::now() + Duration::seconds(300))
        .await
        .unwrap();

    ConsumedChallenge::prune_expired(&pool).await.unwrap();

    // The stale salt is now reusable (its row was pruned); the fresh one isn't.
    assert!(
        ConsumedChallenge::try_consume(&pool, site_id, &stale, Utc::now() + Duration::seconds(60))
            .await
            .unwrap(),
        "pruned stale salt can be inserted again"
    );
    assert!(
        !ConsumedChallenge::try_consume(&pool, site_id, &fresh, Utc::now() + Duration::seconds(60))
            .await
            .unwrap(),
        "non-expired salt survives pruning and still blocks replay"
    );
}

// ── HTTP-layer tests (#770, #771, #774 API-level) ───────────────────────

/// Enable the Forms module for a site and register a domain so public
/// endpoints resolve it via `X-Site-Domain`. Returns the domain.
async fn enable_forms_with_domain(ctx: &TestContext, site_id: Uuid) -> String {
    SiteSetting::upsert(
        &ctx.pool,
        site_id,
        "module_forms_enabled",
        json!(true),
        false,
    )
    .await
    .expect("enable forms module");
    let domain = format!("altcha-{}.example.test", &Uuid::new_v4().to_string()[..8]);
    sqlx::query("INSERT INTO site_domains (site_id, domain, is_active) VALUES ($1, $2, TRUE)")
        .bind(site_id)
        .bind(&domain)
        .execute(&ctx.pool)
        .await
        .expect("register domain");
    domain
}

/// Create a Mandatory-protected form and return its slug.
async fn create_mandatory_form(ctx: &TestContext, site_id: Uuid) -> String {
    let slug = format!("contact-{}", &Uuid::new_v4().to_string()[..8]);
    Form::create(
        &ctx.pool,
        site_id,
        CreateFormRequest {
            name: "Contact".to_string(),
            slug: slug.clone(),
            description: None,
            is_active: true,
            consent_required: false,
            consent_text: None,
            bot_protection: FormBotProtection::Mandatory,
            storage_mode: Default::default(),
            retention_days: None,
            fields: vec![],
            template_id: None,
            localizations: vec![],
        },
    )
    .await
    .expect("create form");
    slug
}

/// PUT the bot-protection config through the admin endpoint as a Master key.
async fn put_bot_protection(
    ctx: &TestContext,
    site_id: Uuid,
    key: &str,
    body: serde_json::Value,
) -> u16 {
    ctx.server
        .put(&format!("/api/v1/sites/{site_id}/bot-protection"))
        .add_header("x-api-key", key)
        .json(&body)
        .await
        .status_code()
        .as_u16()
}

/// Tracer (#771): enabling ALTCHA with no key stores an altcha-mode row whose
/// secret is never echoed back by GET.
#[tokio::test]
async fn put_altcha_then_get_hides_secret() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    enable_forms_with_domain(&ctx, site_id).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Master).await;

    let status = put_bot_protection(&ctx, site_id, &key, json!({ "mode": "altcha" })).await;
    assert_eq!(status, 200, "altcha enablement is zero-config");

    let resp = ctx
        .server
        .get(&format!("/api/v1/sites/{site_id}/bot-protection"))
        .add_header("x-api-key", key.as_str())
        .await;
    assert_eq!(resp.status_code().as_u16(), 200);
    let body: serde_json::Value = resp.json();
    assert_eq!(body["mode"], "altcha");
    assert_eq!(body["configured"], true);
    assert!(
        body["verify_url"].is_null(),
        "altcha mode has no verify_url"
    );
    let raw = body.to_string();
    assert!(
        !raw.contains("secret"),
        "secret/HMAC key must never be returned"
    );
}

/// Validation (#771): remote mode requires a verify_url.
#[tokio::test]
async fn put_remote_without_verify_url_is_rejected() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    enable_forms_with_domain(&ctx, site_id).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Master).await;

    let status = put_bot_protection(
        &ctx,
        site_id,
        &key,
        json!({ "mode": "remote", "provider_label": "Turnstile", "secret": "s" }),
    )
    .await;
    assert_eq!(
        status, 400,
        "remote mode without verify_url is a validation error"
    );
}

/// Permission (#771): a Read key cannot write the config.
#[tokio::test]
async fn read_key_cannot_put_bot_protection() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    enable_forms_with_domain(&ctx, site_id).await;
    let read_key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Read).await;

    let status = put_bot_protection(&ctx, site_id, &read_key, json!({ "mode": "altcha" })).await;
    assert_eq!(status, 403, "Read key is denied write access");
}

/// Edge case (#770): a remote-mode site has no ALTCHA challenge to issue.
#[tokio::test]
async fn challenge_endpoint_409_for_remote_mode_site() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let domain = enable_forms_with_domain(&ctx, site_id).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Master).await;
    let slug = create_mandatory_form(&ctx, site_id).await;
    put_bot_protection(
        &ctx,
        site_id,
        &key,
        json!({ "mode": "remote", "provider_label": "Turnstile",
                "verify_url": "https://example.com/siteverify", "secret": "s" }),
    )
    .await;

    let resp = ctx
        .server
        .get(&format!("/api/v1/public/forms/{slug}/altcha-challenge"))
        .add_header("x-site-domain", domain.as_str())
        .await;
    assert_eq!(
        resp.status_code().as_u16(),
        409,
        "no ALTCHA challenge in remote mode"
    );
}

/// #771/#772: an incidental save (no `regenerate_key`) preserves the HMAC key,
/// so a challenge solved before the save still verifies after it; an explicit
/// `regenerate_key` rotates the key, invalidating an in-flight solved payload.
#[tokio::test]
async fn altcha_save_preserves_key_unless_regenerate_requested() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let domain = enable_forms_with_domain(&ctx, site_id).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Master).await;
    let slug = create_mandatory_form(&ctx, site_id).await;
    put_bot_protection(&ctx, site_id, &key, json!({ "mode": "altcha" })).await;

    // Solve a challenge, then do an incidental save (tweak PoW difficulty).
    let solved = solve_current_challenge(&ctx, &slug, &domain).await;
    put_bot_protection(
        &ctx,
        site_id,
        &key,
        json!({ "mode": "altcha", "altcha_max_number": 60000 }),
    )
    .await;
    // Key preserved → the pre-save payload still verifies.
    let resp = ctx
        .server
        .post(&format!("/api/v1/public/forms/{slug}/submit"))
        .add_header("x-site-domain", domain.as_str())
        .json(&json!({ "data": {}, "bot_protection_token": solved }))
        .await;
    assert_eq!(
        resp.status_code().as_u16(),
        201,
        "incidental save preserves the key"
    );

    // Now solve again, then regenerate the key → the new payload is rejected.
    let solved2 = solve_current_challenge(&ctx, &slug, &domain).await;
    put_bot_protection(
        &ctx,
        site_id,
        &key,
        json!({ "mode": "altcha", "regenerate_key": true }),
    )
    .await;
    let resp = ctx
        .server
        .post(&format!("/api/v1/public/forms/{slug}/submit"))
        .add_header("x-site-domain", domain.as_str())
        .json(&json!({ "data": {}, "bot_protection_token": solved2 }))
        .await;
    assert_eq!(
        resp.status_code().as_u16(),
        400,
        "regenerate_key rotates the HMAC key, invalidating in-flight payloads"
    );
}

/// Fetch a challenge for a form, solve its proof-of-work, and return the
/// solved payload as **base64-encoded JSON** — the exact wire format the
/// `<altcha-widget>` emits and `altcha_service::verify` consumes (it decodes
/// the base64 envelope before parsing). Submitting raw JSON would fail the
/// decode and be rejected as malformed.
async fn solve_current_challenge(ctx: &TestContext, slug: &str, domain: &str) -> String {
    let challenge: serde_json::Value = ctx
        .server
        .get(&format!("/api/v1/public/forms/{slug}/altcha-challenge"))
        .add_header("x-site-domain", domain)
        .await
        .json();
    let number = altcha_lib_rs::solve_challenge(
        challenge["challenge"].as_str().unwrap(),
        challenge["salt"].as_str().unwrap(),
        None,
        challenge["maxnumber"].as_u64(),
        0,
    )
    .expect("solvable");
    let payload = json!({
        "algorithm": challenge["algorithm"],
        "challenge": challenge["challenge"],
        "number": number,
        "salt": challenge["salt"],
        "signature": challenge["signature"],
    })
    .to_string();
    STANDARD.encode(payload)
}

/// Full tracer (#770 + #774 + #769): enable ALTCHA → fetch challenge → solve →
/// submit succeeds; a no-token submit is rejected MISSING; a replayed payload
/// is rejected INVALID. No outbound verification call happens at any point.
#[tokio::test]
async fn altcha_full_journey_blocks_bot_accepts_solved_and_blocks_replay() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let domain = enable_forms_with_domain(&ctx, site_id).await;
    let key = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Master).await;
    let slug = create_mandatory_form(&ctx, site_id).await;
    assert_eq!(
        put_bot_protection(&ctx, site_id, &key, json!({ "mode": "altcha" })).await,
        200
    );

    let submit_url = format!("/api/v1/public/forms/{slug}/submit");

    // 1. Spam control: no payload → MISSING.
    let resp = ctx
        .server
        .post(&submit_url)
        .add_header("x-site-domain", domain.as_str())
        .json(&json!({ "data": {} }))
        .await;
    assert_eq!(resp.status_code().as_u16(), 400, "no token rejected");
    assert_eq!(
        resp.json::<serde_json::Value>()["code"],
        "BOT_PROTECTION_MISSING"
    );

    // 2 + 3. Fetch a fresh challenge and solve it the way the browser widget
    // would (brute-force the PoW, then base64-encode the payload).
    let solved_payload = solve_current_challenge(&ctx, &slug, &domain).await;

    // 4. Legit submission with the solved payload → accepted.
    let resp = ctx
        .server
        .post(&submit_url)
        .add_header("x-site-domain", domain.as_str())
        .json(&json!({ "data": {}, "bot_protection_token": solved_payload }))
        .await;
    assert_eq!(resp.status_code().as_u16(), 201, "solved payload accepted");
    assert!(
        resp.json::<serde_json::Value>()["reference_code"].is_string(),
        "submission returns a reference code"
    );

    // 5. Replay the same solved payload → rejected INVALID (#768b guard).
    let resp = ctx
        .server
        .post(&submit_url)
        .add_header("x-site-domain", domain.as_str())
        .json(&json!({ "data": {}, "bot_protection_token": solved_payload }))
        .await;
    assert_eq!(resp.status_code().as_u16(), 400, "replay rejected");
    assert_eq!(
        resp.json::<serde_json::Value>()["code"],
        "BOT_PROTECTION_INVALID"
    );
}
