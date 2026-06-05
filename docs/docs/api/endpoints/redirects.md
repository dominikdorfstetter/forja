---
sidebar_position: 12
---

# Redirects

Manage URL redirects (301 permanent, 302 temporary) for a site. Useful for preserving SEO when restructuring content or migrating URLs.

## Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/redirects?page&per_page` | Read | List redirects (paginated) |
| GET | `/redirects/{id}` | Read | Get a redirect by ID |
| POST | `/sites/{site_id}/redirects` | Author | Create a redirect |
| PUT | `/redirects/{id}` | Author | Update a redirect |
| DELETE | `/redirects/{id}` | Editor | Delete a redirect |
| GET | `/sites/{site_id}/redirects/lookup?path` | Read | Lookup an active redirect by source path |

## List Redirects

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  "https://your-domain.com/api/v1/sites/{site_id}/redirects?page=1&per_page=25"
```

## Create a Redirect

Source and destination paths must be different. Creating a redirect with a duplicate source path returns `409 Conflict`.

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "source_path": "/old-blog-post",
    "destination_path": "/blog/new-blog-post",
    "status_code": 301,
    "is_active": true
  }' \
  https://your-domain.com/api/v1/sites/{site_id}/redirects
```

**Response** `201 Created`

```json
{
  "id": "redirect-uuid",
  "site_id": "site-uuid",
  "source_path": "/old-blog-post",
  "destination_path": "/blog/new-blog-post",
  "status_code": 301,
  "is_active": true,
  "created_at": "2025-01-15T12:00:00Z"
}
```

## Lookup a Redirect

Used by the frontend to check if a path should be redirected. Returns the destination path and status code if an active redirect exists, or `404` if none is found.

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  "https://your-domain.com/api/v1/sites/{site_id}/redirects/lookup?path=/old-blog-post"
```

**Response** `200 OK`

```json
{
  "destination_path": "/blog/new-blog-post",
  "status_code": 301
}
```
