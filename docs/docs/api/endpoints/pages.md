---
sidebar_position: 3
---

# Pages

Pages represent structured, route-based content. Each page has a unique route within a site and can contain multiple sections, each with their own localizations.

## Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/pages?page&per_page` | Read | List all pages (paginated) |
| GET | `/pages/{id}` | Read | Get page by ID |
| GET | `/sites/{site_id}/pages/by-route/{route}` | Read | Get page by route |
| POST | `/pages` | Author | Create a page |
| PUT | `/pages/{id}` | Author | Update a page |
| DELETE | `/pages/{id}` | Editor | Soft delete a page |
| POST | `/pages/{id}/clone` | Author | Clone a page as a new Draft |
| POST | `/pages/{id}/review` | Reviewer | Approve or request changes |
| GET | `/pages/{page_id}/sections` | Read | Get sections for a page |
| POST | `/pages/{page_id}/sections` | Author | Create a page section |
| PUT | `/pages/sections/{id}` | Author | Update a page section |
| DELETE | `/pages/sections/{id}` | Editor | Delete a page section |
| GET | `/pages/sections/{section_id}/localizations` | Read | Get localizations for a section |
| GET | `/pages/{page_id}/sections/localizations` | Read | Get all section localizations for a page |
| PUT | `/pages/sections/{section_id}/localizations` | Author | Upsert a section localization |
| DELETE | `/pages/sections/localizations/{id}` | Editor | Delete a section localization |
| POST | `/sites/{site_id}/pages/bulk` | Author/Editor | Bulk status update or delete |

## List Pages

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  "https://your-domain.com/api/v1/sites/{site_id}/pages?page=1&per_page=10"
```

## Get Page by Route

Routes are stored with a leading slash. The route path is passed as a URL segment:

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/sites/{site_id}/pages/by-route/about
```

## Create a Page

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "site_ids": ["550e8400-..."],
    "route": "/about",
    "slug": "about",
    "status": "Draft"
  }' \
  https://your-domain.com/api/v1/pages
```

**Response** `201 Created`

## Page Sections

Sections are ordered building blocks within a page. Each section has a `section_type` (e.g., "hero", "text", "gallery") and a `display_order`.

```bash
# Create a section
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "section_type": "hero",
    "display_order": 0
  }' \
  https://your-domain.com/api/v1/pages/{page_id}/sections
```

## Section Localizations

Each section can have localized content. The upsert endpoint creates a new localization or updates an existing one for the given locale.

```bash
curl -X PUT \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "locale_id": "locale-uuid",
    "title": "Welcome",
    "text": "Hello, world!"
  }' \
  https://your-domain.com/api/v1/pages/sections/{section_id}/localizations
```

## Editorial Workflow

Pages follow the same editorial workflow as blogs. See the [Blogs](./blogs.md) documentation for details on the review process.

## Bulk Actions

Identical to blog bulk actions. Supports `UpdateStatus` and `Delete` actions.
