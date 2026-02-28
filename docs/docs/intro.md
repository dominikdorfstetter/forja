---
sidebar_position: 1
slug: /
---

# Introduction to OpenYapper

OpenYapper is an open-source, multi-site content management system built with a **Rust backend** (Rocket 0.5), a **React admin dashboard** (Vite + MUI), and pluggable **frontend templates** (Astro, Next.js, etc.). It is designed for developers who want a fast, type-safe CMS they can self-host, extend, and integrate into their own stack.

## Why OpenYapper?

Most headless CMS platforms are either too heavy, too opinionated, or too expensive for developers who just need a solid API behind their portfolio or blog. OpenYapper fills that gap:

- **Built in Rust** -- the backend compiles to a single binary, starts in milliseconds, and handles thousands of requests per second with minimal resource usage.
- **Multi-tenant by design** -- run multiple sites from a single instance, each with its own content, navigation, and settings.
- **Developer-first** -- every resource is available through a RESTful JSON API with full OpenAPI (Swagger) documentation.

## Key Features

| Area | What you get |
|------|-------------|
| **Multi-site** | Create and manage multiple independent sites from one installation |
| **Content types** | Blog posts, static pages, CV entries, legal pages, documents |
| **Media library** | Upload, crop, and serve images with local or S3 storage |
| **Navigation** | Hierarchical navigation menus with drag-and-drop ordering |
| **Taxonomy** | Categories and tags with full i18n support |
| **Internationalization** | Localized content fields, navigation titles, and admin UI |
| **Authentication** | Dual auth -- API keys (`X-API-Key`) and Clerk JWTs (`Authorization: Bearer`) |
| **RBAC** | Four permission levels: Master > Admin > Write > Read |
| **Webhooks** | Event-driven webhook delivery with retry and delivery logs |
| **Redirects** | 301/302 URL redirect management per site |
| **Audit logging** | Track who changed what, and when |
| **Content scheduling** | Publish and unpublish content on a schedule |
| **RSS feeds** | Auto-generated RSS 2.0 feeds for blog content |
| **Notifications** | In-app notification system for admin users |
| **Templates** | Pluggable frontend templates (ships with an Astro blog template) |

## Architecture at a Glance

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────┐
│  Frontend   │────▶│  Rust Backend    │────▶│  PostgreSQL   │
│  (Astro,    │     │  (Rocket 0.5)    │     │               │
│   Next.js)  │     │  /api/v1/*       │     └───────────────┘
└─────────────┘     │  /api-docs       │     ┌───────────────┐
                    │                  │────▶│  Redis        │
┌─────────────┐     │                  │     │  (rate limit) │
│  Admin UI   │────▶│                  │     └───────────────┘
│  (React +   │     └──────────────────┘     ┌───────────────┐
│   MUI)      │                              │  S3 / Local   │
└─────────────┘                              │  (media)      │
                                             └───────────────┘
```

- **Backend** -- Rust with Rocket 0.5, SQLx, PostgreSQL. Serves the JSON API at `/api/v1` and Swagger UI at `/api-docs`.
- **Admin** -- React SPA built with Vite, Material UI, React Query, react-hook-form, and zod. Served at `/dashboard` in production, `localhost:5173` in development.
- **Frontend templates** -- Statically generated sites that consume the API. An Astro blog template ships out of the box at `templates/astro-blog/`.

## Screenshots

**Admin Dashboard** -- System health, content stats, and setup checklist:

![Admin dashboard](/img/screenshots/admin-dashboard.png)

**Swagger UI** -- Interactive API documentation with all endpoints:

![Swagger UI](/img/screenshots/swagger-ui.png)

**Admin Login** -- Clerk-powered authentication with social login support:

![Admin login](/img/screenshots/login.png)

## Quick Links

- **[Prerequisites](./getting-started/prerequisites)** -- what you need installed before you begin.
- **[Installation](./getting-started/installation)** -- clone, configure, and install dependencies.
- **[First Run](./getting-started/first-run)** -- start the dev environment and verify everything works.
- **[Configuration](./getting-started/configuration)** -- full reference of all environment variables.
- **[API Reference](./api/overview)** -- explore every endpoint with request/response examples.
- **[Admin Guide](./admin-guide/overview)** -- learn how to manage content through the dashboard.
- **[Architecture](./architecture/overview)** -- deep dive into the system design.

## License

OpenYapper is released under the [**AGPL-3.0-or-later**](https://www.gnu.org/licenses/agpl-3.0.html) license. You are free to use, modify, and distribute it, provided that any modified versions you deploy as a network service also make their source code available under the same license.
