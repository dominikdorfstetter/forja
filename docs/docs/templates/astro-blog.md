---
sidebar_position: 2
---

# Astro Blog Template

A server-rendered blog and portfolio site powered by [Astro 5](https://astro.build) and the Forja CMS backend. This template ships with Forja in the `templates/astro-blog/` directory.

## Tech Stack

- **Framework**: Astro 5 with SSR (`output: 'server'`)
- **Adapter**: `@astrojs/node` (standalone mode)
- **Markdown**: `marked` (GFM + line breaks)
- **Styling**: Minimal CSS with custom properties and dark mode

## Quick Start

### Option A: Helper Script (Recommended)

```bash
cd templates/astro-blog
npm install
cp .env.example .env
# Edit .env: set CMS_API_URL and CMS_API_KEY

./start-preview.sh <site-slug> [port]
# Example: ./start-preview.sh john-doe 4321
```

The `start-preview.sh` script resolves the site UUID from its slug automatically by querying the API.

### Option B: Manual Setup

```bash
cd templates/astro-blog
npm install
cp .env.example .env
# Edit .env: set CMS_API_URL, CMS_API_KEY, and CMS_SITE_ID
npm run dev
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `CMS_API_URL` | Backend API base URL | `http://localhost:8000/api/v1` |
| `CMS_API_KEY` | API key with Read permission | `dk_devread_000...` |
| `CMS_SITE_ID` | UUID of the site in the CMS | `5e3660ff-...` |

## Pages and Routes

| Route | Description |
|-------|-------------|
| `/` | Home page with hero section and featured posts |
| `/blog/` | Paginated blog listing |
| `/blog/{slug}` | Full blog post with markdown rendering and similar posts |
| `/blog/category/{slug}` | Blog posts filtered by category |
| `/cv` | Work/education timeline and skills |
| `/legal/{slug}` | Legal documents (imprint, privacy policy, etc.) |
| `/rss.xml` | RSS 2.0 feed (proxied from the backend) |
| `/rss` | Redirect to `/rss.xml` |
| `/{route}` | Dynamic CMS pages with sections |

## Project Structure

```
templates/astro-blog/
├── src/
│   ├── lib/
│   │   ├── api.ts           # API client and TypeScript types
│   │   ├── markdown.ts      # Markdown-to-HTML helper (marked)
│   │   ├── media-helpers.ts # Responsive image srcset builder
│   │   └── seo.ts           # SEO meta tag and JSON-LD builder
│   ├── layouts/
│   │   └── Base.astro       # HTML shell with navigation and footer
│   ├── components/
│   │   ├── BlogCard.astro   # Blog post card (grid/listing)
│   │   ├── Nav.astro        # Navigation bar with theme toggle
│   │   ├── Footer.astro     # 3-column site footer
│   │   ├── Pagination.astro # Page navigation
│   │   ├── ResponsiveImage.astro # AVIF/WebP responsive images
│   │   ├── SeoHead.astro    # OpenGraph and JSON-LD metadata
│   │   ├── SocialLinks.astro # Social media icon links
│   │   └── PageSection.astro # Generic page section renderer
│   ├── pages/
│   │   ├── index.astro      # Home page
│   │   ├── cv.astro         # CV page
│   │   ├── blog/
│   │   │   ├── index.astro  # Blog listing
│   │   │   └── [slug].astro # Blog detail
│   │   ├── legal/
│   │   │   └── [slug].astro # Legal documents
│   │   ├── rss.xml.ts       # RSS feed endpoint
│   │   ├── rss.ts           # RSS redirect
│   │   └── [...route].astro # CMS page catch-all
│   └── styles/
│       └── global.css       # CSS custom properties
├── start-preview.sh         # Helper to start dev server per site
├── astro.config.mjs
├── .env.example
└── package.json
```

## Connecting to the API

The API client in `src/lib/api.ts` provides typed functions for fetching content from Forja. It reads the environment variables and constructs requests with the `X-API-Key` header:

```typescript
const API_URL = import.meta.env.CMS_API_URL;
const API_KEY = import.meta.env.CMS_API_KEY;
const SITE_ID = import.meta.env.CMS_SITE_ID;

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'X-API-Key': API_KEY },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

## Customization

### Dark Mode

The template includes built-in dark mode support:

- **System preference detection** -- automatically respects `prefers-color-scheme: dark`
- **Manual toggle** -- moon/sun button in the navigation bar
- **Persistence** -- user choice saved to `localStorage` and applied on page load without flash
- **CSS custom properties** -- all colors are defined in `:root` and overridden under `[data-theme="dark"]`

### Similar Blogs ("Continue Reading")

Blog detail pages automatically show a "Continue Reading" section with up to 3 related posts. Related posts are ranked by the backend's similarity scoring based on shared tags, categories, and author. If no similar posts exist, the section is hidden.

### Styling

Edit CSS custom properties in `src/styles/global.css` to change colors, fonts, and spacing. Light and dark mode each have their own set of values:

```css
:root {
  --color-primary: #2563eb;
  --color-text: #1a1a2e;
  --color-bg: #ffffff;
  --color-surface: #f6f7f9;
  --max-width: 1100px;
}

[data-theme="dark"] {
  --color-primary: #60a5fa;
  --color-text: #e4e4e7;
  --color-bg: #111118;
  --color-surface: #1a1a24;
}
```

### Layout

The `Base.astro` layout provides the HTML shell, navigation, and footer. It includes the dark mode initialization script and theme toggle wiring. Modify this file to change the overall page structure.

### Components

All components live in `src/components/`. They use semantic HTML and minimal styling, making them easy to extend or replace.

## Admin Preview Integration

This template integrates with the Forja admin dashboard's preview feature. In the admin Settings page, add a preview template URL pointing to your dev server (e.g., `http://localhost:4321`). Then use the preview buttons in the blog and page editors to open content directly in the template.

## Building for Production

Since the template uses SSR (server-side rendering), the build output is a Node.js server:

```bash
npm run build
```

Run the production server:

```bash
node dist/server/entry.mjs
```

### Deployment Options

The built Node.js server can be deployed to:

- **Any Node.js host** -- Railway, Render, Fly.io, DigitalOcean App Platform
- **Docker** -- create a simple Dockerfile that copies the build output and runs `node dist/server/entry.mjs`
- **Self-hosted** -- run directly with Node.js behind nginx or Caddy

Set the `CMS_API_URL`, `CMS_API_KEY`, and `CMS_SITE_ID` environment variables on your hosting platform.
