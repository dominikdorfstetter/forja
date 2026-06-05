---
sidebar_position: 16
---

# Audit Logs

The audit system tracks all mutations across the CMS, providing an immutable log of who changed what and when. It also stores field-level change history that enables reverting individual changes.

## Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/audit?page&per_page` | Any | List audit logs for a site (paginated) |
| GET | `/audit/entity/{entity_type}/{entity_id}` | Any | Get audit logs for a specific entity |
| GET | `/audit/history/{entity_type}/{entity_id}` | Any | Get field-level change history for an entity |
| POST | `/audit/history/revert` | Admin | Revert specific change history entries |

## List Audit Logs

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  "https://your-domain.com/api/v1/sites/{site_id}/audit?page=1&per_page=20"
```

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "log-uuid",
      "site_id": "site-uuid",
      "user_id": "user-uuid",
      "action": "Update",
      "entity_type": "blog",
      "entity_id": "blog-uuid",
      "metadata": null,
      "created_at": "2025-01-15T12:00:00Z"
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total": 150, "total_pages": 8 }
}
```

## Entity Audit Trail

Get all audit log entries for a specific entity:

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/audit/entity/blog/{blog_id}
```

## Change History

Get field-level change history showing exactly which fields changed and their old/new values:

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/audit/history/blog/{blog_id}
```

**Response** `200 OK`

```json
[
  {
    "id": "change-uuid",
    "site_id": "site-uuid",
    "entity_type": "blog",
    "entity_id": "blog-uuid",
    "field_name": "slug",
    "old_value": "old-slug",
    "new_value": "new-slug",
    "changed_by": "user-uuid",
    "changed_at": "2025-01-15T12:00:00Z"
  }
]
```

## Revert Changes

Restore specific fields to their previous values. Requires Admin permission. All change IDs must belong to the same entity.

Supported entity types: `blog`, `page`, `site`, `legal_document`, `social_link`.

System fields (`id`, `content_id`, `site_id`, `created_at`, `updated_at`, `created_by`, `is_deleted`, `published_at`) cannot be reverted.

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "change_ids": ["change-uuid-1", "change-uuid-2"]
  }' \
  https://your-domain.com/api/v1/audit/history/revert
```

**Response** `200 OK`

```json
{
  "entity_type": "blog",
  "entity_id": "blog-uuid",
  "fields_reverted": ["slug", "author"]
}
```
