---
sidebar_position: 20
---

# Analytics

Endpoints for recording pageviews and querying analytics reports. All analytics data is privacy-first -- no cookies, no PII, no raw IP storage.

## Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/sites/{site_id}/analytics/pageview` | Read | Record a pageview event |
| GET | `/sites/{site_id}/analytics/report` | Read | Fetch analytics report |
| POST | `/sites/{site_id}/analytics/aggregate` | Admin | Aggregate raw events and prune old data |

## Record a Pageview

Records a single pageview event. The server computes the daily visitor hash from the client's IP and User-Agent (neither is stored). The referrer is reduced to its domain.

```bash
curl -X POST https://your-site.com/api/v1/sites/{site_id}/analytics/pageview \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/blog/hello-world",
    "referrer": "https://twitter.com/user/status/123"
  }'
```

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | Yes | The page path (e.g. `/blog/my-post`) |
| `referrer` | string | No | The full referrer URL. Only the domain is stored. |
| `user_agent_hash` | string | No | Optional client-side hash (server computes its own) |

**Response** -- `201 Created`

```json
{
  "ok": true
}
```

:::info
This endpoint is designed to be called from the `@forja/analytics` tracking library on your public site. It uses a Read-level API key so the same key that fetches content can also record pageviews.
:::

## Get Analytics Report

Returns a summary of pageview data including totals, top content, and daily trend data for charting.

```bash
curl https://your-site.com/api/v1/sites/{site_id}/analytics/report \
  -H "X-API-Key: your_api_key"
```

**Query Parameters**

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `days` | 30 | 365 | Number of days to look back |
| `top_n` | 10 | 50 | Number of top content items to return |

**Response** -- `200 OK`

```json
{
  "total_views": 1234,
  "total_unique_visitors": 567,
  "top_content": [
    {
      "path": "/blog/hello-world",
      "total_views": 142,
      "unique_visitors": 89
    },
    {
      "path": "/blog/getting-started",
      "total_views": 98,
      "unique_visitors": 71
    }
  ],
  "trend": [
    {
      "date": "2026-03-07",
      "total_views": 42,
      "unique_visitors": 28
    },
    {
      "date": "2026-03-08",
      "total_views": 38,
      "unique_visitors": 25
    }
  ]
}
```

**Response Fields**

| Field | Description |
|-------|-------------|
| `total_views` | Total pageviews in the period |
| `total_unique_visitors` | Distinct visitor hashes in the period |
| `top_content` | Paths ranked by view count, each with `total_views` and `unique_visitors` |
| `trend` | One entry per day with `date`, `total_views`, and `unique_visitors` |

## Aggregate and Prune

Admin-only maintenance endpoint that rolls up raw pageview events into daily aggregated statistics and deletes raw events older than the retention period. This is typically run as a scheduled job.

```bash
curl -X POST https://your-site.com/api/v1/sites/{site_id}/analytics/aggregate \
  -H "X-API-Key: your_admin_api_key"
```

**Query Parameters**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `retention_days` | 90 | Delete raw events older than this many days |

**Response** -- `200 OK`

```json
{
  "rows_affected": 15000,
  "action": "Aggregated 10000 rows, pruned 5000 raw events older than 90 days"
}
```

The aggregation is idempotent -- running it multiple times for the same date range produces the same result (upsert on conflict).
