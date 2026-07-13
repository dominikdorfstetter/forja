//! Integration tests for anomaly-detection responses and the usage baseline.
//!
//! Covers the auto-block trap fixed for low-traffic consumers:
//! - volume spikes are alert-only by default (key stays Active),
//! - hard-blocking is restored only via `anomaly_block_on_volume_spike`,
//! - the error-rate rule still auto-blocks (and notifies site admins),
//! - `avg_daily_requests` ignores zero-usage days so blocked/idle days
//!   cannot drag the baseline into a re-block death spiral.

mod common;

use sqlx::PgPool;
use uuid::Uuid;

use forja::config::SecurityConfig;
use forja::models::api_key::{ApiKey, ApiKeyPermission, ApiKeyStatus, ApiKeyUsageDaily};
use forja::models::site_membership::{SiteMembership, SiteRole};
use forja::services::anomaly_detection::{
    Anomaly, VolumeAction, alert_volume_anomaly, block_for_anomaly, detect_volume_anomaly,
    volume_action,
};

async fn create_key(pool: &PgPool, site_id: Uuid) -> ApiKey {
    ApiKey::create(
        pool,
        &format!("anomaly-test-{}", &Uuid::new_v4().to_string()[..8]),
        Some("anomaly integration test key"),
        ApiKeyPermission::Read,
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
    .expect("create api key")
    .api_key
}

async fn seed_usage_day(pool: &PgPool, api_key_id: Uuid, days_ago: i32, total_requests: i64) {
    sqlx::query(
        r#"
        INSERT INTO api_key_usage_daily (api_key_id, date, total_requests)
        VALUES ($1, CURRENT_DATE - $2::INT, $3)
        "#,
    )
    .bind(api_key_id)
    .bind(days_ago)
    .bind(total_requests)
    .execute(pool)
    .await
    .expect("seed usage day");
}

async fn audit_entries(pool: &PgPool, entity_id: Uuid, sub_action: &str) -> i64 {
    sqlx::query_scalar(
        r#"
        SELECT COUNT(*) FROM audit_logs
        WHERE entity_type = 'api_key'
          AND entity_id = $1
          AND metadata->>'sub_action' = $2
        "#,
    )
    .bind(entity_id)
    .bind(sub_action)
    .fetch_one(pool)
    .await
    .expect("count audit entries")
}

#[tokio::test]
async fn volume_spike_alert_only_leaves_key_active_and_audits() {
    let pool = common::test_db_pool().await;
    let site_id = common::create_test_site(&pool).await;
    let key = create_key(&pool, site_id).await;

    let config = SecurityConfig::default();
    assert_eq!(
        volume_action(&config),
        VolumeAction::Alert,
        "volume spikes must be alert-only by default"
    );

    let anomaly = Anomaly::HourlySpike {
        count: 1500,
        threshold: 1000,
    };
    alert_volume_anomaly(&pool, &key, &anomaly).await;

    let reloaded = ApiKey::find_by_id(&pool, key.id).await.expect("reload key");
    assert_eq!(reloaded.status, ApiKeyStatus::Active);
    assert_eq!(reloaded.blocked_reason, None);
    assert_eq!(
        audit_entries(&pool, key.id, "anomaly_volume_alert").await,
        1,
        "alert must leave an audit trail"
    );
    assert_eq!(
        audit_entries(&pool, key.id, "anomaly_block").await,
        0,
        "alert must not be recorded as a block"
    );
}

#[tokio::test]
async fn volume_spike_hard_blocks_when_operator_opts_in() {
    let pool = common::test_db_pool().await;
    let site_id = common::create_test_site(&pool).await;
    let key = create_key(&pool, site_id).await;

    let config = SecurityConfig {
        anomaly_block_on_volume_spike: true,
        ..SecurityConfig::default()
    };
    assert_eq!(volume_action(&config), VolumeAction::Block);

    let anomaly = Anomaly::HourlySpike {
        count: 1500,
        threshold: 1000,
    };
    block_for_anomaly(&pool, &key, &anomaly).await;

    let reloaded = ApiKey::find_by_id(&pool, key.id).await.expect("reload key");
    assert_eq!(reloaded.status, ApiKeyStatus::Blocked);
    assert_eq!(
        reloaded.blocked_reason.as_deref(),
        Some("anomaly:hourly_spike")
    );
    assert_eq!(audit_entries(&pool, key.id, "anomaly_block").await, 1);
}

#[tokio::test]
async fn error_rate_anomaly_still_blocks_and_notifies_site_admins() {
    let pool = common::test_db_pool().await;
    let site_id = common::create_test_site(&pool).await;
    let key = create_key(&pool, site_id).await;

    let admin_clerk_id = format!("user_anomaly_admin_{}", Uuid::new_v4().simple());
    let editor_clerk_id = format!("user_anomaly_editor_{}", Uuid::new_v4().simple());
    SiteMembership::create(&pool, &admin_clerk_id, site_id, &SiteRole::Admin, None)
        .await
        .expect("create admin membership");
    SiteMembership::create(&pool, &editor_clerk_id, site_id, &SiteRole::Editor, None)
        .await
        .expect("create editor membership");

    let anomaly = Anomaly::ErrorRate {
        errors: 60,
        requests: 100,
    };
    block_for_anomaly(&pool, &key, &anomaly).await;

    let reloaded = ApiKey::find_by_id(&pool, key.id).await.expect("reload key");
    assert_eq!(reloaded.status, ApiKeyStatus::Blocked);
    assert_eq!(
        reloaded.blocked_reason.as_deref(),
        Some("anomaly:error_rate")
    );

    let recipients: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT recipient_clerk_id FROM notifications
        WHERE entity_type = 'api_key'
          AND entity_id = $1
          AND notification_type = 'api_key_blocked'
        "#,
    )
    .bind(key.id)
    .fetch_all(&pool)
    .await
    .expect("fetch notifications");

    assert_eq!(
        recipients,
        vec![admin_clerk_id],
        "only Owner/Admin members get the auto-block notification"
    );
}

#[tokio::test]
async fn low_baseline_key_survives_build_burst() {
    let pool = common::test_db_pool().await;
    let site_id = common::create_test_site(&pool).await;
    let key = create_key(&pool, site_id).await;

    for days_ago in 1..=6 {
        seed_usage_day(&pool, key.id, days_ago, 50).await;
    }

    let avg = ApiKeyUsageDaily::avg_daily_requests(&pool, key.id)
        .await
        .expect("avg query");
    assert_eq!(avg, Some(50.0));

    // Naive threshold would be (50/24)*5 ≈ 10 — a deploy burst of a few
    // hundred requests must not register as an anomaly once floored.
    let config = SecurityConfig::default();
    assert_eq!(detect_volume_anomaly(&config, avg, 300, 300), None);
}

#[tokio::test]
async fn avg_daily_requests_ignores_zero_usage_days() {
    let pool = common::test_db_pool().await;
    let site_id = common::create_test_site(&pool).await;
    let key = create_key(&pool, site_id).await;

    // Three active days at 100 requests, three blocked/idle days at zero.
    // The old AVG over all days returned 50 — halving the threshold and
    // re-blocking the key faster after every unblock.
    for days_ago in 1..=3 {
        seed_usage_day(&pool, key.id, days_ago, 100).await;
    }
    for days_ago in 4..=6 {
        seed_usage_day(&pool, key.id, days_ago, 0).await;
    }

    let avg = ApiKeyUsageDaily::avg_daily_requests(&pool, key.id)
        .await
        .expect("avg query");
    assert_eq!(
        avg,
        Some(100.0),
        "zero-usage days must not dilute the baseline"
    );
}

#[tokio::test]
async fn avg_daily_requests_none_when_no_active_days() {
    let pool = common::test_db_pool().await;
    let site_id = common::create_test_site(&pool).await;
    let key = create_key(&pool, site_id).await;

    for days_ago in 1..=3 {
        seed_usage_day(&pool, key.id, days_ago, 0).await;
    }

    let avg = ApiKeyUsageDaily::avg_daily_requests(&pool, key.id)
        .await
        .expect("avg query");
    assert_eq!(
        avg, None,
        "all-zero history must fall back to the generous new-key defaults"
    );
}
