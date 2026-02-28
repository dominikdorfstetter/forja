---
sidebar_position: 2
---

# Astro Blog Template

A server-rendered blog and portfolio site powered by [Astro 5](https://astro.build) and the OpenYapper CMS backend. This template ships with OpenYapper in the `templates/astro-blog/` directory.

## Tech Stack

- **Framework**: Astro 5 with SSR (`output: 'server'`)
- **Adapter**: `@astrojs/node` (standalone mode)
- **Markdown**: `marked` (GFM + line breaks)
- **Styling**: Minimal CSS with custom properties

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
| `/blog/{slug}` | Full blog post with markdown rendering |
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
│   │   └── markdown.ts      # Markdown-to-HTML helper (marked)
│   ├── layouts/
│   │   └── Base.astro       # HTML shell with navigation and footer
│   ├── components/
│   │   ├── Nav.astro        # Navigation bar
│   │   ├── Footer.astro     # Site footer
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

The API client in `src/lib/api.ts` provides typed functions for fetching content from OpenYapper. It reads the environment variables and constructs requests with the `X-API-Key` header:

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

### Styling

Edit CSS custom properties in `src/styles/global.css` to change colors, fonts, and spacing:

```css
:root {
  --color-primary: #2563eb;
  --color-text: #1e293b;
  --color-bg: #ffffff;
  --font-body: 'Inter', system-ui, sans-serif;
  --max-width: 800px;
}
```

### Layout

The `Base.astro` layout provides the HTML shell, navigation, and footer. Modify this file to change the overall page structure.

### Components

All components live in `src/components/`. They use semantic HTML and minimal styling, making them easy to extend or replace.

## Admin Preview Integration

This template integrates with the OpenYapper admin dashboard's preview feature. In the admin Settings page, add a preview template URL pointing to your dev server (e.g., `http://localhost:4321`). Then use the preview buttons in the blog and page editors to open content directly in the template.

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
