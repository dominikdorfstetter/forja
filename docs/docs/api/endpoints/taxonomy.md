---
sidebar_position: 9
---

# Taxonomy

Taxonomy endpoints manage **tags** and **categories** for organizing content. Categories support hierarchical nesting (parent/child). Both can be assigned to content items.

## Endpoints

### Tags

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/tags?page&per_page` | Read | List tags for a site (paginated) |
| GET | `/tags/{id}` | Read | Get tag by ID |
| GET | `/tags/by-slug/{slug}` | Read | Get tag by slug |
| GET | `/content/{content_id}/tags` | Read | Get tags assigned to content |
| POST | `/tags` | Author | Create a tag |
| PUT | `/tags/{id}` | Author | Update a tag |
| DELETE | `/tags/{id}` | Author | Soft delete a tag |

### Categories

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/categories?page&per_page` | Read | List root categories (paginated) |
| GET | `/sites/{site_id}/categories/blog-counts` | Read | Get categories with blog post counts |
| GET | `/categories/{id}` | Read | Get category by ID |
| GET | `/categories/{parent_id}/children` | Read | Get child categories |
| GET | `/content/{content_id}/categories` | Read | Get categories assigned to content |
| POST | `/categories` | Author | Create a category |
| PUT | `/categories/{id}` | Author | Update a category |
| DELETE | `/categories/{id}` | Author | Soft delete a category |
| POST | `/content/{content_id}/categories` | Read | Assign a category to content |
| DELETE | `/content/{content_id}/categories/{category_id}` | Read | Remove a category from content |

## List Tags

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  "https://your-domain.com/api/v1/sites/{site_id}/tags?page=1&per_page=25"
```

## Categories with Blog Counts

Returns categories with the number of published blog posts in each, useful for sidebar widgets:

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/sites/{site_id}/categories/blog-counts
```

**Response** `200 OK`

```json
[
  {
    "id": "cat-uuid",
    "name": "Rust",
    "slug": "rust",
    "blog_count": 5
  }
]
```

## Assign a Category to Content

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "category_id": "cat-uuid",
    "is_primary": true
  }' \
  https://your-domain.com/api/v1/content/{content_id}/categories
```

**Response** `204 No Content`
