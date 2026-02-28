---
sidebar_position: 2
---

# Blogs

Blog posts are the primary content type in OpenYapper. They support localization, categories, editorial workflow, document attachments, and RSS feeds.

## Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/blogs?page&per_page` | Read | List all blogs (paginated) |
| GET | `/sites/{site_id}/blogs/published?page&per_page` | Read | List published blogs |
| GET | `/sites/{site_id}/blogs/featured?limit` | Read | List featured blogs |
| GET | `/sites/{site_id}/blogs/by-slug/{slug}` | Read | Get blog by slug |
| GET | `/blogs/{id}` | Read | Get blog by ID |
| GET | `/blogs/{id}/detail` | Read | Get blog with localizations, categories, and documents |
| POST | `/blogs` | Author | Create a blog post |
| PUT | `/blogs/{id}` | Author | Update a blog post |
| DELETE | `/blogs/{id}` | Editor | Soft delete a blog post |
| POST | `/blogs/{id}/clone` | Author | Clone a blog as a new Draft |
| POST | `/blogs/{id}/review` | Reviewer | Approve or request changes |
| GET | `/blogs/{id}/localizations` | Read | Get all localizations |
| POST | `/blogs/{id}/localizations` | Author | Create a localization |
| PUT | `/blogs/localizations/{loc_id}` | Author | Update a localization |
| DELETE | `/blogs/localizations/{loc_id}` | Editor | Delete a localization |
| GET | `/sites/{site_id}/feed.rss` | Read | RSS 2.0 feed of published posts |
| POST | `/sites/{site_id}/blogs/bulk` | Author/Editor | Bulk status update or delete |

## List Blogs

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  "https://your-domain.com/api/v1/sites/{site_id}/blogs?page=1&per_page=10"
```

**Response** `200 OK` -- Paginated list with `data` and `meta` fields.

## Get Blog Detail

Returns the blog post with all localizations, assigned categories, and attached documents in a single response.

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/blogs/{id}/detail
```

## Create a Blog

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "site_ids": ["550e8400-..."],
    "slug": "my-first-post",
    "author": "John Doe",
    "status": "Draft"
  }' \
  https://your-domain.com/api/v1/blogs
```

**Response** `201 Created`

## Editorial Workflow

Content follows the lifecycle: **Draft** -> **InReview** -> **Published** (or **Scheduled**). Submitting content for review notifies reviewers. Reviewers can approve (moves to Published/Scheduled) or request changes (moves back to Draft).

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"action": "Approve"}' \
  https://your-domain.com/api/v1/blogs/{id}/review
```

## RSS Feed

Returns an RSS 2.0 XML feed of the last 50 published blog posts. The response has `Content-Type: application/rss+xml` and is cached for 1 hour.

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/sites/{site_id}/feed.rss
```

## Bulk Actions

Perform bulk status updates or deletes on multiple blogs at once. Delete requires Editor role; status update requires Author role.

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "action": "UpdateStatus",
    "ids": ["id1", "id2"],
    "status": "Published"
  }' \
  https://your-domain.com/api/v1/sites/{site_id}/blogs/bulk
```
