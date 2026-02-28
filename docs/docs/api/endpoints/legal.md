---
sidebar_position: 6
---

# Legal Documents

Legal documents manage privacy policies, terms of service, cookie consent configurations, and other legal content. They follow a hierarchical structure: **Documents** contain **Groups**, which contain **Items**.

## Endpoints

### Documents

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/legal?page&per_page` | Read | List legal documents (paginated) |
| GET | `/legal/{id}` | Read | Get legal document by ID |
| GET | `/sites/{site_id}/legal/by-slug/{slug}` | Read | Get legal document by slug (with localizations) |
| GET | `/sites/{site_id}/legal/cookie-consent` | Read | Get cookie consent with full structure |
| POST | `/sites/{site_id}/legal` | Author | Create a legal document |
| PUT | `/legal/{id}` | Author | Update a legal document |
| DELETE | `/legal/{id}` | Author | Soft delete a legal document |

### Groups

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/legal/{document_id}/groups` | Read | Get groups for a legal document |
| POST | `/legal/{doc_id}/groups` | Read | Create a consent group |
| PUT | `/legal/groups/{id}` | Read | Update a consent group |
| DELETE | `/legal/groups/{id}` | Read | Delete a consent group |

### Items

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/legal/groups/{group_id}/items` | Read | Get items for a group |
| POST | `/legal/groups/{group_id}/items` | Read | Create a consent item |
| PUT | `/legal/items/{id}` | Read | Update a consent item |
| DELETE | `/legal/items/{id}` | Read | Delete a consent item |

## Cookie Consent Structure

The cookie consent endpoint returns the full nested structure needed to render a consent banner:

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/sites/{site_id}/legal/cookie-consent
```

**Response** `200 OK`

```json
{
  "id": "doc-uuid",
  "cookie_name": "cookie_consent",
  "document_type": "CookieConsent",
  "groups": [
    {
      "id": "group-uuid",
      "cookie_name": "necessary",
      "display_order": 0,
      "is_required": true,
      "default_enabled": true,
      "items": [
        {
          "id": "item-uuid",
          "name": "Session Cookie",
          "provider": "OpenYapper",
          "purpose": "User session management"
        }
      ]
    }
  ]
}
```

## Get Legal Document by Slug

Returns a legal document with its localizations, useful for rendering imprint or privacy policy pages:

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/sites/{site_id}/legal/by-slug/privacy-policy
```
