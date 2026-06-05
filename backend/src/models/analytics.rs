//! Analytics model
//!
//! Privacy-first pageview tracking. No IP addresses or raw User-Agents
//! are stored. Visitor hashes use a daily-rotating salt (site_id + date)
//! so visitors cannot be tracked across days.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;

/// Raw pageview event (pruned after retention period)
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AnalyticsPageview {
    pub id: Uuid,
    pub site_id: Uuid,
    pub path: String,
    pub referrer_domain: Option<String>,
    pub visitor_hash: String,
    pub created_at: DateTime<Utc>,
}

/// Daily aggregated stats (kept indefinitely)
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AnalyticsDailyStat {
    pub id: Uuid,
    pub site_id: Uuid,
    pub path: String,
    pub date: NaiveDate,
    pub view_count: i32,
    pub unique_visitors: i32,
    pub created_at: DateTime<Utc>,
}

/// Top content item (query result, not a table)
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TopContentRow {
    pub path: String,
    pub total_views: i64,
    pub unique_visitors: i64,
}

/// Daily trend point (query result)
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DailyTrendRow {
    pub date: NaiveDate,
    pub total_views: i64,
    pub unique_visitors: i64,
}

/// Referrer domain with view count (query result)
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ReferrerRow {
    pub domain: String,
    pub views: i64,
}

/// Compute a GDPR-compliant visitor hash.
///
/// Uses SHA-256(site_id || date || IP || UA) truncated to 16 hex chars.
/// The date component rotates daily, preventing cross-day tracking.
/// The IP and UA are never stored — only this hash is persisted.
pub fn compute_visitor_hash(
    site_id: Uuid,
    date: &NaiveDate,
    client_ip: &str,
    user_agent: &str,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(site_id.as_bytes());
    hasher.update(date.to_string().as_bytes());
    hasher.update(client_ip.as_bytes());
    hasher.update(user_agent.as_bytes());
    let result = hasher.finalize();
    hex::encode(&result[..8]) // 16 hex chars from 8 bytes
}

/// Extract the domain from a referrer URL. Returns None for empty/invalid URLs.
/// Only the domain is kept — full URL is discarded for privacy.
pub fn extract_referrer_domain(referrer: Option<&str>) -> Option<String> {
    let referrer = referrer?.trim();
    if referrer.is_empty() {
        return None;
    }
    url::Url::parse(referrer)
        .ok()
        .and_then(|u| u.host_str().map(|h| h.to_string()))
}

impl AnalyticsPageview {
    /// Record a new pageview event.
    pub async fn create(
        pool: &PgPool,
        site_id: Uuid,
        path: &str,
        referrer_domain: Option<&str>,
        visitor_hash: &str,
    ) -> Result<(), ApiError> {
        sqlx::query(
            r#"
            INSERT INTO analytics_pageviews (site_id, path, referrer_domain, visitor_hash)
            VALUES ($1, $2, $3, $4)
            "#,
        )
        .bind(site_id)
        .bind(path)
        .bind(referrer_domain)
        .bind(visitor_hash)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Get top content by views within a date range.
    pub async fn top_content(
        pool: &PgPool,
        site_id: Uuid,
        since: DateTime<Utc>,
        limit: i64,
    ) -> Result<Vec<TopContentRow>, ApiError> {
        let rows = sqlx::query_as::<_, TopContentRow>(
            r#"
            SELECT
                path,
                COUNT(*) AS total_views,
                COUNT(DISTINCT visitor_hash) AS unique_visitors
            FROM analytics_pageviews
            WHERE site_id = $1 AND created_at >= $2
            GROUP BY path
            ORDER BY total_views DESC
            LIMIT $3
            "#,
        )
        .bind(site_id)
        .bind(since)
        .bind(limit)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    /// Get daily view trend within a date range.
    pub async fn daily_trend(
        pool: &PgPool,
        site_id: Uuid,
        since: DateTime<Utc>,
    ) -> Result<Vec<DailyTrendRow>, ApiError> {
        let rows = sqlx::query_as::<_, DailyTrendRow>(
            r#"
            SELECT
                created_at::date AS date,
                COUNT(*) AS total_views,
                COUNT(DISTINCT visitor_hash) AS unique_visitors
            FROM analytics_pageviews
            WHERE site_id = $1 AND created_at >= $2
            GROUP BY date
            ORDER BY date ASC
            "#,
        )
        .bind(site_id)
        .bind(since)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    /// Get total views and unique visitors for a site within a date range.
    pub async fn summary(
        pool: &PgPool,
        site_id: Uuid,
        since: DateTime<Utc>,
    ) -> Result<(i64, i64), ApiError> {
        let row: (i64, i64) = sqlx::query_as(
            r#"
            SELECT
                COUNT(*) AS total_views,
                COUNT(DISTINCT visitor_hash) AS unique_visitors
            FROM analytics_pageviews
            WHERE site_id = $1 AND created_at >= $2
            "#,
        )
        .bind(site_id)
        .bind(since)
        .fetch_one(pool)
        .await?;
        Ok(row)
    }

    /// Get top content by views within a closed date range.
    pub async fn top_content_range(
        pool: &PgPool,
        site_id: Uuid,
        since: DateTime<Utc>,
        until: DateTime<Utc>,
        limit: i64,
    ) -> Result<Vec<TopContentRow>, ApiError> {
        let rows = sqlx::query_as::<_, TopContentRow>(
            r#"
            SELECT
                path,
                COUNT(*) AS total_views,
                COUNT(DISTINCT visitor_hash) AS unique_visitors
            FROM analytics_pageviews
            WHERE site_id = $1 AND created_at >= $2 AND created_at <= $3
            GROUP BY path
            ORDER BY total_views DESC
            LIMIT $4
            "#,
        )
        .bind(site_id)
        .bind(since)
        .bind(until)
        .bind(limit)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    /// Get daily view trend within a closed date range.
    pub async fn daily_trend_range(
        pool: &PgPool,
        site_id: Uuid,
        since: DateTime<Utc>,
        until: DateTime<Utc>,
    ) -> Result<Vec<DailyTrendRow>, ApiError> {
        let rows = sqlx::query_as::<_, DailyTrendRow>(
            r#"
            SELECT
                created_at::date AS date,
                COUNT(*) AS total_views,
                COUNT(DISTINCT visitor_hash) AS unique_visitors
            FROM analytics_pageviews
            WHERE site_id = $1 AND created_at >= $2 AND created_at <= $3
            GROUP BY date
            ORDER BY date ASC
            "#,
        )
        .bind(site_id)
        .bind(since)
        .bind(until)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    /// Get total views and unique visitors for a site within a closed date range.
    pub async fn summary_range(
        pool: &PgPool,
        site_id: Uuid,
        since: DateTime<Utc>,
        until: DateTime<Utc>,
    ) -> Result<(i64, i64), ApiError> {
        let row: (i64, i64) = sqlx::query_as(
            r#"
            SELECT
                COUNT(*) AS total_views,
                COUNT(DISTINCT visitor_hash) AS unique_visitors
            FROM analytics_pageviews
            WHERE site_id = $1 AND created_at >= $2 AND created_at <= $3
            "#,
        )
        .bind(site_id)
        .bind(since)
        .bind(until)
        .fetch_one(pool)
        .await?;
        Ok(row)
    }

    /// Get daily trend for a specific page within a closed date range.
    pub async fn page_trend(
        pool: &PgPool,
        site_id: Uuid,
        path: &str,
        since: DateTime<Utc>,
        until: DateTime<Utc>,
    ) -> Result<Vec<DailyTrendRow>, ApiError> {
        let rows = sqlx::query_as::<_, DailyTrendRow>(
            r#"
            SELECT
                created_at::date AS date,
                COUNT(*) AS total_views,
                COUNT(DISTINCT visitor_hash) AS unique_visitors
            FROM analytics_pageviews
            WHERE site_id = $1 AND path = $2 AND created_at >= $3 AND created_at <= $4
            GROUP BY date
            ORDER BY date ASC
            "#,
        )
        .bind(site_id)
        .bind(path)
        .bind(since)
        .bind(until)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    /// Get total views and unique visitors for a specific page within a closed date range.
    pub async fn page_summary(
        pool: &PgPool,
        site_id: Uuid,
        path: &str,
        since: DateTime<Utc>,
        until: DateTime<Utc>,
    ) -> Result<(i64, i64), ApiError> {
        let row: (i64, i64) = sqlx::query_as(
            r#"
            SELECT
                COUNT(*) AS total_views,
                COUNT(DISTINCT visitor_hash) AS unique_visitors
            FROM analytics_pageviews
            WHERE site_id = $1 AND path = $2 AND created_at >= $3 AND created_at <= $4
            "#,
        )
        .bind(site_id)
        .bind(path)
        .bind(since)
        .bind(until)
        .fetch_one(pool)
        .await?;
        Ok(row)
    }

    /// Get top referrer domains for a specific page within a closed date range.
    pub async fn page_referrers(
        pool: &PgPool,
        site_id: Uuid,
        path: &str,
        since: DateTime<Utc>,
        until: DateTime<Utc>,
        limit: i64,
    ) -> Result<Vec<ReferrerRow>, ApiError> {
        let rows = sqlx::query_as::<_, ReferrerRow>(
            r#"
            SELECT
                COALESCE(referrer_domain, '(direct)') AS domain,
                COUNT(*) AS views
            FROM analytics_pageviews
            WHERE site_id = $1 AND path = $2 AND created_at >= $3 AND created_at <= $4
            GROUP BY domain
            ORDER BY views DESC
            LIMIT $5
            "#,
        )
        .bind(site_id)
        .bind(path)
        .bind(since)
        .bind(until)
        .bind(limit)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    /// Aggregate raw events into daily stats and return the number of days aggregated.
    pub async fn aggregate_daily(
        pool: &PgPool,
        site_id: Uuid,
        before_date: NaiveDate,
    ) -> Result<u64, ApiError> {
        let result = sqlx::query(
            r#"
            INSERT INTO analytics_daily_stats (site_id, path, date, view_count, unique_visitors)
            SELECT
                site_id,
                path,
                created_at::date AS date,
                COUNT(*)::int AS view_count,
                COUNT(DISTINCT visitor_hash)::int AS unique_visitors
            FROM analytics_pageviews
            WHERE site_id = $1 AND created_at::date < $2
            GROUP BY site_id, path, created_at::date
            ON CONFLICT (site_id, path, date) DO UPDATE SET
                view_count = EXCLUDED.view_count,
                unique_visitors = EXCLUDED.unique_visitors
            "#,
        )
        .bind(site_id)
        .bind(before_date)
        .execute(pool)
        .await?;
        Ok(result.rows_affected())
    }

    /// Prune raw events older than the given date.
    pub async fn prune(
        pool: &PgPool,
        site_id: Uuid,
        older_than: DateTime<Utc>,
    ) -> Result<u64, ApiError> {
        let result = sqlx::query(
            r#"
            DELETE FROM analytics_pageviews
            WHERE site_id = $1 AND created_at < $2
            "#,
        )
        .bind(site_id)
        .bind(older_than)
        .execute(pool)
        .await?;
        Ok(result.rows_affected())
    }
}

impl AnalyticsDailyStat {
    /// Get top content from aggregated daily stats within a date range.
    pub async fn top_content(
        pool: &PgPool,
        site_id: Uuid,
        since: NaiveDate,
        limit: i64,
    ) -> Result<Vec<TopContentRow>, ApiError> {
        let rows = sqlx::query_as::<_, TopContentRow>(
            r#"
            SELECT
                path,
                SUM(view_count)::bigint AS total_views,
                SUM(unique_visitors)::bigint AS unique_visitors
            FROM analytics_daily_stats
            WHERE site_id = $1 AND date >= $2
            GROUP BY path
            ORDER BY total_views DESC
            LIMIT $3
            "#,
        )
        .bind(site_id)
        .bind(since)
        .bind(limit)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    /// Get top content from aggregated daily stats within a closed date range.
    pub async fn top_content_range(
        pool: &PgPool,
        site_id: Uuid,
        since: NaiveDate,
        until: NaiveDate,
        limit: i64,
    ) -> Result<Vec<TopContentRow>, ApiError> {
        let rows = sqlx::query_as::<_, TopContentRow>(
            r#"
            SELECT
                path,
                SUM(view_count)::bigint AS total_views,
                SUM(unique_visitors)::bigint AS unique_visitors
            FROM analytics_daily_stats
            WHERE site_id = $1 AND date >= $2 AND date <= $3
            GROUP BY path
            ORDER BY total_views DESC
            LIMIT $4
            "#,
        )
        .bind(site_id)
        .bind(since)
        .bind(until)
        .bind(limit)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    /// Get daily trend from aggregated stats within a closed date range.
    pub async fn daily_trend_range(
        pool: &PgPool,
        site_id: Uuid,
        since: NaiveDate,
        until: NaiveDate,
    ) -> Result<Vec<DailyTrendRow>, ApiError> {
        let rows = sqlx::query_as::<_, DailyTrendRow>(
            r#"
            SELECT
                date,
                SUM(view_count)::bigint AS total_views,
                SUM(unique_visitors)::bigint AS unique_visitors
            FROM analytics_daily_stats
            WHERE site_id = $1 AND date >= $2 AND date <= $3
            GROUP BY date
            ORDER BY date ASC
            "#,
        )
        .bind(site_id)
        .bind(since)
        .bind(until)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    /// Get daily trend from aggregated stats for a specific page within a closed date range.
    pub async fn page_trend(
        pool: &PgPool,
        site_id: Uuid,
        path: &str,
        since: NaiveDate,
        until: NaiveDate,
    ) -> Result<Vec<DailyTrendRow>, ApiError> {
        let rows = sqlx::query_as::<_, DailyTrendRow>(
            r#"
            SELECT
                date,
                view_count::bigint AS total_views,
                unique_visitors::bigint AS unique_visitors
            FROM analytics_daily_stats
            WHERE site_id = $1 AND path = $2 AND date >= $3 AND date <= $4
            ORDER BY date ASC
            "#,
        )
        .bind(site_id)
        .bind(path)
        .bind(since)
        .bind(until)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    /// Get daily trend from aggregated stats.
    pub async fn daily_trend(
        pool: &PgPool,
        site_id: Uuid,
        since: NaiveDate,
    ) -> Result<Vec<DailyTrendRow>, ApiError> {
        let rows = sqlx::query_as::<_, DailyTrendRow>(
            r#"
            SELECT
                date,
                SUM(view_count)::bigint AS total_views,
                SUM(unique_visitors)::bigint AS unique_visitors
            FROM analytics_daily_stats
            WHERE site_id = $1 AND date >= $2
            GROUP BY date
            ORDER BY date ASC
            "#,
        )
        .bind(site_id)
        .bind(since)
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_visitor_hash_deterministic() {
        let site_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        let date = NaiveDate::from_ymd_opt(2026, 3, 8).unwrap();
        let hash1 = compute_visitor_hash(site_id, &date, "192.168.1.1", "Mozilla/5.0");
        let hash2 = compute_visitor_hash(site_id, &date, "192.168.1.1", "Mozilla/5.0");
        assert_eq!(hash1, hash2);
        assert_eq!(hash1.len(), 16);
    }

    #[test]
    fn test_compute_visitor_hash_different_dates() {
        let site_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        let date1 = NaiveDate::from_ymd_opt(2026, 3, 8).unwrap();
        let date2 = NaiveDate::from_ymd_opt(2026, 3, 9).unwrap();
        let hash1 = compute_visitor_hash(site_id, &date1, "192.168.1.1", "Mozilla/5.0");
        let hash2 = compute_visitor_hash(site_id, &date2, "192.168.1.1", "Mozilla/5.0");
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_compute_visitor_hash_different_ips() {
        let site_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        let date = NaiveDate::from_ymd_opt(2026, 3, 8).unwrap();
        let hash1 = compute_visitor_hash(site_id, &date, "192.168.1.1", "Mozilla/5.0");
        let hash2 = compute_visitor_hash(site_id, &date, "10.0.0.1", "Mozilla/5.0");
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_extract_referrer_domain() {
        assert_eq!(
            extract_referrer_domain(Some("https://twitter.com/some/path?q=1")),
            Some("twitter.com".to_string())
        );
        assert_eq!(
            extract_referrer_domain(Some("https://www.google.com/search?q=test")),
            Some("www.google.com".to_string())
        );
        assert_eq!(extract_referrer_domain(Some("")), None);
        assert_eq!(extract_referrer_domain(None), None);
        assert_eq!(extract_referrer_domain(Some("not-a-url")), None);
    }
}
