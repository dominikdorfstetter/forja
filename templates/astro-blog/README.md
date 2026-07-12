# Forja Astro Blog Template

A server-rendered blog and portfolio site powered by [Astro](https://astro.build) and the Forja CMS backend.

> Full documentation: **[forja-docs.dorfstetter.at](https://forja-docs.dorfstetter.at)**

## Tech Stack

- **Framework**: Astro 7 with SSR (`output: 'server'`)
- **Adapter**: @astrojs/node 11 (standalone mode)
- **Markdown**: marked (GFM + line breaks), output sanitized with sanitize-html
- **Analytics**: @forjacms/analytics (privacy-first pageview tracking)
- **Styling**: Tailwind CSS 4 via `@tailwindcss/vite`, with `@theme` tokens in `src/styles/global.css`
- **Node**: >= 22.12 (see `engines` in package.json)

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
| `SITE_URL` | Public URL for canonical links, OpenGraph, and sitemap | `http://localhost:4321` |
| `PREVIEW_TOKEN_SECRET` | Shared secret for validating draft preview tokens (must match the backend's `APP__SECURITY__PREVIEW_TOKEN_SECRET`; read at runtime via `process.env`) | `...` |
| `CMS_SITE_DOMAIN` | Site domain sent as `X-Site-Domain` — required for public Forms endpoints | `example.com` |
| `CMS_PAGE_COLLECTIONS` | Comma-separated collection keys to publish as pages | `recipes,events` |

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

## Testing

```bash
npm test
```

Runs the unit tests in `src/lib/__tests__/` with the built-in Node test runner (`node --test` with TypeScript type stripping) — no extra test framework needed.

## Building for Production

```bash
npm run build
node dist/server/entry.mjs
```

Since the template uses SSR, the build output is a Node.js server.

## Deployment

The included `Dockerfile` is a `node:24-slim` multi-stage build. Note that it **rebuilds the three `file:` libs** (`@forjacms/analytics`, `@forjacms/client`, `@forjacms/sections`) inside the image — their `dist/` output is gitignored, so if you customize a lib you must rebuild the image (a local `npm run build` in the lib is not enough for Docker deploys).

See the [Templates guide](https://forja-docs.dorfstetter.at/templates/overview) for customization details.
