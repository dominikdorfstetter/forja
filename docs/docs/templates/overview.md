---
sidebar_position: 1
---

# Frontend Templates

OpenYapper provides pluggable frontend templates -- standalone website projects that connect to the OpenYapper API to display your content. Templates are designed to be cloned, customized, and deployed independently from the backend.

## What Are Templates?

A template is a complete frontend project (HTML, CSS, JavaScript) that:

- Fetches content from the OpenYapper API using a Read-level API key.
- Renders blog posts, pages, navigation, CV entries, legal documents, and other content types.
- Can be deployed to any static hosting service, Node.js host, or edge platform.

Templates are intentionally separate from the backend. You can run multiple templates against the same OpenYapper instance, each displaying a different site.

## Pluggable Architecture

Templates connect to OpenYapper through three environment variables:

| Variable | Description |
|----------|-------------|
| `CMS_API_URL` | Base URL of the OpenYapper API (e.g., `https://cms.yourdomain.com/api/v1`) |
| `CMS_API_KEY` | An API key with at least Read permission |
| `CMS_SITE_ID` | The UUID of the site whose content should be displayed |

This means any frontend framework can be used as a template -- Astro, Next.js, Nuxt, SvelteKit, Remix, plain HTML, or anything else that can make HTTP requests.

## Available Templates

| Template | Framework | Rendering | Description |
|----------|-----------|-----------|-------------|
| [Astro Blog](./astro-blog) | Astro 5 | SSR (Node.js) | Blog and portfolio template with pages, CV, legal docs, and RSS |

## Using a Template

1. **Copy the template** from `templates/` to your own project directory (or fork it).
2. **Install dependencies**: `npm install`
3. **Configure environment variables**: Copy `.env.example` to `.env` and set `CMS_API_URL`, `CMS_API_KEY`, and `CMS_SITE_ID`.
4. **Start the dev server**: `npm run dev`
5. **Customize**: Edit styles, layouts, and components to match your design.
6. **Deploy**: Build and deploy to your hosting provider of choice.

## Creating Your Own Template

You can create a custom template in any framework. The template needs to:

1. **Fetch content** from the OpenYapper API endpoints (`/api/v1/sites/{site_id}/blogs`, `/api/v1/sites/{site_id}/pages`, etc.).
2. **Authenticate requests** by sending the API key in the `X-API-Key` header.
3. **Render content** using the returned JSON data.

### API Endpoints Commonly Used by Templates

| Endpoint | Purpose |
|----------|---------|
| `GET /sites/{site_id}/blogs` | List blog posts (paginated) |
| `GET /sites/{site_id}/blogs/{slug}` | Get a single blog post by slug |
| `GET /sites/{site_id}/pages` | List pages |
| `GET /sites/{site_id}/pages/{slug}` | Get a single page by slug |
| `GET /sites/{site_id}/cv` | Get CV entries and skills |
| `GET /sites/{site_id}/legal` | List legal documents |
| `GET /sites/{site_id}/legal/{slug}` | Get a single legal document |
| `GET /sites/{site_id}/navigation/menus/{menu_id}/tree` | Get navigation tree |
| `GET /sites/{site_id}/social-links` | Get social media links |
| `GET /sites/{site_id}/settings` | Get site settings (title, description, etc.) |
| `GET /rss/{site_id}` | RSS 2.0 feed for blog posts |

Refer to the [API Reference](../api/overview) for full endpoint documentation and the Swagger UI at `/api-docs` on your OpenYapper instance.

## Admin Preview Integration

Templates can integrate with the admin dashboard's preview feature. In the admin site settings, configure a preview URL pointing to your template's dev server (e.g., `http://localhost:4321`). The admin's "Preview" button in the blog and page editors then opens content directly in the template.
