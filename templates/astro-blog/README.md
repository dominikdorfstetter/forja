# OpenYapper Astro Blog Template

A server-rendered blog and portfolio site powered by [Astro](https://astro.build) and the OpenYapper CMS backend.

Note: the template now uses SSR (server rendering with @astrojs/node), NOT static site generation.

## Tech Stack

- **Framework**: Astro 5 with SSR (`output: 'server'`)
- **Adapter**: @astrojs/node (standalone mode)
- **Markdown**: marked (GFM + line breaks)
- **Styling**: Minimal CSS with custom properties

## Quick Start

Two options:

### Option A: Helper script (recommended)

```bash
npm install
cp .env.example .env
# Edit .env: set CMS_API_URL and CMS_API_KEY

./start-preview.sh <site-slug> [port]
# Example: ./start-preview.sh john-doe 4321
```

The script resolves the site UUID from its slug automatically.

### Option B: Manual

```bash
npm install
cp .env.example .env
# Edit .env: set all three variables
npm run dev
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `CMS_API_URL` | Backend API base URL | `http://localhost:8000/api/v1` |
| `CMS_API_KEY` | API key with Read permission | `dk_devread_000...` |
| `CMS_SITE_ID` | UUID of the site in CMS | `5e3660ff-...` |

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home page with hero section and featured posts |
| `/blog/` | Paginated blog listing |
| `/blog/{slug}` | Full blog post with markdown rendering |
| `/cv` | Work/education timeline + skills |
| `/legal/{slug}` | Legal documents (imprint, privacy, etc.) |
| `/rss.xml` | RSS 2.0 feed (proxied from backend) |
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
│   │   └── Base.astro       # HTML shell with nav and footer
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

## Admin Integration

This template is designed to work with the OpenYapper admin's **Preview** feature. In the admin Settings page, add a preview template pointing to your local dev server URL (e.g., `http://localhost:4321`). Then use the preview buttons in the blog and page editors to open content in this template.

## Customization

Edit CSS custom properties in `src/styles/global.css` to change colors, fonts, and spacing. The template uses semantic HTML and minimal styling -- it's meant to be a starting point.

## Building for Production

```bash
npm run build
```

Since the template uses SSR, the build output is a Node.js server. Run it with:

```bash
node dist/server/entry.mjs
```
