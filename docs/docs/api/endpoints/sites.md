---
sidebar_position: 1
---

# Sites

Sites are the top-level organizational unit in OpenYapper. All content, media, navigation, and configuration are scoped to a site.

## Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites` | Read | List all sites (filtered by membership or API key scope) |
| POST | `/sites` | Admin (API key) / Any (Clerk) | Create a new site |
| GET | `/sites/{id}` | Read | Get a site by ID |
| GET | `/sites/by-slug/{slug}` | Read | Get a site by slug |
| PUT | `/sites/{id}` | Admin | Update a site |
| DELETE | `/sites/{id}` | Owner | Soft delete a site |

## List Sites

Returns sites visible to the authenticated user. Clerk users see sites they have memberships for (system admins see all). API key users see sites matching their key scope.

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/sites
```

**Response** `200 OK`

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Portfolio",
    "slug": "my-portfolio",
    "description": "Personal developer portfolio",
    "is_active": true,
    "created_at": "2025-01-15T12:00:00Z",
    "updated_at": "2025-01-15T12:00:00Z"
  }
]
```

## Create a Site

Clerk-authenticated users automatically become the site owner. API keys require Admin+ permission and must not be site-scoped.

You can optionally include `locales` in the creation request to set up site locales in a single call.

```bash
curl -X POST \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Blog",
    "slug": "my-blog",
    "description": "A personal blog"
  }' \
  https://your-domain.com/api/v1/sites
```

**Response** `201 Created`

## Get a Site by Slug

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/sites/by-slug/my-blog
```

## Update a Site

Requires Admin role on the site.

```bash
curl -X PUT \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}' \
  https://your-domain.com/api/v1/sites/{id}
```

## Delete a Site

Soft deletes the site. Requires Owner role.

```bash
curl -X DELETE \
  -H "Authorization: Bearer eyJ..." \
  https://your-domain.com/api/v1/sites/{id}
```

**Response** `204 No Content`
