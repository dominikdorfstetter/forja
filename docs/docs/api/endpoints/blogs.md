---
sidebar_position: 2
---

# Blogs

Blog posts are the primary content type in Forja. They support localization, categories, editorial workflow, document attachments, and RSS feeds.

## Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/blogs?page&per_page` | `blog:read` | List all blogs (paginated) |
| GET | `/sites/{site_id}/blogs/published?page&per_page` | `blog:read` | List published blogs |
| GET | `/sites/{site_id}/blogs/featured?limit` | `blog:read` | List featured blogs |
| GET | `/sites/{site_id}/blogs/{id}/similar?limit` | `blog:read` | List similar blogs by taxonomy overlap |
| GET | `/sites/{site_id}/blogs/by-slug/{slug}` | `blog:read` | Get blog by slug |
| GET | `/blogs/{id}` | `blog:read` | Get blog by ID |
| GET | `/blogs/{id}/detail` | `blog:read` | Get blog with localizations, categories, and documents |
| POST | `/blogs` | `blog:create` | Create a blog post |
| PUT | `/blogs/{id}` | `blog:update:own` / `blog:update:any` | Update a blog post (ownership enforced) |
| DELETE | `/blogs/{id}` | `blog:delete:own` / `blog:delete:any` | Soft delete a blog post (ownership enforced) |
| POST | `/blogs/{id}/clone` | `blog:create` | Clone a blog as a new Draft |
| POST | `/blogs/{id}/review` | `blog:review` | Approve or request changes |
| GET | `/blogs/{id}/localizations` | `blog:read` | Get all localizations |
| POST | `/blogs/{id}/localizations` | `blog:create` | Create a localization |
| PUT | `/blogs/localizations/{loc_id}` | `blog:update` | Update a localization |
| DELETE | `/blogs/localizations/{loc_id}` | `blog:delete` | Delete a localization |
| GET | `/sites/{site_id}/feed.rss` | `blog:read` | RSS 2.0 feed of published posts |
| POST | `/sites/{site_id}/blogs/bulk` | `blog:update` / `blog:delete` | Bulk status update or delete |
| POST | `/sites/{site_id}/blogs/seed` | `blog:create` | Seed sample blog content |
| DELETE | `/sites/{site_id}/blogs/samples` | `blog:delete` | Delete sample blog content |

**Ownership enforcement:** Update and delete operations check resource ownership. Authors (with `blog:update:own`) can only modify their own content. Editors+ (with `blog:update:any`) can modify any content. Published content requires `blog:update:published` (Editor+).

**Slug auto-generation:** The `slug` field in `POST /blogs` is now optional. If omitted, a slug is auto-generated from the `title` field using Unicode transliteration with uniqueness enforcement (appends `-2`, `-3` on collision).

## List Blogs

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  "https://your-domain.com/api/v1/sites/{site_id}/blogs?page=1&per_page=10"
```

**Response** `200 OK` -- Paginated list with `data` and `meta` fields.

### List Published Blogs

The published blogs endpoint (`/sites/{site_id}/blogs/published`) supports an optional `locale_id` query parameter:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `per_page` | integer | No | Items per page (default: 10) |
| `locale_id` | UUID | No | Filter to blogs that have content in the specified locale. When provided, only blogs with a localization matching this locale are returned, and pagination counts (`total`, `total_pages`) reflect the filtered set. |

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  "https://your-domain.com/api/v1/sites/{site_id}/blogs/published?page=1&per_page=10&locale_id=550e8400-..."
```

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

## Similar Blogs

Returns blogs similar to the given blog post, ranked by taxonomy overlap. Scoring: shared tags (+3 each), shared categories (+2 each), primary category match (+3 bonus), same author (+1). Only published blogs with a score > 0 are returned. If nothing is similar, the response is an empty array.

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  "https://your-domain.com/api/v1/sites/{site_id}/blogs/{id}/similar?limit=3"
```

**Query Parameters**

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `limit` | 3 | 10 | Number of similar blogs to return |

**Response** `200 OK` -- Array of `BlogListItem` objects sorted by relevance score (descending), then by `published_date` (most recent first).

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

## Seed Sample Content

Creates 3 sample draft blog posts for a new site, marked as samples. Useful for onboarding so new sites are not empty. Returns `400` if sample content already exists.

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/sites/{site_id}/blogs/seed
```

**Response** `201 Created` -- Returns an array of the created `BlogResponse` objects.

## Delete Sample Content

Deletes all blog posts marked as sample content for a site. Requires Editor role.

```bash
curl -X DELETE \
  -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/sites/{site_id}/blogs/samples
```

**Response** `200 OK`

```json
{
  "deleted": 3
}
```
