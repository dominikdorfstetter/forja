---
sidebar_position: 18
---

# Analytics

Forja includes a privacy-first analytics system that tracks pageviews without cookies, IP storage, or personally identifiable information. It is designed to be GDPR-compliant by default.

:::info
Analytics is a **site module**. Enable it during site creation or in **Settings > Modules** before it appears in the dashboard.
:::

## Privacy Architecture

Forja analytics is built on a privacy-by-design foundation:

- **No cookies** -- tracking is fully stateless.
- **No IP storage** -- client IP addresses are used only in a one-way hash computation, never persisted.
- **No User-Agent storage** -- the User-Agent string participates in hashing but is discarded.
- **Daily rotating visitor hash** -- a SHA-256 hash of `site_id + date + IP + User-Agent`, truncated to 16 hex characters. The daily rotation prevents cross-day tracking.
- **Referrer domain only** -- full referrer URLs are discarded; only the domain is kept.
- **Auto-pruning** -- raw pageview events are automatically deleted after a configurable retention period (default: 90 days). Only aggregate statistics survive long-term.

Because analytics collects no personal data, it operates under **legitimate interest** -- no cookie banner or consent prompt is needed.

## Enabling Analytics

1. Navigate to **Settings** in the sidebar.
2. Open the **Modules** tab.
3. Toggle **Analytics** to enabled and save.

Once enabled, the dashboard displays an analytics widget and the tracking endpoints become active.

## Dashboard Widget

The analytics widget appears on the main **Dashboard** page when analytics is enabled. It shows:

- **Total Views** -- total pageviews over the selected period.
- **Unique Visitors** -- distinct visitors (based on daily rotating hashes).
- **Top Content** -- the most-viewed paths ranked by view count.
- **Time Range Toggle** -- switch between 7-day and 30-day views.

If no data has been collected yet, the widget shows an empty state message.

## Data Lifecycle

Analytics data moves through two stages:

### 1. Raw Pageview Events

Every tracked pageview creates a row in `analytics_pageviews` with the path, referrer domain, visitor hash, and timestamp. These rows power real-time reports.

### 2. Daily Aggregation

A maintenance process rolls up raw events into `analytics_daily_stats` -- one row per site, path, and date with pre-computed view counts and unique visitor counts. After aggregation, raw events older than the retention period are pruned.

| Data | Retention |
|------|-----------|
| Raw pageview events | Configurable (default: 90 days) |
| Daily aggregated stats | Indefinite (already anonymous) |

## Site Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **analytics_enabled** | `false` | Master toggle for the feature |
| **analytics_retention_days** | `90` | Days to keep raw pageview events before pruning |

Both settings can be updated via the Settings page or the site settings API.

## Integrating the Tracking Script

To collect analytics data, add the `@forja/analytics` tracking library to your frontend. See the [Analytics Integration](../templates/analytics-integration) guide for setup instructions.

## Permissions

| Action | Required Role |
|--------|--------------|
| View analytics report | Read |
| Trigger aggregation / pruning | Admin |
