---
sidebar_position: 11
---

# Webhooks

Webhooks enable event-driven integrations by delivering HTTP POST requests to configured URLs when content changes occur. All webhook endpoints require Admin permission.

## Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/webhooks?page&per_page` | Admin | List webhooks (paginated) |
| GET | `/webhooks/{id}` | Admin | Get a webhook by ID |
| POST | `/sites/{site_id}/webhooks` | Admin | Create a webhook |
| PUT | `/webhooks/{id}` | Admin | Update a webhook |
| DELETE | `/webhooks/{id}` | Admin | Delete a webhook |
| POST | `/webhooks/{id}/test` | Admin | Send a test delivery |
| GET | `/webhooks/{id}/deliveries?page&per_page` | Admin | List delivery log (paginated) |
| POST | `/webhooks/deliveries/{id}/retry` | Admin | Re-enqueue a dead delivery for retry |
| GET | `/webhooks/{id}/stats?window` | Admin | Get delivery statistics |

## Automatic Retry

Failed webhook deliveries are automatically retried with exponential backoff:

| Attempt | Delay | Cumulative |
|---------|-------|------------|
| 1 | Immediate | 0s |
| 2 | 5 minutes | 5m |
| 3 | 30 minutes | 35m |
| 4 | 2 hours | 2h 35m |
| 5 | 12 hours | 14h 35m |
| 6 | 48 hours | ~62h |

After 6 failed attempts, the delivery is marked as **dead**. Dead deliveries can be manually retried via `POST /webhooks/deliveries/{id}/retry`.

A background worker polls the retry queue every 15 seconds. Each retry creates a new entry in the delivery log (append-only), preserving the full history of attempts.

## Webhook Events

Webhooks can subscribe to specific events or receive all events. The 27 supported events are:

- **Blog**: `blog.created`, `blog.updated`, `blog.deleted`, `blog.published`
- **Page**: `page.created`, `page.updated`, `page.deleted`, `page.published`
- **Legal**: `legal.created`, `legal.updated`, `legal.deleted`, `legal.published`
- **CV**: `cv.created`, `cv.updated`, `cv.deleted`, `cv.published`
- **Project**: `project.created`, `project.updated`, `project.deleted`, `project.published`
- **Document**: `document.created`, `document.updated`, `document.deleted`
- **Media**: `media.created`, `media.deleted`
- **Navigation**: `navigation.created`, `navigation.updated`, `navigation.deleted`

## Create a Webhook

A signing secret is auto-generated when a webhook is created. Use this secret to verify the authenticity of incoming webhook payloads.

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/webhooks/forja",
    "description": "Notify on content changes",
    "events": ["blog.created", "blog.updated", "page.created"]
  }' \
  https://your-domain.com/api/v1/sites/{site_id}/webhooks
```

**Response** `201 Created`

```json
{
  "id": "webhook-uuid",
  "url": "https://example.com/webhooks/forja",
  "secret": "auto-generated-uuid",
  "description": "Notify on content changes",
  "events": ["blog.created", "blog.updated", "page.created"],
  "is_active": true,
  "created_at": "2025-01-15T12:00:00Z"
}
```

## Test a Webhook

Sends a test payload to the webhook URL and returns the delivery result:

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/webhooks/{id}/test
```

## Debounce

Webhooks support a `debounce_seconds` field (0--300). When set to a value greater than 0, events are buffered and delivered as a single batch payload after the debounce window expires.

The batch payload structure:

```json
{
  "event": "batch",
  "events": [
    { "event": "blog.updated", "data": { ... } },
    { "event": "blog.updated", "data": { ... } }
  ],
  "event_count": 2,
  "batch_window_seconds": 30
}
```

A background flush worker polls every 5 seconds for ready buffers and delivers them in batches of 10.

## Delivery Log

View the history of webhook deliveries, including HTTP status codes and response times:

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  "https://your-domain.com/api/v1/webhooks/{id}/deliveries?page=1&per_page=20"
```

## Delivery Statistics

Get delivery performance statistics for a webhook over a time window:

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  "https://your-domain.com/api/v1/webhooks/{id}/stats?window=24h"
```

**Query parameters:**

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `window` | `1h`, `24h`, `7d`, `30d` | `24h` | Time window for statistics |

**Response:**

```json
{
  "webhook_id": "uuid",
  "window": "24h",
  "total_deliveries": 150,
  "successful": 145,
  "failed": 5,
  "pending_retry": 2,
  "success_rate": 96.67,
  "last_delivery_at": "2026-03-25T10:30:00Z",
  "by_event": [
    {
      "event_type": "blog.published",
      "total": 50,
      "successful": 48,
      "failed": 2
    }
  ]
}
```
