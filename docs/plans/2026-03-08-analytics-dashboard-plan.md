# Analytics Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dedicated analytics dashboard with date range controls, per-page drill-down, and referrer breakdown.

**Architecture:** Extend the existing analytics backend with date-range query params and a new per-page detail endpoint. Build a new `/analytics` overview page and `/analytics/page/:encodedPath` detail page using recharts (already installed). Enhance the existing dashboard widget with a sparkline chart and navigation link.

**Tech Stack:** Rust/Rocket (backend), React 19 + MUI v7 + recharts 3.7 + TanStack Query (frontend), Vitest (tests)

---

## Phase 1: Backend

### Task 1: Add New DTOs

**Files:**
- Modify: `backend/src/dto/analytics.rs`

**Step 1: Add ReferrerItem and AnalyticsPageDetailResponse DTOs**

Add after the existing `AnalyticsReportResponse` struct (after line 90):

```rust
/// Referrer domain with view count
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Referrer domain with view count")]
pub struct ReferrerItem {
    /// Referrer domain (e.g., "google.com") or "(direct)" for no referrer
    #[schema(example = "google.com")]
    pub domain: String,
    /// Number of views from this referrer
    #[schema(example = 42)]
    pub views: i64,
}

/// Per-page analytics detail response
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[schema(description = "Analytics detail for a single page")]
pub struct AnalyticsPageDetailResponse {
    /// The page path
    #[schema(example = "/blog/my-post")]
    pub path: String,
    /// Total page views in the period
    #[schema(example = 142)]
    pub total_views: i64,
    /// Approximate unique visitors in the period
    #[schema(example = 89)]
    pub total_unique_visitors: i64,
    /// Daily view trend for this page
    pub trend: Vec<TrendDataPoint>,
    /// Top referrer domains
    pub referrers: Vec<ReferrerItem>,
}
```

**Step 2: Verify it compiles**

Run: `cd /Users/dominikdorfstetter/repos/privat/forja/backend && cargo check 2>&1 | tail -5`
Expected: Compiles successfully.

**Step 3: Commit**

```bash
git add backend/src/dto/analytics.rs
git commit -m "feat(analytics): add ReferrerItem and AnalyticsPageDetailResponse DTOs"
```

---

### Task 2: Add New Model Methods

**Files:**
- Modify: `backend/src/models/analytics.rs`

**Step 1: Add ReferrerRow query result struct**

Add after the `DailyTrendRow` struct (after line 52):

```rust
/// Referrer aggregation row (query result)
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ReferrerRow {
    pub domain: String,
    pub views: i64,
}
```

**Step 2: Add date-range-aware methods to AnalyticsPageview impl**

Add these methods inside the `impl AnalyticsPageview` block (before the closing `}`):

```rust
    /// Get top content filtered by date range (start + end).
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

    /// Get daily trend filtered by date range (start + end).
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

    /// Get summary stats filtered by date range (start + end).
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

    /// Get daily trend for a specific page path.
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

    /// Get summary stats for a specific page path.
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

    /// Get top referrer domains for a specific page path.
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
```

**Step 3: Add date-range methods to AnalyticsDailyStat impl**

Add inside `impl AnalyticsDailyStat` block:

```rust
    /// Get top content from aggregated stats for a date range.
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

    /// Get daily trend from aggregated stats for a date range.
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

    /// Get daily trend for a specific page from aggregated stats.
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
                SUM(view_count)::bigint AS total_views,
                SUM(unique_visitors)::bigint AS unique_visitors
            FROM analytics_daily_stats
            WHERE site_id = $1 AND path = $2 AND date >= $3 AND date <= $4
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
```

**Step 4: Verify it compiles**

Run: `cd /Users/dominikdorfstetter/repos/privat/forja/backend && cargo check 2>&1 | tail -5`
Expected: Compiles successfully.

**Step 5: Commit**

```bash
git add backend/src/models/analytics.rs
git commit -m "feat(analytics): add date-range and per-page model methods"
```

---

### Task 3: Modify get_analytics_report Handler

**Files:**
- Modify: `backend/src/handlers/analytics.rs`

**Step 1: Add NaiveDate import**

Add `NaiveDate` to the chrono import at line 6:

```rust
use chrono::{Duration, NaiveDate, Utc};
```

**Step 2: Add new DTO imports**

Update the import from `crate::dto::analytics` (line 14) to include `AnalyticsPageDetailResponse` and `ReferrerItem`:

```rust
use crate::dto::analytics::{
    AnalyticsMaintenanceResponse, AnalyticsPageDetailResponse, AnalyticsReportResponse,
    ReferrerItem, TopContentItem, TrackPageviewRequest, TrackPageviewResponse, TrendDataPoint,
};
```

**Step 3: Add ReferrerRow import**

Update the import from `crate::models::analytics` (line 20):

```rust
use crate::models::analytics::{
    compute_visitor_hash, extract_referrer_domain, AnalyticsPageview, ReferrerRow,
};
```

**Step 4: Add resolve_date_range helper function**

Add after the `require_analytics_enabled` function (after line 71):

```rust
/// Resolve start/end date from query params. Priority: start_date/end_date > days > default 30.
fn resolve_date_range(
    start_date: Option<NaiveDate>,
    end_date: Option<NaiveDate>,
    days: Option<i64>,
) -> (chrono::DateTime<Utc>, chrono::DateTime<Utc>) {
    if let (Some(start), Some(end)) = (start_date, end_date) {
        let since = start
            .and_hms_opt(0, 0, 0)
            .map(|dt| dt.and_utc())
            .unwrap_or_else(Utc::now);
        let until = end
            .and_hms_opt(23, 59, 59)
            .map(|dt| dt.and_utc())
            .unwrap_or_else(Utc::now);
        (since, until)
    } else {
        let days = days.unwrap_or(30).clamp(1, 365);
        let until = Utc::now();
        let since = until - Duration::days(days);
        (since, until)
    }
}
```

**Step 5: Update get_analytics_report handler signature and utoipa params**

Replace the entire `get_analytics_report` function (lines 127-185) with:

```rust
/// Get analytics report for a site.
///
/// Returns top content, view trends, and summary stats for the given period.
/// Supports date range via start_date/end_date or days lookback.
#[utoipa::path(
    get,
    path = "/sites/{site_id}/analytics/report",
    tag = "Analytics",
    operation_id = "get_analytics_report",
    params(
        ("site_id" = Uuid, Path, description = "Site ID"),
        ("days" = Option<i64>, Query, description = "Number of days to look back (default: 30, ignored if start_date/end_date set)"),
        ("top_n" = Option<i64>, Query, description = "Number of top content items (default: 10)"),
        ("start_date" = Option<NaiveDate>, Query, description = "Start date (YYYY-MM-DD), takes priority over days"),
        ("end_date" = Option<NaiveDate>, Query, description = "End date (YYYY-MM-DD), takes priority over days"),
    ),
    responses(
        (status = 200, description = "Analytics report", body = AnalyticsReportResponse),
        (status = 403, description = "Analytics not enabled or insufficient permissions"),
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
#[get("/sites/<site_id>/analytics/report?<days>&<top_n>&<start_date>&<end_date>")]
pub async fn get_analytics_report(
    state: &State<AppState>,
    site_id: Uuid,
    days: Option<i64>,
    top_n: Option<i64>,
    start_date: Option<String>,
    end_date: Option<String>,
    auth: ReadKey,
) -> Result<Json<AnalyticsReportResponse>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;

    require_analytics_enabled(&state.db, site_id).await?;

    let parsed_start = start_date.and_then(|s| NaiveDate::parse_from_str(&s, "%Y-%m-%d").ok());
    let parsed_end = end_date.and_then(|s| NaiveDate::parse_from_str(&s, "%Y-%m-%d").ok());
    let top_n = top_n.unwrap_or(10).clamp(1, 50);
    let (since, until) = resolve_date_range(parsed_start, parsed_end, days);

    let top_content = AnalyticsPageview::top_content_range(&state.db, site_id, since, until, top_n)
        .await?
        .into_iter()
        .map(TopContentItem::from)
        .collect();

    let trend = AnalyticsPageview::daily_trend_range(&state.db, site_id, since, until)
        .await?
        .into_iter()
        .map(TrendDataPoint::from)
        .collect();

    let (total_views, total_unique_visitors) =
        AnalyticsPageview::summary_range(&state.db, site_id, since, until).await?;

    Ok(Json(AnalyticsReportResponse {
        total_views,
        total_unique_visitors,
        top_content,
        trend,
    }))
}
```

**Step 6: Verify it compiles**

Run: `cd /Users/dominikdorfstetter/repos/privat/forja/backend && cargo check 2>&1 | tail -5`
Expected: Compiles successfully.

**Step 7: Commit**

```bash
git add backend/src/handlers/analytics.rs
git commit -m "feat(analytics): add date range params to report endpoint"
```

---

### Task 4: Add Per-Page Analytics Handler

**Files:**
- Modify: `backend/src/handlers/analytics.rs`

**Step 1: Add the get_page_analytics handler**

Add before the `pub fn routes()` function (before line 256):

```rust
/// Get analytics detail for a specific page.
///
/// Returns trend data and referrer breakdown for a single page path.
#[utoipa::path(
    get,
    path = "/sites/{site_id}/analytics/report/page",
    tag = "Analytics",
    operation_id = "get_page_analytics",
    params(
        ("site_id" = Uuid, Path, description = "Site ID"),
        ("path" = String, Query, description = "Page path (e.g., /blog/my-post)"),
        ("days" = Option<i64>, Query, description = "Number of days to look back (default: 30)"),
        ("start_date" = Option<NaiveDate>, Query, description = "Start date (YYYY-MM-DD)"),
        ("end_date" = Option<NaiveDate>, Query, description = "End date (YYYY-MM-DD)"),
    ),
    responses(
        (status = 200, description = "Page analytics detail", body = AnalyticsPageDetailResponse),
        (status = 400, description = "Missing path parameter"),
        (status = 403, description = "Analytics not enabled or insufficient permissions"),
    ),
    security(("api_key" = []), ("bearer_auth" = []))
)]
#[get("/sites/<site_id>/analytics/report/page?<path>&<days>&<start_date>&<end_date>")]
pub async fn get_page_analytics(
    state: &State<AppState>,
    site_id: Uuid,
    path: String,
    days: Option<i64>,
    start_date: Option<String>,
    end_date: Option<String>,
    auth: ReadKey,
) -> Result<Json<AnalyticsPageDetailResponse>, ApiError> {
    auth.0
        .authorize_site_action(&state.db, site_id, &SiteRole::Viewer)
        .await?;

    require_analytics_enabled(&state.db, site_id).await?;

    if path.is_empty() {
        return Err(ApiError::BadRequest("path parameter is required".to_string()));
    }

    let parsed_start = start_date.and_then(|s| NaiveDate::parse_from_str(&s, "%Y-%m-%d").ok());
    let parsed_end = end_date.and_then(|s| NaiveDate::parse_from_str(&s, "%Y-%m-%d").ok());
    let (since, until) = resolve_date_range(parsed_start, parsed_end, days);

    let trend = AnalyticsPageview::page_trend(&state.db, site_id, &path, since, until)
        .await?
        .into_iter()
        .map(TrendDataPoint::from)
        .collect();

    let (total_views, total_unique_visitors) =
        AnalyticsPageview::page_summary(&state.db, site_id, &path, since, until).await?;

    let referrers = AnalyticsPageview::page_referrers(&state.db, site_id, &path, since, until, 20)
        .await?
        .into_iter()
        .map(|r| ReferrerItem {
            domain: r.domain,
            views: r.views,
        })
        .collect();

    Ok(Json(AnalyticsPageDetailResponse {
        path,
        total_views,
        total_unique_visitors,
        trend,
        referrers,
    }))
}
```

**Step 2: Register the new route**

Update the `routes()` function to include `get_page_analytics`:

```rust
pub fn routes() -> Vec<Route> {
    routes![track_pageview, get_analytics_report, get_page_analytics, aggregate_analytics]
}
```

**Step 3: Verify it compiles**

Run: `cd /Users/dominikdorfstetter/repos/privat/forja/backend && cargo check 2>&1 | tail -5`
Expected: Compiles successfully.

**Step 4: Commit**

```bash
git add backend/src/handlers/analytics.rs
git commit -m "feat(analytics): add per-page analytics detail endpoint"
```

---

### Task 5: Register in OpenAPI

**Files:**
- Modify: `backend/src/openapi.rs`

**Step 1: Add the new handler path**

Add after `crate::handlers::analytics::get_analytics_report,` (line 271):

```rust
                crate::handlers::analytics::get_page_analytics,
```

**Step 2: Add the new schema types**

Add after `crate::dto::analytics::AnalyticsMaintenanceResponse,` (line 338):

```rust
        crate::dto::analytics::ReferrerItem,
        crate::dto::analytics::AnalyticsPageDetailResponse,
```

**Step 3: Verify it compiles**

Run: `cd /Users/dominikdorfstetter/repos/privat/forja/backend && cargo check 2>&1 | tail -5`
Expected: Compiles successfully.

**Step 4: Run backend formatting and linting**

Run: `cd /Users/dominikdorfstetter/repos/privat/forja/backend && cargo fmt && cargo clippy -- -D warnings 2>&1 | tail -10`
Expected: No errors.

**Step 5: Commit**

```bash
git add backend/src/openapi.rs
git commit -m "feat(analytics): register page detail endpoint in OpenAPI"
```

---

## Phase 2: Frontend Foundation

### Task 6: Add TypeScript Types, API Methods, and Mock Setup

**Files:**
- Modify: `admin/src/types/api.ts`
- Modify: `admin/src/services/api.ts`
- Modify: `admin/src/test/setup.ts`

**Step 1: Add new types to api.ts**

Add after the `AnalyticsMaintenanceResponse` interface (after line 1535):

```typescript
export interface ReferrerItem {
  domain: string;
  views: number;
}

export interface AnalyticsPageDetailResponse {
  path: string;
  total_views: number;
  total_unique_visitors: number;
  trend: TrendDataPoint[];
  referrers: ReferrerItem[];
}

export interface AnalyticsReportParams {
  days?: number;
  topN?: number;
  startDate?: string;
  endDate?: string;
}

export interface AnalyticsPageDetailParams {
  path: string;
  days?: number;
  startDate?: string;
  endDate?: string;
}
```

**Step 2: Update getAnalyticsReport and add getAnalyticsPageDetail in api.ts**

Replace the existing `getAnalyticsReport` method (lines 1067-1075) with:

```typescript
  async getAnalyticsReport(
    siteId: string,
    params?: AnalyticsReportParams,
  ): Promise<AnalyticsReportResponse> {
    return apiRequest<AnalyticsReportResponse>('GET', `/sites/${siteId}/analytics/report`, undefined, {
      params: {
        days: params?.days,
        top_n: params?.topN,
        start_date: params?.startDate,
        end_date: params?.endDate,
      },
    });
  }

  async getAnalyticsPageDetail(
    siteId: string,
    params: AnalyticsPageDetailParams,
  ): Promise<AnalyticsPageDetailResponse> {
    return apiRequest<AnalyticsPageDetailResponse>('GET', `/sites/${siteId}/analytics/report/page`, undefined, {
      params: {
        path: params.path,
        days: params.days,
        start_date: params.startDate,
        end_date: params.endDate,
      },
    });
  }
```

Also add `AnalyticsPageDetailResponse`, `ReferrerItem`, `AnalyticsReportParams`, `AnalyticsPageDetailParams` to the import from `@/types/api` at the top of api.ts.

**Step 3: Update the mock in setup.ts**

Add after `getAnalyticsReport: vi.fn(),` (line 160):

```typescript
    getAnalyticsPageDetail: vi.fn(),
```

**Step 4: Update useAnalyticsData hook for backward compatibility**

Modify `admin/src/hooks/useAnalyticsData.ts` — update the `apiService.getAnalyticsReport` call to use the new params object:

```typescript
import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useSiteContext } from '@/store/SiteContext';
import { useSiteContextData } from '@/hooks/useSiteContextData';

export function useAnalyticsData(days: number = 30) {
  const { selectedSiteId } = useSiteContext();
  const { context } = useSiteContextData();
  const analyticsEnabled = context.features.analytics;

  const { data: report, isLoading } = useQuery({
    queryKey: ['analytics-report', selectedSiteId, days],
    queryFn: () => apiService.getAnalyticsReport(selectedSiteId!, { days }),
    enabled: !!selectedSiteId && analyticsEnabled,
  });

  return {
    report,
    isLoading,
    analyticsEnabled,
  };
}
```

**Step 5: Verify TypeScript compiles**

Run: `cd /Users/dominikdorfstetter/repos/privat/forja/admin && npx tsc --noEmit 2>&1 | tail -10`
Expected: No errors.

**Step 6: Commit**

```bash
git add admin/src/types/api.ts admin/src/services/api.ts admin/src/test/setup.ts admin/src/hooks/useAnalyticsData.ts
git commit -m "feat(analytics): add page detail types, API method, and mock setup"
```

---

### Task 7: Add i18n Translations

**Files:**
- Modify: `admin/src/i18n/locales/en.json` (and all 7 other locale files)

**Step 1: Add analytics page keys to en.json**

Add a new top-level `"analytics"` section (find appropriate alphabetical position):

```json
  "analytics": {
    "title": "Analytics",
    "totalViews": "Total Views",
    "uniqueVisitors": "Unique Visitors",
    "avgViewsPerDay": "Avg. Views/Day",
    "topContent": "Top Content",
    "referrers": "Referrers",
    "noData": "No data for this period",
    "backToOverview": "Back to Analytics",
    "viewAnalytics": "View Analytics",
    "pageDetail": "Page Detail",
    "notEnabled": "Analytics is not enabled for this site. Enable it in Settings.",
    "dateRange": {
      "7days": "7 days",
      "30days": "30 days",
      "90days": "90 days",
      "allTime": "All time",
      "custom": "Custom"
    }
  }
```

Also add sidebar translation key in the `"layout"` → `"sidebar"` section:

```json
    "analytics": "Analytics"
```

**Step 2: Copy to all other locale files (de, fr, es, it, pt, nl, pl)**

Translate the keys appropriately for each language. Keep the same JSON structure.

**Step 3: Commit**

```bash
git add admin/src/i18n/locales/*.json
git commit -m "feat(analytics): add i18n translations for analytics dashboard"
```

---

## Phase 3: Frontend Shared Components

### Task 8: StatCard Component

**Files:**
- Create: `admin/src/pages/Analytics/components/StatCard.tsx`
- Create: `admin/src/pages/Analytics/components/__tests__/StatCard.test.tsx`

**Step 1: Write the test**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatCard from '../StatCard';

describe('StatCard', () => {
  it('renders label and formatted value', () => {
    render(<StatCard label="Total Views" value={12345} />);
    expect(screen.getByText('Total Views')).toBeInTheDocument();
    expect(screen.getByText('12,345')).toBeInTheDocument();
  });

  it('shows skeleton when loading', () => {
    const { container } = render(<StatCard label="Total Views" value={0} loading />);
    expect(container.querySelector('.MuiSkeleton-root')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/dominikdorfstetter/repos/privat/forja/admin && npx vitest run src/pages/Analytics/components/__tests__/StatCard.test.tsx 2>&1 | tail -10`
Expected: FAIL (module not found).

**Step 3: Implement StatCard**

```typescript
import { Box, Paper, Skeleton, Typography } from '@mui/material';

interface StatCardProps {
  label: string;
  value: number;
  loading?: boolean;
}

export default function StatCard({ label, value, loading }: StatCardProps) {
  return (
    <Paper sx={{ p: 2, flex: 1, minWidth: 140 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      {loading ? (
        <Skeleton variant="text" width={80} height={36} />
      ) : (
        <Typography variant="h5" fontWeight="bold">
          {value.toLocaleString()}
        </Typography>
      )}
    </Paper>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/dominikdorfstetter/repos/privat/forja/admin && npx vitest run src/pages/Analytics/components/__tests__/StatCard.test.tsx 2>&1 | tail -10`
Expected: PASS.

**Step 5: Commit**

```bash
git add admin/src/pages/Analytics/components/StatCard.tsx admin/src/pages/Analytics/components/__tests__/StatCard.test.tsx
git commit -m "feat(analytics): add StatCard component with tests"
```

---

### Task 9: DateRangeBar Component

**Files:**
- Create: `admin/src/pages/Analytics/components/DateRangeBar.tsx`
- Create: `admin/src/pages/Analytics/components/__tests__/DateRangeBar.test.tsx`

**Step 1: Write the test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import DateRangeBar from '../DateRangeBar';

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>{ui}</LocalizationProvider>
    </ThemeProvider>,
  );
}

describe('DateRangeBar', () => {
  it('renders preset chips', () => {
    const onChange = vi.fn();
    renderWithTheme(<DateRangeBar value={{ preset: '30d' }} onChange={onChange} />);
    expect(screen.getByText('7 days')).toBeInTheDocument();
    expect(screen.getByText('30 days')).toBeInTheDocument();
    expect(screen.getByText('90 days')).toBeInTheDocument();
    expect(screen.getByText('All time')).toBeInTheDocument();
  });

  it('calls onChange when a preset is clicked', () => {
    const onChange = vi.fn();
    renderWithTheme(<DateRangeBar value={{ preset: '30d' }} onChange={onChange} />);
    fireEvent.click(screen.getByText('7 days'));
    expect(onChange).toHaveBeenCalledWith({ preset: '7d' });
  });

  it('highlights the active preset', () => {
    const onChange = vi.fn();
    renderWithTheme(<DateRangeBar value={{ preset: '7d' }} onChange={onChange} />);
    const chip = screen.getByText('7 days').closest('div');
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/dominikdorfstetter/repos/privat/forja/admin && npx vitest run src/pages/Analytics/components/__tests__/DateRangeBar.test.tsx 2>&1 | tail -10`
Expected: FAIL.

**Step 3: Implement DateRangeBar**

```typescript
import { useState } from 'react';
import { Chip, Stack, Popover, Box, Button } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useTranslation } from 'react-i18next';

export type DatePreset = '7d' | '30d' | '90d' | 'all';

export interface DateRangeValue {
  preset?: DatePreset;
  startDate?: Date;
  endDate?: Date;
}

interface DateRangeBarProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
}

const PRESETS: { key: DatePreset; i18nKey: string; fallback: string }[] = [
  { key: '7d', i18nKey: 'analytics.dateRange.7days', fallback: '7 days' },
  { key: '30d', i18nKey: 'analytics.dateRange.30days', fallback: '30 days' },
  { key: '90d', i18nKey: 'analytics.dateRange.90days', fallback: '90 days' },
  { key: 'all', i18nKey: 'analytics.dateRange.allTime', fallback: 'All time' },
];

export function presetToDays(preset: DatePreset): number | undefined {
  switch (preset) {
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
    case 'all': return 365;
  }
}

export default function DateRangeBar({ value, onChange }: DateRangeBarProps) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [tempStart, setTempStart] = useState<Date | null>(value.startDate ?? null);
  const [tempEnd, setTempEnd] = useState<Date | null>(value.endDate ?? null);

  const isCustom = !value.preset && value.startDate && value.endDate;

  const handleApplyCustom = () => {
    if (tempStart && tempEnd) {
      onChange({ startDate: tempStart, endDate: tempEnd });
      setAnchorEl(null);
    }
  };

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
      {PRESETS.map(({ key, i18nKey, fallback }) => (
        <Chip
          key={key}
          label={t(i18nKey, fallback)}
          variant={value.preset === key ? 'filled' : 'outlined'}
          color={value.preset === key ? 'primary' : 'default'}
          onClick={() => onChange({ preset: key })}
          aria-pressed={value.preset === key}
        />
      ))}
      <Chip
        label={t('analytics.dateRange.custom', 'Custom')}
        variant={isCustom ? 'filled' : 'outlined'}
        color={isCustom ? 'primary' : 'default'}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-pressed={!!isCustom}
      />
      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <DatePicker label="Start date" value={tempStart} onChange={setTempStart} />
          <DatePicker label="End date" value={tempEnd} onChange={setTempEnd} />
          <Button variant="contained" onClick={handleApplyCustom} disabled={!tempStart || !tempEnd}>
            Apply
          </Button>
        </Box>
      </Popover>
    </Stack>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/dominikdorfstetter/repos/privat/forja/admin && npx vitest run src/pages/Analytics/components/__tests__/DateRangeBar.test.tsx 2>&1 | tail -10`
Expected: PASS.

**Step 5: Commit**

```bash
git add admin/src/pages/Analytics/components/DateRangeBar.tsx admin/src/pages/Analytics/components/__tests__/DateRangeBar.test.tsx
git commit -m "feat(analytics): add DateRangeBar component with preset chips and custom picker"
```

---

### Task 10: TrendChart Component

**Files:**
- Create: `admin/src/pages/Analytics/components/TrendChart.tsx`
- Create: `admin/src/pages/Analytics/components/__tests__/TrendChart.test.tsx`

**Step 1: Write the test**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import TrendChart from '../TrendChart';

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);
}

describe('TrendChart', () => {
  it('renders empty state when no data', () => {
    renderWithTheme(<TrendChart data={[]} />);
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });

  it('renders chart container when data is present', () => {
    const data = [
      { date: '2026-03-01', total_views: 100, unique_visitors: 50 },
      { date: '2026-03-02', total_views: 120, unique_visitors: 60 },
    ];
    const { container } = renderWithTheme(<TrendChart data={data} />);
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });

  it('shows skeleton when loading', () => {
    const { container } = renderWithTheme(<TrendChart data={[]} loading />);
    expect(container.querySelector('.MuiSkeleton-root')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/dominikdorfstetter/repos/privat/forja/admin && npx vitest run src/pages/Analytics/components/__tests__/TrendChart.test.tsx 2>&1 | tail -10`
Expected: FAIL.

**Step 3: Implement TrendChart**

```typescript
import { Box, Skeleton, Typography, useTheme } from '@mui/material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import type { TrendDataPoint } from '@/types/api';

interface TrendChartProps {
  data: TrendDataPoint[];
  height?: number;
  loading?: boolean;
  compact?: boolean;
}

export default function TrendChart({ data, height = 300, loading, compact }: TrendChartProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (loading) {
    return <Skeleton variant="rounded" height={height} />;
  }

  if (data.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        {t('analytics.noData', 'No data for this period')}
      </Typography>
    );
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <Box sx={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          {!compact && <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />}
          {!compact && (
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
              stroke={theme.palette.divider}
            />
          )}
          {!compact && (
            <YAxis
              tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
              stroke={theme.palette.divider}
            />
          )}
          <Tooltip
            labelFormatter={formatDate}
            contentStyle={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 8,
              fontSize: '0.85rem',
            }}
          />
          {!compact && <Legend />}
          <Area
            type="monotone"
            dataKey="total_views"
            name={t('analytics.totalViews', 'Total Views')}
            stroke={theme.palette.primary.main}
            fill={theme.palette.primary.main}
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="unique_visitors"
            name={t('analytics.uniqueVisitors', 'Unique Visitors')}
            stroke={theme.palette.secondary.main}
            fill={theme.palette.secondary.main}
            fillOpacity={0.1}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/dominikdorfstetter/repos/privat/forja/admin && npx vitest run src/pages/Analytics/components/__tests__/TrendChart.test.tsx 2>&1 | tail -10`
Expected: PASS.

**Step 5: Commit**

```bash
git add admin/src/pages/Analytics/components/TrendChart.tsx admin/src/pages/Analytics/components/__tests__/TrendChart.test.tsx
git commit -m "feat(analytics): add TrendChart area chart component with tests"
```

---

### Task 11: TopContentTable Component

**Files:**
- Create: `admin/src/pages/Analytics/components/TopContentTable.tsx`
- Create: `admin/src/pages/Analytics/components/__tests__/TopContentTable.test.tsx`

**Step 1: Write the test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TopContentTable from '../TopContentTable';

describe('TopContentTable', () => {
  const items = [
    { path: '/blog/post-1', total_views: 100, unique_visitors: 50 },
    { path: '/blog/post-2', total_views: 80, unique_visitors: 40 },
  ];

  it('renders all content items', () => {
    render(<TopContentTable items={items} onRowClick={vi.fn()} />);
    expect(screen.getByText('/blog/post-1')).toBeInTheDocument();
    expect(screen.getByText('/blog/post-2')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('calls onRowClick with the path when a row is clicked', () => {
    const onRowClick = vi.fn();
    render(<TopContentTable items={items} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText('/blog/post-1'));
    expect(onRowClick).toHaveBeenCalledWith('/blog/post-1');
  });

  it('renders empty state when no items', () => {
    render(<TopContentTable items={[]} onRowClick={vi.fn()} />);
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails, then implement**

```typescript
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { TopContentItem } from '@/types/api';

interface TopContentTableProps {
  items: TopContentItem[];
  onRowClick: (path: string) => void;
  loading?: boolean;
}

export default function TopContentTable({ items, onRowClick, loading }: TopContentTableProps) {
  const { t } = useTranslation();

  if (!loading && items.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        {t('analytics.noData', 'No data for this period')}
      </Typography>
    );
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('dashboard.analytics.path', 'Path')}</TableCell>
            <TableCell align="right">{t('dashboard.analytics.views', 'Views')}</TableCell>
            <TableCell align="right">{t('dashboard.analytics.visitors', 'Visitors')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item.path}
              hover
              onClick={() => onRowClick(item.path)}
              sx={{ cursor: 'pointer' }}
            >
              <TableCell
                sx={{
                  maxWidth: 300,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.path}
              </TableCell>
              <TableCell align="right">{item.total_views.toLocaleString()}</TableCell>
              <TableCell align="right">{item.unique_visitors.toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
```

**Step 3: Run test to verify it passes**

Run: `cd /Users/dominikdorfstetter/repos/privat/forja/admin && npx vitest run src/pages/Analytics/components/__tests__/TopContentTable.test.tsx 2>&1 | tail -10`
Expected: PASS.

**Step 4: Commit**

```bash
git add admin/src/pages/Analytics/components/TopContentTable.tsx admin/src/pages/Analytics/components/__tests__/TopContentTable.test.tsx
git commit -m "feat(analytics): add TopContentTable component with clickable rows"
```

---

### Task 12: ReferrerChart Component

**Files:**
- Create: `admin/src/pages/Analytics/components/ReferrerChart.tsx`
- Create: `admin/src/pages/Analytics/components/__tests__/ReferrerChart.test.tsx`

**Step 1: Write the test**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import ReferrerChart from '../ReferrerChart';

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);
}

describe('ReferrerChart', () => {
  it('renders empty state when no data', () => {
    renderWithTheme(<ReferrerChart data={[]} />);
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });

  it('renders chart container when data is present', () => {
    const data = [
      { domain: 'google.com', views: 100 },
      { domain: '(direct)', views: 80 },
    ];
    const { container } = renderWithTheme(<ReferrerChart data={data} />);
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails, then implement**

```typescript
import { Box, Skeleton, Typography, useTheme } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useTranslation } from 'react-i18next';
import type { ReferrerItem } from '@/types/api';

interface ReferrerChartProps {
  data: ReferrerItem[];
  height?: number;
  loading?: boolean;
}

export default function ReferrerChart({ data, height = 300, loading }: ReferrerChartProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (loading) {
    return <Skeleton variant="rounded" height={height} />;
  }

  if (data.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        {t('analytics.noData', 'No data for this period')}
      </Typography>
    );
  }

  return (
    <Box sx={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
            stroke={theme.palette.divider}
          />
          <YAxis
            dataKey="domain"
            type="category"
            tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
            stroke={theme.palette.divider}
            width={80}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 8,
              fontSize: '0.85rem',
            }}
          />
          <Bar
            dataKey="views"
            fill={theme.palette.primary.main}
            radius={[0, 4, 4, 0]}
            name={t('dashboard.analytics.views', 'Views')}
          />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
```

**Step 3: Run test to verify it passes**

Run: `cd /Users/dominikdorfstetter/repos/privat/forja/admin && npx vitest run src/pages/Analytics/components/__tests__/ReferrerChart.test.tsx 2>&1 | tail -10`
Expected: PASS.

**Step 4: Commit**

```bash
git add admin/src/pages/Analytics/components/ReferrerChart.tsx admin/src/pages/Analytics/components/__tests__/ReferrerChart.test.tsx
git commit -m "feat(analytics): add ReferrerChart horizontal bar chart component"
```

---

## Phase 4: Frontend Pages & Hooks

### Task 13: useAnalyticsReport Hook (Enhanced)

**Files:**
- Create: `admin/src/hooks/useAnalyticsReport.ts`
- Create: `admin/src/hooks/__tests__/useAnalyticsReport.test.ts`

**Step 1: Write the test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useAnalyticsReport } from '../useAnalyticsReport';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({ selectedSiteId: 'site-1' }),
}));

vi.mock('@/hooks/useSiteContextData', () => ({
  useSiteContextData: () => ({ context: { features: { analytics: true } } }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe('useAnalyticsReport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches report with days preset', async () => {
    const mockReport = { total_views: 100, total_unique_visitors: 50, top_content: [], trend: [] };
    vi.mocked(apiService.getAnalyticsReport).mockResolvedValue(mockReport);

    const { result } = renderHook(() => useAnalyticsReport({ preset: '30d' }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiService.getAnalyticsReport).toHaveBeenCalledWith('site-1', { days: 30 });
    expect(result.current.report).toEqual(mockReport);
  });
});
```

**Step 2: Run test to verify it fails, then implement**

```typescript
import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useSiteContext } from '@/store/SiteContext';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import type { DateRangeValue } from '@/pages/Analytics/components/DateRangeBar';
import { presetToDays } from '@/pages/Analytics/components/DateRangeBar';
import type { AnalyticsReportParams } from '@/types/api';

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function buildParams(range: DateRangeValue): AnalyticsReportParams {
  if (range.preset) {
    return { days: presetToDays(range.preset) };
  }
  if (range.startDate && range.endDate) {
    return { startDate: toISODate(range.startDate), endDate: toISODate(range.endDate) };
  }
  return { days: 30 };
}

export function useAnalyticsReport(range: DateRangeValue) {
  const { selectedSiteId } = useSiteContext();
  const { context } = useSiteContextData();
  const analyticsEnabled = context.features.analytics;

  const params = buildParams(range);

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['analytics-report', selectedSiteId, params],
    queryFn: () => apiService.getAnalyticsReport(selectedSiteId!, params),
    enabled: !!selectedSiteId && analyticsEnabled,
  });

  return { report, isLoading, error, analyticsEnabled };
}
```

**Step 3: Run test to verify it passes**

Run: `cd /Users/dominikdorfstetter/repos/privat/forja/admin && npx vitest run src/hooks/__tests__/useAnalyticsReport.test.ts 2>&1 | tail -10`
Expected: PASS.

**Step 4: Commit**

```bash
git add admin/src/hooks/useAnalyticsReport.ts admin/src/hooks/__tests__/useAnalyticsReport.test.ts
git commit -m "feat(analytics): add useAnalyticsReport hook with date range support"
```

---

### Task 14: useAnalyticsPageDetail Hook

**Files:**
- Create: `admin/src/hooks/useAnalyticsPageDetail.ts`
- Create: `admin/src/hooks/__tests__/useAnalyticsPageDetail.test.ts`

**Step 1: Write the test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useAnalyticsPageDetail } from '../useAnalyticsPageDetail';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({ selectedSiteId: 'site-1' }),
}));

vi.mock('@/hooks/useSiteContextData', () => ({
  useSiteContextData: () => ({ context: { features: { analytics: true } } }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe('useAnalyticsPageDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches page detail with path and days', async () => {
    const mockDetail = {
      path: '/blog/post-1',
      total_views: 100,
      total_unique_visitors: 50,
      trend: [],
      referrers: [],
    };
    vi.mocked(apiService.getAnalyticsPageDetail).mockResolvedValue(mockDetail);

    const { result } = renderHook(
      () => useAnalyticsPageDetail('/blog/post-1', { preset: '30d' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiService.getAnalyticsPageDetail).toHaveBeenCalledWith('site-1', {
      path: '/blog/post-1',
      days: 30,
    });
    expect(result.current.detail).toEqual(mockDetail);
  });
});
```

**Step 2: Run test to verify it fails, then implement**

```typescript
import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useSiteContext } from '@/store/SiteContext';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import type { DateRangeValue } from '@/pages/Analytics/components/DateRangeBar';
import { presetToDays } from '@/pages/Analytics/components/DateRangeBar';
import type { AnalyticsPageDetailParams } from '@/types/api';

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function buildParams(path: string, range: DateRangeValue): AnalyticsPageDetailParams {
  if (range.preset) {
    return { path, days: presetToDays(range.preset) };
  }
  if (range.startDate && range.endDate) {
    return { path, startDate: toISODate(range.startDate), endDate: toISODate(range.endDate) };
  }
  return { path, days: 30 };
}

export function useAnalyticsPageDetail(path: string, range: DateRangeValue) {
  const { selectedSiteId } = useSiteContext();
  const { context } = useSiteContextData();
  const analyticsEnabled = context.features.analytics;

  const params = buildParams(path, range);

  const { data: detail, isLoading, error } = useQuery({
    queryKey: ['analytics-page-detail', selectedSiteId, params],
    queryFn: () => apiService.getAnalyticsPageDetail(selectedSiteId!, params),
    enabled: !!selectedSiteId && !!path && analyticsEnabled,
  });

  return { detail, isLoading, error, analyticsEnabled };
}
```

**Step 3: Run test to verify it passes, then commit**

```bash
git add admin/src/hooks/useAnalyticsPageDetail.ts admin/src/hooks/__tests__/useAnalyticsPageDetail.test.ts
git commit -m "feat(analytics): add useAnalyticsPageDetail hook"
```

---

### Task 15: AnalyticsOverview Page

**Files:**
- Create: `admin/src/pages/Analytics/AnalyticsOverview.tsx`
- Create: `admin/src/pages/Analytics/index.ts`
- Create: `admin/src/pages/Analytics/__tests__/AnalyticsOverview.test.tsx`

**Step 1: Write the test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import apiService from '@/services/api';
import AnalyticsOverview from '../AnalyticsOverview';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({ selectedSiteId: 'site-1' }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/hooks/useSiteContextData', () => ({
  useSiteContextData: () => ({ context: { features: { analytics: true } } }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockReport = {
  total_views: 1234,
  total_unique_visitors: 567,
  top_content: [
    { path: '/blog/post-1', total_views: 100, unique_visitors: 50 },
    { path: '/blog/post-2', total_views: 80, unique_visitors: 40 },
  ],
  trend: [
    { date: '2026-03-01', total_views: 100, unique_visitors: 50 },
    { date: '2026-03-02', total_views: 120, unique_visitors: 60 },
  ],
};

describe('AnalyticsOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiService.getAnalyticsReport).mockResolvedValue(mockReport);
  });

  it('renders stat cards with report data', async () => {
    renderWithProviders(<AnalyticsOverview />);
    expect(await screen.findByText('1,234')).toBeInTheDocument();
    expect(await screen.findByText('567')).toBeInTheDocument();
  });

  it('renders top content table', async () => {
    renderWithProviders(<AnalyticsOverview />);
    expect(await screen.findByText('/blog/post-1')).toBeInTheDocument();
    expect(await screen.findByText('/blog/post-2')).toBeInTheDocument();
  });

  it('navigates to page detail on row click', async () => {
    renderWithProviders(<AnalyticsOverview />);
    const row = await screen.findByText('/blog/post-1');
    fireEvent.click(row);
    expect(mockNavigate).toHaveBeenCalledWith(
      `/analytics/page/${btoa('/blog/post-1')}`,
    );
  });
});
```

**Step 2: Run test to verify it fails, then implement**

`admin/src/pages/Analytics/AnalyticsOverview.tsx`:

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert, Box, Paper, Stack, Typography } from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import { useTranslation } from 'react-i18next';

import { useAnalyticsReport } from '@/hooks/useAnalyticsReport';
import DateRangeBar, { type DateRangeValue } from './components/DateRangeBar';
import StatCard from './components/StatCard';
import TrendChart from './components/TrendChart';
import TopContentTable from './components/TopContentTable';

export default function AnalyticsOverview() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [range, setRange] = useState<DateRangeValue>({ preset: '30d' });
  const { report, isLoading, error, analyticsEnabled } = useAnalyticsReport(range);

  if (!analyticsEnabled) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">{t('analytics.notEnabled')}</Alert>
      </Box>
    );
  }

  const avgPerDay =
    report && report.trend.length > 0
      ? Math.round(report.total_views / report.trend.length)
      : 0;

  const handleRowClick = (path: string) => {
    navigate(`/analytics/page/${btoa(path)}`);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <BarChartIcon color="primary" />
        <Typography variant="h5" component="h1">
          {t('analytics.title', 'Analytics')}
        </Typography>
      </Stack>

      <DateRangeBar value={range} onChange={setRange} />

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to load analytics data. Please try again.
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
        <StatCard
          label={t('analytics.totalViews', 'Total Views')}
          value={report?.total_views ?? 0}
          loading={isLoading}
        />
        <StatCard
          label={t('analytics.uniqueVisitors', 'Unique Visitors')}
          value={report?.total_unique_visitors ?? 0}
          loading={isLoading}
        />
        <StatCard
          label={t('analytics.avgViewsPerDay', 'Avg. Views/Day')}
          value={avgPerDay}
          loading={isLoading}
        />
      </Stack>

      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {t('analytics.totalViews', 'Total Views')}
        </Typography>
        <TrendChart data={report?.trend ?? []} loading={isLoading} />
      </Paper>

      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {t('analytics.topContent', 'Top Content')}
        </Typography>
        <TopContentTable
          items={report?.top_content ?? []}
          onRowClick={handleRowClick}
          loading={isLoading}
        />
      </Paper>
    </Box>
  );
}
```

`admin/src/pages/Analytics/index.ts`:

```typescript
export { default as AnalyticsOverview } from './AnalyticsOverview';
export { default as AnalyticsPageDetail } from './AnalyticsPageDetail';
```

**Step 3: Run test to verify it passes, then commit**

```bash
git add admin/src/pages/Analytics/
git commit -m "feat(analytics): add AnalyticsOverview page with trend chart and top content"
```

---

### Task 16: AnalyticsPageDetail Page

**Files:**
- Create: `admin/src/pages/Analytics/AnalyticsPageDetail.tsx`
- Create: `admin/src/pages/Analytics/__tests__/AnalyticsPageDetail.test.tsx`

**Step 1: Write the test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import apiService from '@/services/api';
import AnalyticsPageDetail from '../AnalyticsPageDetail';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({ selectedSiteId: 'site-1' }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/hooks/useSiteContextData', () => ({
  useSiteContextData: () => ({ context: { features: { analytics: true } } }),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ encodedPath: btoa('/blog/post-1') }),
    useNavigate: () => vi.fn(),
  };
});

const mockDetail = {
  path: '/blog/post-1',
  total_views: 100,
  total_unique_visitors: 50,
  trend: [{ date: '2026-03-01', total_views: 100, unique_visitors: 50 }],
  referrers: [
    { domain: 'google.com', views: 60 },
    { domain: '(direct)', views: 40 },
  ],
};

describe('AnalyticsPageDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiService.getAnalyticsPageDetail).mockResolvedValue(mockDetail);
  });

  it('renders page path in heading', async () => {
    renderWithProviders(<AnalyticsPageDetail />);
    expect(await screen.findByText('/blog/post-1')).toBeInTheDocument();
  });

  it('renders stat cards', async () => {
    renderWithProviders(<AnalyticsPageDetail />);
    expect(await screen.findByText('100')).toBeInTheDocument();
    expect(await screen.findByText('50')).toBeInTheDocument();
  });

  it('renders back link', async () => {
    renderWithProviders(<AnalyticsPageDetail />);
    expect(await screen.findByText(/back to analytics/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails, then implement**

```typescript
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useTranslation } from 'react-i18next';

import { useAnalyticsPageDetail } from '@/hooks/useAnalyticsPageDetail';
import DateRangeBar, { type DateRangeValue } from './components/DateRangeBar';
import StatCard from './components/StatCard';
import TrendChart from './components/TrendChart';
import ReferrerChart from './components/ReferrerChart';

export default function AnalyticsPageDetail() {
  const { t } = useTranslation();
  const { encodedPath } = useParams<{ encodedPath: string }>();
  const navigate = useNavigate();
  const [range, setRange] = useState<DateRangeValue>({ preset: '30d' });

  let pagePath = '';
  try {
    pagePath = atob(encodedPath ?? '');
  } catch {
    pagePath = '';
  }

  const { detail, isLoading, error, analyticsEnabled } = useAnalyticsPageDetail(pagePath, range);

  if (!analyticsEnabled) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">{t('analytics.notEnabled')}</Alert>
      </Box>
    );
  }

  if (!pagePath) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Invalid page path</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/analytics')}
        sx={{ mb: 2 }}
      >
        {t('analytics.backToOverview', 'Back to Analytics')}
      </Button>

      <Typography variant="h5" component="h1" sx={{ mb: 3 }}>
        {pagePath}
      </Typography>

      <DateRangeBar value={range} onChange={setRange} />

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to load page analytics. Please try again.
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
        <StatCard
          label={t('analytics.totalViews', 'Total Views')}
          value={detail?.total_views ?? 0}
          loading={isLoading}
        />
        <StatCard
          label={t('analytics.uniqueVisitors', 'Unique Visitors')}
          value={detail?.total_unique_visitors ?? 0}
          loading={isLoading}
        />
      </Stack>

      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {t('analytics.totalViews', 'Total Views')}
        </Typography>
        <TrendChart data={detail?.trend ?? []} loading={isLoading} />
      </Paper>

      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {t('analytics.referrers', 'Referrers')}
        </Typography>
        <ReferrerChart data={detail?.referrers ?? []} loading={isLoading} />
      </Paper>
    </Box>
  );
}
```

**Step 3: Run test to verify it passes, then commit**

```bash
git add admin/src/pages/Analytics/AnalyticsPageDetail.tsx admin/src/pages/Analytics/__tests__/AnalyticsPageDetail.test.tsx admin/src/pages/Analytics/index.ts
git commit -m "feat(analytics): add AnalyticsPageDetail page with trend and referrer charts"
```

---

## Phase 5: Integration

### Task 17: Route Registration + Sidebar Link

**Files:**
- Modify: `admin/src/App.tsx`
- Modify: `admin/src/components/Layout.tsx`

**Step 1: Add routes to App.tsx**

Add import at top of `App.tsx` (after the other page imports, around line 40):

```typescript
import { AnalyticsOverview, AnalyticsPageDetail } from '@/pages/Analytics';
```

Add routes inside the authenticated route group (after `<Route path="activity" .../>` around line 148):

```typescript
                  <Route path="analytics" element={<AnalyticsOverview />} />
                  <Route path="analytics/page/:encodedPath" element={<AnalyticsPageDetail />} />
```

**Step 2: Add sidebar navigation item in Layout.tsx**

Import the icon (add to MUI icon imports):

```typescript
import BarChartIcon from '@mui/icons-material/BarChart';
```

Add an analytics nav item in the appropriate section of `allMenuSections` (in the "SITE" section, conditionally shown when analytics is enabled):

```typescript
{ text: t('layout.sidebar.analytics'), icon: <BarChartIcon />, path: '/analytics' },
```

Note: This item should be conditionally included based on `analyticsEnabled` from site context, similar to how other feature-gated items are handled.

**Step 3: Verify TypeScript compiles**

Run: `cd /Users/dominikdorfstetter/repos/privat/forja/admin && npx tsc --noEmit 2>&1 | tail -10`
Expected: No errors.

**Step 4: Commit**

```bash
git add admin/src/App.tsx admin/src/components/Layout.tsx
git commit -m "feat(analytics): register analytics routes and add sidebar navigation"
```

---

### Task 18: Enhance AnalyticsWidget with Sparkline

**Files:**
- Modify: `admin/src/components/dashboard/AnalyticsWidget.tsx`

**Step 1: Add sparkline and navigation link**

Update the component to:
1. Import `Link` from `react-router` and `AreaChart`, `Area`, `ResponsiveContainer` from `recharts`
2. Add a sparkline chart below the stats row using the `report.trend` data (already returned by the hook)
3. Add a "View Analytics →" link at the bottom

Add imports:

```typescript
import { Link } from 'react-router';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { useTheme } from '@mui/material';
```

After the stats row (line 86) and before the table (line 88), add the sparkline:

```typescript
          {report!.trend.length > 0 && (
            <Box sx={{ height: 60, mb: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={report!.trend}>
                  <Area
                    type="monotone"
                    dataKey="total_views"
                    stroke={theme.palette.primary.main}
                    fill={theme.palette.primary.main}
                    fillOpacity={0.15}
                    strokeWidth={1.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          )}
```

After the table container (after line 111), add the link:

```typescript
          <Box sx={{ mt: 2, textAlign: 'right' }}>
            <Typography
              component={Link}
              to="/analytics"
              variant="body2"
              color="primary"
              sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              {t('analytics.viewAnalytics', 'View Analytics')} →
            </Typography>
          </Box>
```

**Step 2: Verify TypeScript compiles and existing tests pass**

Run: `cd /Users/dominikdorfstetter/repos/privat/forja/admin && npx tsc --noEmit && npx vitest run 2>&1 | tail -15`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add admin/src/components/dashboard/AnalyticsWidget.tsx
git commit -m "feat(analytics): enhance dashboard widget with sparkline and analytics link"
```

---

## Phase 6: Verification

### Task 19: Full Verification

**Step 1: Run backend checks**

```bash
cd /Users/dominikdorfstetter/repos/privat/forja/backend && cargo fmt --check && cargo clippy -- -D warnings && cargo test --lib 2>&1 | tail -20
```
Expected: All pass.

**Step 2: Run frontend checks**

```bash
cd /Users/dominikdorfstetter/repos/privat/forja/admin && npx tsc --noEmit && npm run lint && npx vitest run 2>&1 | tail -30
```
Expected: All pass.

**Step 3: Review all changes**

```bash
git log --oneline main..HEAD
git diff --stat main..HEAD
```

Verify: All commits follow conventional commit format, all files are accounted for.
