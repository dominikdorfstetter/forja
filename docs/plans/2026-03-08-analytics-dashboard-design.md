# Analytics Dashboard Design

**Date:** 2026-03-08
**Scope:** Full-stack (Backend + Frontend)
**Status:** Approved

## Overview

Add a dedicated analytics dashboard with drill-down capability to Forja CMS. The feature consists of:

1. **Enhanced dashboard widget** — sparkline chart + "View Analytics" link
2. **Analytics overview page** (`/analytics`) — date-range-aware trend chart + top content table
3. **Per-page detail page** (`/analytics/page/:encodedPath`) — individual content trend + referrer breakdown

## Architecture & Routing

### New Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/analytics` | `AnalyticsOverview` | Main analytics page with trend chart + top content |
| `/analytics/page/:encodedPath` | `AnalyticsPageDetail` | Per-page trend + referrer breakdown |

The `:encodedPath` param is base64-encoded to safely handle paths like `/blog/my-post`.

### New File Structure

```
admin/src/pages/Analytics/
  ├── AnalyticsOverview.tsx
  ├── AnalyticsPageDetail.tsx
  └── components/
      ├── DateRangeBar.tsx
      ├── TrendChart.tsx
      ├── TopContentTable.tsx
      ├── ReferrerChart.tsx
      └── StatCard.tsx

admin/src/hooks/
  ├── useAnalyticsReport.ts
  └── useAnalyticsPageDetail.ts
```

### Modified Files

- `admin/src/components/dashboard/AnalyticsWidget.tsx` — Add sparkline + "View Analytics" link
- `admin/src/App.tsx` — Add new routes
- `admin/src/services/api.ts` — Add `getAnalyticsPageDetail()` method
- `admin/src/types/api.ts` — Add new response/request types
- `admin/src/test/setup.ts` — Add new mock

## Backend API Changes

### Modified: `GET /api/sites/:site_id/analytics/report`

New query params (all optional, backward-compatible):

| Param | Type | Description |
|-------|------|-------------|
| `start_date` | ISO 8601 date | Range start (takes priority over `days`) |
| `end_date` | ISO 8601 date | Range end |
| `days` | integer | Fallback if no date range provided |
| `top_n` | integer | Number of top content items (default 10) |

Priority: `start_date`/`end_date` > `days` > default 30 days.

Response shape unchanged: `AnalyticsReportResponse`.

### New: `GET /api/sites/:site_id/analytics/report/page`

Query params:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | yes | The page path (e.g., `/blog/my-post`) |
| `start_date` | ISO 8601 date | no | Range start |
| `end_date` | ISO 8601 date | no | Range end |
| `days` | integer | no | Fallback |

Response:

```rust
pub struct AnalyticsPageDetailResponse {
    pub path: String,
    pub total_views: i64,
    pub total_unique_visitors: i64,
    pub trend: Vec<TrendDataPoint>,
    pub referrers: Vec<ReferrerItem>,
}

pub struct ReferrerItem {
    pub domain: String,    // e.g., "google.com", "(direct)"
    pub views: i64,
}
```

## Frontend Visualizations

### Dashboard Widget (Enhanced)

- Existing summary stats (total views, unique visitors)
- Small sparkline area chart (last 7 days, no axes)
- "View Analytics" link at bottom

### Analytics Overview Page

Top to bottom layout:

1. **Page header** — "Analytics" title
2. **DateRangeBar** — Preset chips (7d, 30d, 90d, All time) + "Custom" with MUI DateRangePicker
3. **StatCards row** — Total Views, Unique Visitors, Avg Views/Day
4. **TrendChart** — recharts AreaChart with two series (views solid, visitors lighter)
5. **TopContentTable** — MUI Table, clickable rows navigate to detail page

### Analytics Page Detail

1. **Back link** — "Back to Analytics"
2. **Page header** — Decoded page path
3. **DateRangeBar** — Independent state
4. **StatCards row** — Page-specific totals
5. **TrendChart** — Page-specific trend
6. **ReferrerChart** — Horizontal BarChart, top 10 referrers, sorted descending

### Shared UX

- Loading: skeleton placeholders
- Empty: "No data for this period" message
- Responsive: charts resize, stat cards stack on mobile
- Colors: MUI theme primary (views), secondary (visitors)
- Date format: localized via i18n

## Data Flow

Date range is local component state (not global). TanStack Query manages caching — changing the range creates a new query key; switching back uses cached data.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| API error | Inline MUI Alert below DateRangeBar |
| Analytics disabled | Message with link to Settings |
| Invalid page path | "Page not found" + back link |
| No data in range | Per-section empty state |

## Testing Strategy

### Backend

- Unit tests: new DTOs, date range param validation, fallback logic
- Integration test: `GET /report/page` endpoint

### Frontend

- Hook tests: `useAnalyticsReport`, `useAnalyticsPageDetail`
- Page tests: `AnalyticsOverview`, `AnalyticsPageDetail`
- Component test: `DateRangeBar`
- All tests use `renderWithProviders` and mock `apiService`

## i18n

New keys added to all 8 locale files (en, de, fr, es, it, pt, nl, pl):

- `analytics.title`, `analytics.totalViews`, `analytics.uniqueVisitors`, `analytics.avgViewsPerDay`
- `analytics.topContent`, `analytics.referrers`, `analytics.noData`, `analytics.backToOverview`
- `analytics.dateRange.*` (7days, 30days, 90days, allTime, custom)
- `analytics.viewAnalytics`, `analytics.pageDetail`, `analytics.notEnabled`
