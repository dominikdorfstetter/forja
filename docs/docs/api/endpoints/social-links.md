---
sidebar_position: 10
---

# Social Links

Social links represent external profile links (GitHub, LinkedIn, Twitter, etc.) displayed on a site. They support custom ordering via drag-and-drop reordering.

## Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/social` | Read | List all social links for a site |
| GET | `/social/{id}` | Read | Get a social link by ID |
| POST | `/sites/{site_id}/social` | Author | Create a social link |
| PUT | `/social/{id}` | Author | Update a social link |
| DELETE | `/social/{id}` | Editor | Delete a social link |
| POST | `/sites/{site_id}/social/reorder` | Author | Batch-reorder social links |

## List Social Links

Returns social links ordered by `display_order`:

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/sites/{site_id}/social
```

**Response** `200 OK`

```json
[
  {
    "id": "link-uuid",
    "platform": "github",
    "url": "https://github.com/username",
    "label": "GitHub",
    "icon": "github",
    "display_order": 0,
    "is_active": true
  }
]
```

## Create a Social Link

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "linkedin",
    "url": "https://linkedin.com/in/username",
    "label": "LinkedIn",
    "icon": "linkedin"
  }' \
  https://your-domain.com/api/v1/sites/{site_id}/social
```

**Response** `201 Created`

## Reorder Social Links

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"id": "link-1", "display_order": 0},
      {"id": "link-2", "display_order": 1},
      {"id": "link-3", "display_order": 2}
    ]
  }' \
  https://your-domain.com/api/v1/sites/{site_id}/social/reorder
```

**Response** `204 No Content`
