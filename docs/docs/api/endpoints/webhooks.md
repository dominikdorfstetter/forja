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

## Webhook Events

Webhooks can subscribe to specific events or receive all events. Common events include:

- `blog.created`, `blog.updated`, `blog.deleted`, `blog.reviewed`
- `page.created`, `page.updated`, `page.deleted`, `page.reviewed`
- `document.created`, `document.updated`, `document.deleted`

## Create a Webhook

A signing secret is auto-generated when a webhook is created. Use this secret to verify the authenticity of incoming webhook payloads.

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/webhooks/openyapper",
    "description": "Notify on content changes",
    "events": ["blog.created", "blog.updated", "page.created"]
  }' \
  https://your-domain.com/api/v1/sites/{site_id}/webhooks
```

**Response** `201 Created`

```json
{
  "id": "webhook-uuid",
  "url": "https://example.com/webhooks/openyapper",
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

## Delivery Log

View the history of webhook deliveries, including HTTP status codes and response times:

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  "https://your-domain.com/api/v1/webhooks/{id}/deliveries?page=1&per_page=20"
```
