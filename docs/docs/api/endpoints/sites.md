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
| DELETE | `/sites/{id}` | Owner | Soft delete a site (30-day grace window) |
| GET | `/sites/deleted` | Read | List soft-deleted sites still within the restore window |
| POST | `/sites/{id}/restore` | Owner | Restore a soft-deleted site within the grace window |
| POST | `/sites/{id}/reset-content` | Owner | Move all site content + owned media to Trash |
| POST | `/sites/{id}/export` | Admin / Owner | Enqueue an asynchronous site-archive export |
| GET | `/sites/{id}/export/{job_id}` | Admin / Owner | Get export job status |
| GET | `/sites/{id}/export/{job_id}/download` | Token + Admin/Owner | Stream the built export ZIP |
| GET | `/sites/{slug}/sitemap.xml` | Public | XML sitemap of all published content |
| GET | `/sites/{slug}/robots.txt` | Public | Rendered robots.txt from site rules |
| GET | `/sites/{slug}/site.webmanifest` | Public | Web app manifest (JSON) |
| GET | `/sites/{slug}/browserconfig.xml` | Public | Browserconfig for IE/Edge tiles |
| POST | `/sites/{site_id}/favicon` | Admin | Upload source image and generate favicon package |
| GET | `/sites/{site_id}/favicon` | Read | Get favicon variant URLs and HTML snippet |
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
    "base_url": "https://portfolio.example.com",
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
    "description": "A personal blog",
    "base_url": "https://blog.example.com"
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
  -d '{"name": "Updated Name", "base_url": "https://new-domain.example.com"}' \
  https://your-domain.com/api/v1/sites/{id}
```

All fields are optional. The `base_url` field must be a valid URL with protocol (e.g. `https://example.com`). It is used for sitemap generation, canonical/OG meta tags, and preview links. When `null`, SEO features that require a canonical URL are gracefully omitted.

## Delete a Site

Soft deletes the site. Requires Owner role. The site is **not** removed immediately: it is stamped with a `deleted_at` timestamp and enters a **30-day restore grace window**. During the window the site can be listed via `GET /sites/deleted` and brought back with `POST /sites/{id}/restore`. After 30 days a background worker hard-deletes the site (the database FK cascade reclaims every site-scoped row) and writes a system-level purge audit entry; that step is irreversible.

```bash
curl -X DELETE \
  -H "Authorization: Bearer eyJ..." \
  https://your-domain.com/api/v1/sites/{id}
```

**Response** `204 No Content`

## List Deleted Sites

Returns soft-deleted sites still within the 30-day restore grace window. The result is filtered by the caller's site access (system administrators see all). Each entry includes a `deleted_at` timestamp — used to compute the remaining-days countdown — that is omitted from sites returned by every other endpoint.

```bash
curl -H "Authorization: Bearer eyJ..." \
  https://your-domain.com/api/v1/sites/deleted
```

**Response** `200 OK` — array of `SiteResponse`, each carrying `deleted_at`.

## Restore a Site

Restores a soft-deleted site within the grace window. Requires Owner role (system administrators can restore any site). Content, media, settings, members, and locales return as they were at deletion.

```bash
curl -X POST \
  -H "Authorization: Bearer eyJ..." \
  https://your-domain.com/api/v1/sites/{id}/restore
```

**Response** `200 OK` — the restored `SiteResponse`.

Returns `404` if no soft-deleted site with that id exists, and `410 SITE_RESTORE_EXPIRED` if the 30-day window has already lapsed (the site is then queued for purge and cannot be restored).

## Reset Site Content

Bulk soft-deletes **all site-scoped content and site-owned media** into the normal 30-day Trash: content (blogs, pages, CV/project), legal documents, documents, social links, navigation menus and items, and owned media files. The site shell — the site row, its settings, members, and locales — is kept. Requires Owner role. The trashed rows are recoverable from Trash like any other soft-deleted content.

```bash
curl -X POST \
  -H "Authorization: Bearer eyJ..." \
  https://your-domain.com/api/v1/sites/{id}/reset-content
```

**Response** `200 OK`

```json
{
  "contents": 42,
  "legal_documents": 3,
  "documents": 7,
  "social_links": 5,
  "navigation_menus": 2,
  "navigation_items": 11,
  "media_files": 28,
  "total": 98
}
```

## Export a Site

Enqueues an **asynchronous** site-archive export. Returns immediately with a job; a background worker builds a ZIP — an `archive.json` snapshot (site, settings, locales, blogs, pages, taxonomy, navigation, and their localizations) plus the site's owned media bytes under `media/` — and then exposes an expiring signed download. Available to the site **Owner** or a site **Admin** (`403 SITE_EXPORT_FORBIDDEN` otherwise).

Only one export may be queued or running per site; requesting another while one is active returns `409 SITE_EXPORT_ALREADY_RUNNING`.

```bash
curl -X POST \
  -H "Authorization: Bearer eyJ..." \
  https://your-domain.com/api/v1/sites/{id}/export
```

**Response** `202 Accepted`

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "created_at": "2026-05-18T08:00:00Z",
  "download_url": null,
  "expires_at": null,
  "error": null
}
```

## Get Export Job Status

Poll the job until `status` is `ready` (or `failed`). While `ready` and not yet expired, `download_url` is a signed link and `expires_at` is when both the link and the stored artifact lapse (7 days after the export is built).

```bash
curl -H "Authorization: Bearer eyJ..." \
  https://your-domain.com/api/v1/sites/{id}/export/{job_id}
```

**Response** `200 OK`

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440000",
  "status": "ready",
  "created_at": "2026-05-18T08:00:00Z",
  "download_url": "https://your-domain.com/api/v1/sites/{id}/export/{job_id}/download?token=...",
  "expires_at": "2026-05-25T08:00:30Z",
  "error": null
}
```

`status` is one of `queued`, `running`, `ready`, `failed`. When `failed`, `error` carries the failure detail. Returns `404 SITE_EXPORT_JOB_NOT_FOUND` if the job does not exist for this site or its artifact has expired and been purged.

## Download Export

Streams the built ZIP. Authorized by **both** the caller's role (Owner/Admin) **and** the per-job `token` from `download_url` — the token is required even for authorized callers.

```bash
curl -L -o site-export.zip \
  -H "Authorization: Bearer eyJ..." \
  "https://your-domain.com/api/v1/sites/{id}/export/{job_id}/download?token=..."
```

**Response** `200 OK` (`Content-Type: application/zip`). Returns `404` once the artifact has expired (7 days) and been purged.

## Get Sitemap

Returns an XML sitemap of all published content for a site. This is a **public endpoint** (no authentication required) intended for search engine consumption.

The site must have a `base_url` configured. If not set, the endpoint returns `404` with the message "Set a Site URL before generating a sitemap."

```bash
curl https://your-domain.com/api/v1/sites/my-blog/sitemap.xml
```

**Response** `200 OK` (`Content-Type: application/xml`, `Cache-Control: public, max-age=3600`)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://example.com/about</loc>
    <lastmod>2025-03-01T12:00:00+00:00</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/about"/>
    <xhtml:link rel="alternate" hreflang="de" href="https://example.com/de/about"/>
  </url>
  <url>
    <loc>https://example.com/blog/hello-world</loc>
    <lastmod>2025-06-15T10:30:00+00:00</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>
```

**Included content:**
- **Pages** (priority 0.8, changefreq monthly)
- **Blog posts** (priority 0.6, changefreq weekly)
- **Legal documents** (priority 0.4, changefreq yearly)

Only published content is included -- drafts, archived, and deleted content are excluded. Multi-locale alternate links are added when the site has multiple active locales and the content has translations.

## Get robots.txt

Returns the rendered robots.txt for a site. Rules are configured via site settings. This is a **public endpoint** (no authentication required).

When a `base_url` is configured, a `Sitemap:` directive is automatically appended.

```bash
curl https://your-domain.com/api/v1/sites/my-blog/robots.txt
```

**Response** `200 OK` (`Content-Type: text/plain`, `Cache-Control: public, max-age=3600`)

```
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
```

Rules are stored as structured JSON in site settings (`robots_txt_rules`) and rendered to standard robots.txt format at response time.

## Get Web Manifest

Returns a `site.webmanifest` JSON document for PWA / Android Chrome. This is a **public endpoint**.

```bash
curl https://your-domain.com/api/v1/sites/my-blog/site.webmanifest
```

**Response** `200 OK` (`Content-Type: application/manifest+json`, `Cache-Control: public, max-age=3600`)

```json
{
  "name": "My Blog",
  "short_name": "My Blog",
  "icons": [
    { "src": "https://cdn.example.com/site_favicons/.../android-chrome-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "https://cdn.example.com/site_favicons/.../android-chrome-512x512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#4a90d9",
  "background_color": "#ffffff",
  "display": "standalone"
}
```

The `theme_color` and `background_color` values come from site settings. Icons are populated after uploading a favicon source image.

## Get Browserconfig

Returns a `browserconfig.xml` for IE/Edge tile configuration. This is a **public endpoint**.

```bash
curl https://your-domain.com/api/v1/sites/my-blog/browserconfig.xml
```

**Response** `200 OK` (`Content-Type: application/xml`, `Cache-Control: public, max-age=3600`)

## Upload Favicon

Upload a source image (512x512px+ recommended) to generate a complete favicon package. Requires **Admin** role. Accepts PNG, JPEG, GIF, or WebP (max 10 MB).

Generated variants:
- `favicon.ico` (multi-resolution: 16x16, 32x32, 48x48)
- `favicon-16x16.png`, `favicon-32x32.png`
- `apple-touch-icon.png` (180x180)
- `android-chrome-192x192.png`, `android-chrome-512x512.png`

Icons are stored under `site_favicons/<site_id>/` and do **not** appear in the media library. The site's `favicon_url` is automatically updated to point to the 32x32 PNG for backwards compatibility.

```bash
curl -X POST \
  -H "Authorization: Bearer eyJ..." \
  -F "file=@icon-512.png" \
  https://your-domain.com/api/v1/sites/{site_id}/favicon
```

**Response** `200 OK`

```json
{
  "variants": [
    { "name": "favicon.ico", "url": "https://...", "width": 48, "height": 48 },
    { "name": "favicon-16x16.png", "url": "https://...", "width": 16, "height": 16 },
    { "name": "favicon-32x32.png", "url": "https://...", "width": 32, "height": 32 },
    { "name": "apple-touch-icon.png", "url": "https://...", "width": 180, "height": 180 },
    { "name": "android-chrome-192x192.png", "url": "https://...", "width": 192, "height": 192 },
    { "name": "android-chrome-512x512.png", "url": "https://...", "width": 512, "height": 512 }
  ],
  "head_snippet": "<link rel=\"icon\" type=\"image/x-icon\" href=\"...\">..."
}
```

## Get Favicon

Returns the current favicon variant URLs and an HTML `<head>` snippet. Returns `404` if no favicon package has been generated yet.

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/sites/{site_id}/favicon
```

**Response** `200 OK` — Same shape as the upload response.

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
    "portfolio": false,
    "legal": false,
    "documents": false,
    "ai": false
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
  "module_portfolio_enabled": false,
  "module_legal_enabled": false,
  "module_documents_enabled": false,
  "module_ai_enabled": false,
  "robots_txt_rules": [{"user_agent": "*", "rules": [{"directive": "Allow", "path": "/"}]}],
  "seo_title_template": "{{title}} | {{site_name}}",
  "seo_default_description": "",
  "seo_default_og_image_id": null,
  "theme_color": "#ffffff",
  "background_color": "#ffffff",
  "code_injection_head": "",
  "code_injection_footer": ""
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
