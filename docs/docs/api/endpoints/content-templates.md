---
sidebar_position: 13
---

# Content Templates

Content templates are reusable content structures that can be used as starting points when creating new blog posts or pages. They store predefined content, metadata, and configuration as JSON.

## Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/content-templates?page&per_page&search` | Read | List templates (paginated, searchable) |
| GET | `/content-templates/{id}` | Read | Get a template by ID |
| POST | `/sites/{site_id}/content-templates` | Author | Create a template |
| PUT | `/content-templates/{id}` | Author | Update a template |
| DELETE | `/content-templates/{id}` | Editor | Delete a template |

## List Templates

Supports search by name or description:

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  "https://your-domain.com/api/v1/sites/{site_id}/content-templates?search=blog&page=1&per_page=10"
```

## Create a Template

Template names must be unique within a site. Duplicates return `409 Conflict`.

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Standard Blog Post",
    "description": "Template for a standard blog post with intro and body",
    "content_type": "blog",
    "template_data": {
      "sections": ["intro", "body", "conclusion"],
      "default_status": "Draft"
    }
  }' \
  https://your-domain.com/api/v1/sites/{site_id}/content-templates
```

**Response** `201 Created`

```json
{
  "id": "template-uuid",
  "site_id": "site-uuid",
  "name": "Standard Blog Post",
  "description": "Template for a standard blog post with intro and body",
  "content_type": "blog",
  "template_data": { "..." },
  "created_at": "2025-01-15T12:00:00Z",
  "updated_at": "2025-01-15T12:00:00Z"
}
```
