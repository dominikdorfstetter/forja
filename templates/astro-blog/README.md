# Forja Astro Blog Template

A server-rendered blog and portfolio site powered by [Astro](https://astro.build) and the Forja CMS backend.

> Full documentation: **[forja-docs.dorfstetter.at](https://forja-docs.dorfstetter.at)**

## Tech Stack

- **Framework**: Astro 5 with SSR (`output: 'server'`)
- **Adapter**: @astrojs/node (standalone mode)
- **Markdown**: marked (GFM + line breaks)
- **Analytics**: @forja/analytics (privacy-first pageview tracking)
- **Styling**: Minimal CSS with custom properties

## Quick Start

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
| `/rss.xml` | RSS 2.0 feed |
| `/{route}` | Dynamic CMS pages with sections |

## Admin Integration

This template works with the Forja admin's **Preview** feature. In the admin Settings page, add a preview template pointing to your dev server URL (e.g., `http://localhost:4321`), then use preview buttons in the blog and page editors.

## Building for Production

```bash
npm run build
node dist/server/entry.mjs
```

Since the template uses SSR, the build output is a Node.js server.

See the [Templates guide](https://forja-docs.dorfstetter.at/templates/overview) for customization details.
