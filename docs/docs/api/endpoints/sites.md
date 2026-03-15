---
sidebar_position: 1
---

# Sites

Sites are the top-level organizational unit in Forja. All content, media, navigation, and configuration are scoped to a site.

## Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites` | Read | List all sites (filtered by membership or API key scope) |
| POST | `/sites` | Admin (API key) / Any (Clerk) | Create a new site |
| GET | `/sites/{id}` | Read | Get a site by ID |
| GET | `/sites/by-slug/{slug}` | Read | Get a site by slug |
| PUT | `/sites/{id}` | Admin | Update a site |
| DELETE | `/sites/{id}` | Owner | Soft delete a site |
| GET | `/sites/{id}/context` | Read | Get site context (features, modules, suggestions) |
| GET | `/sites/{site_id}/settings` | Admin | Get site settings |
| PUT | `/sites/{site_id}/settings` | Admin | Update site settings |
| GET | `/sites/{site_id}/locales` | Read | List site locales |
| POST | `/sites/{site_id}/locales` | Admin | Add a locale to a site |
| PUT | `/sites/{site_id}/locales/{locale_id}` | Admin | Update a site locale |
| DELETE | `/sites/{site_id}/locales/{locale_id}` | Admin | Remove a locale from a site |
| PUT | `/sites/{site_id}/locales/{locale_id}/default` | Admin | Set the default locale |
| GET | `/sites/{site_id}/onboarding` | Read | Get onboarding progress |
| POST | `/sites/{site_id}/onboarding/{step}` | Author | Complete an onboarding step |
| GET | `/my/memberships` | Clerk JWT | Get current user's site memberships |

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

## Get Site Context

Returns contextual information about a site for adaptive UI, including enabled features, content modules, and UI suggestions. This drives progressive disclosure in the admin dashboard.

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/sites/{id}/context
```

**Response** `200 OK`

```json
{
  "member_count": 1,
  "current_user_role": "owner",
  "features": {
    "editorial_workflow": false,
    "scheduling": true,
    "versioning": true,
    "analytics": false
  },
  "suggestions": {
    "show_team_workflow_prompt": false
  },
  "modules": {
    "blog": true,
    "pages": true,
    "cv": false,
    "legal": false,
    "documents": false,
    "ai": false,
    "federation": false
  }
}
```

## Get Site Settings

Returns all effective settings for a site (database values merged with defaults). Requires Admin role.

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/sites/{site_id}/settings
```

**Response** `200 OK`

```json
{
  "max_document_file_size": 10485760,
  "max_media_file_size": 52428800,
  "analytics_enabled": false,
  "maintenance_mode": false,
  "contact_email": "",
  "editorial_workflow_enabled": false,
  "preview_templates": [],
  "module_blog_enabled": true,
  "module_pages_enabled": true,
  "module_cv_enabled": false,
  "module_legal_enabled": false,
  "module_documents_enabled": false,
  "module_ai_enabled": false,
  "module_federation_enabled": false
}
```

## Update Site Settings

Updates site settings. All fields are optional -- only provided fields are changed. Requires Admin role.

```bash
curl -X PUT \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "analytics_enabled": true,
    "editorial_workflow_enabled": true,
    "contact_email": "admin@example.com"
  }' \
  https://your-domain.com/api/v1/sites/{site_id}/settings
```

**Response** `200 OK` -- Returns the full updated `SiteSettingsResponse`.

## List Site Locales

Returns all locales assigned to a site, with full locale details (code, name, direction).

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/sites/{site_id}/locales
```

**Response** `200 OK`

```json
[
  {
    "site_id": "550e8400-e29b-41d4-a716-446655440000",
    "locale_id": "660e8400-e29b-41d4-a716-446655440000",
    "is_default": true,
    "is_active": true,
    "url_prefix": "en",
    "created_at": "2025-01-15T12:00:00Z",
    "code": "en",
    "name": "English",
    "native_name": "English",
    "direction": "ltr"
  }
]
```

## Add Locale to Site

Assigns a locale to a site. Requires Admin role.

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "locale_id": "660e8400-e29b-41d4-a716-446655440000",
    "is_default": false,
    "url_prefix": "de"
  }' \
  https://your-domain.com/api/v1/sites/{site_id}/locales
```

**Response** `201 Created`

## Update Site Locale

Updates properties of a site locale assignment. All fields are optional. Requires Admin role.

```bash
curl -X PUT \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "is_active": true,
    "url_prefix": "de"
  }' \
  https://your-domain.com/api/v1/sites/{site_id}/locales/{locale_id}
```

**Response** `200 OK`

## Remove Locale from Site

Removes a locale assignment from a site. Requires Admin role.

```bash
curl -X DELETE \
  -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/sites/{site_id}/locales/{locale_id}
```

**Response** `204 No Content`

## Set Default Locale

Sets a locale as the site's default. Requires Admin role.

```bash
curl -X PUT \
  -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/sites/{site_id}/locales/{locale_id}/default
```

**Response** `200 OK`

## Get Onboarding Progress

Returns the onboarding checklist progress for the current user on a site, including completed steps and overall percentage.

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/sites/{site_id}/onboarding
```

**Response** `200 OK`

```json
{
  "completed_steps": [
    {
      "step_key": "edit_first_post",
      "completed_at": "2025-01-15T10:30:00Z"
    }
  ],
  "total_steps": 5,
  "completed_count": 1,
  "progress_percent": 20
}
```

## Complete Onboarding Step

Marks an onboarding step as completed for the current user on a site. Idempotent -- completing an already-completed step is a no-op.

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"step_key": "edit_first_post"}' \
  https://your-domain.com/api/v1/sites/{site_id}/onboarding/{step}
```

**Response** `200 OK`

## Get My Memberships

Returns all site memberships for the currently authenticated Clerk user. Only available for Clerk JWT authentication (not API keys).

```bash
curl -H "Authorization: Bearer eyJ..." \
  https://your-domain.com/api/v1/my/memberships
```

**Response** `200 OK`

```json
[
  {
    "site_id": "550e8400-e29b-41d4-a716-446655440000",
    "site_name": "My Portfolio",
    "site_slug": "my-portfolio",
    "role": "owner"
  }
]
```
