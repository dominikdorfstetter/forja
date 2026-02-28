---
sidebar_position: 17
---

# Notifications

In-app notifications for content workflow events (e.g., content submitted for review, approved, changes requested). Notifications are per-user and per-site, requiring Clerk JWT authentication.

## Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/notifications?page&per_page` | Clerk JWT | List notifications (paginated, newest first) |
| GET | `/sites/{site_id}/notifications/unread-count` | Clerk JWT | Get unread notification count |
| PUT | `/notifications/{id}/read` | Clerk JWT | Mark a notification as read |
| PUT | `/sites/{site_id}/notifications/read-all` | Clerk JWT | Mark all notifications as read |

:::info
Notification endpoints require Clerk JWT authentication. API key authentication will return `403 Forbidden`.
:::

## List Notifications

Default page size is 20 items. Returns notifications ordered by newest first.

```bash
curl -H "Authorization: Bearer eyJ..." \
  "https://your-domain.com/api/v1/sites/{site_id}/notifications?page=1&per_page=20"
```

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "notif-uuid",
      "site_id": "site-uuid",
      "recipient_clerk_id": "user_abc123",
      "notification_type": "content_submitted",
      "title": "Blog post submitted for review",
      "message": "\"Getting Started with Rust\" was submitted for review",
      "entity_type": "blog",
      "entity_id": "blog-uuid",
      "is_read": false,
      "created_at": "2025-01-15T12:00:00Z"
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total": 5, "total_pages": 1 }
}
```

## Unread Count

Useful for displaying a badge in the admin UI:

```bash
curl -H "Authorization: Bearer eyJ..." \
  https://your-domain.com/api/v1/sites/{site_id}/notifications/unread-count
```

**Response** `200 OK`

```json
{
  "unread_count": 3
}
```

## Mark as Read

Ownership check: you can only mark your own notifications as read.

```bash
curl -X PUT \
  -H "Authorization: Bearer eyJ..." \
  https://your-domain.com/api/v1/notifications/{id}/read
```

## Mark All as Read

Marks all unread notifications for the current user in a site as read. Returns the number of updated notifications.

```bash
curl -X PUT \
  -H "Authorization: Bearer eyJ..." \
  https://your-domain.com/api/v1/sites/{site_id}/notifications/read-all
```

**Response** `200 OK`

```json
{
  "updated": 3
}
```
