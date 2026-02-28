---
sidebar_position: 4
---

# Pagination

All list endpoints that return potentially large collections support offset-based pagination via query parameters.

## Query Parameters

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | integer | 1 | -- | The page number to retrieve (1-indexed). |
| `per_page` | integer | 10 | 100 | The number of items per page. |

## Response Format

Paginated responses wrap the data array with a `meta` object containing pagination metadata:

```json
{
  "data": [
    { "id": "...", "name": "..." },
    { "id": "...", "name": "..." }
  ],
  "meta": {
    "page": 1,
    "per_page": 10,
    "total": 42,
    "total_pages": 5
  }
}
```

### PaginationMeta Fields

| Field | Type | Description |
|-------|------|-------------|
| `page` | integer | The current page number. |
| `per_page` | integer | The number of items per page. |
| `total` | integer | The total number of items across all pages. |
| `total_pages` | integer | The total number of pages. |

## Example

Fetch the second page of blogs with 5 items per page:

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  "https://your-domain.com/api/v1/sites/{site_id}/blogs?page=2&per_page=5"
```

Response:

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "slug": "getting-started-with-rust",
      "author": "John Doe",
      "status": "Published",
      "created_at": "2025-01-15T12:00:00Z"
    }
  ],
  "meta": {
    "page": 2,
    "per_page": 5,
    "total": 12,
    "total_pages": 3
  }
}
```

## Notes

- Requesting a page beyond `total_pages` returns an empty `data` array.
- Some endpoints use different default `per_page` values (e.g., notifications default to 20, skills default to 25). Check the endpoint documentation for specifics.
- A few endpoints (e.g., featured blogs, API key usage) use `limit`/`offset` directly instead of `page`/`per_page`.
