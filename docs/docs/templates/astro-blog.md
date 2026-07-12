---
sidebar_position: 2
---

# Astro Blog Template

A server-rendered blog and portfolio site powered by [Astro 7](https://astro.build) and the Forja CMS backend. This template ships with Forja in the `templates/astro-blog/` directory.

## Tech Stack

- **Framework**: Astro 7 with SSR (`output: 'server'`)
- **Adapter**: `@astrojs/node` (standalone mode)
- **Markdown**: `marked` (GFM + line breaks)
- **Styling**: Tailwind CSS v4 with dark mode via `data-theme` attribute
- **Sections**: `@forjacms/sections` Web Components (Stencil) for CMS page sections
- **CMS Client**: `@forjacms/client` SDK for typed API access

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

## Architecture

The template uses a **hybrid rendering** approach:

- **Nav and Footer** are server-rendered Astro components (for instant visibility, no JS required)
- **Page sections** (Hero, Features, CTA, Blog, etc.) are `@forjacms/sections` Web Components that hydrate client-side
- Both use the **same BEM CSS classes**, styled in `sections.css` with Tailwind utilities

This means the page shell appears immediately in the HTML, while section content renders once the Stencil loader runs. The CSS in `sections.css` uses `@reference "./global.css"` to inherit the custom `dark:` variant tied to the `data-theme` attribute.

### How sections work

`PageSection.astro` receives CMS section data and renders the appropriate `<forja-*>` custom element:

```astro
{sectionType === 'Hero' && <forja-hero section-title={title} text={text} image-url={coverUrl} />}
{sectionType === 'Blog' && <forja-blog section-title={title} posts={JSON.stringify(posts)} />}
{sectionType === 'Legal' && <forja-legal section-title={title} body={text} document-type="PrivacyPolicy" />}
```

All 21 section types are supported: Hero, Features, CTA, Gallery, Testimonials, Pricing, FAQ, Contact, Stats, Team, Timeline, LogoCloud, Newsletter, Video, Divider, Text, Portfolio, TagCloud, Projects, Blog, Legal.

## Project Structure

```
templates/astro-blog/
├── src/
│   ├── lib/
│   │   ├── api.ts           # @forjacms/client wrapper with caching
│   │   ├── locale.ts        # Locale helpers (formatDate, hasLocale)
│   │   ├── markdown.ts      # Markdown-to-HTML helper (marked)
│   │   ├── media-helpers.ts # Responsive image srcset builder
│   │   └── seo.ts           # SEO meta tag and JSON-LD builder
│   ├── layouts/
│   │   └── Base.astro       # HTML shell, loads @forjacms/sections/define
│   ├── components/
│   │   ├── BlogCard.astro   # Blog post card (grid/listing)
│   │   ├── Nav.astro        # SSR nav with BEM classes (forja-nav__)
│   │   ├── Footer.astro     # SSR footer with social icons (forja-footer__)
│   │   ├── PageSection.astro # Routes section types to <forja-*> web components
│   │   ├── Pagination.astro # Page navigation (path or query param modes)
│   │   ├── ResponsiveImage.astro # AVIF/WebP responsive images
│   │   └── SeoHead.astro    # OpenGraph and JSON-LD metadata
│   ├── pages/
│   │   ├── index.astro      # Home page with sections
│   │   ├── cv.astro         # CV page
│   │   ├── blog/
│   │   │   ├── index.astro  # Blog listing (locale-filtered)
│   │   │   ├── [slug].astro # Blog detail with similar posts
│   │   │   ├── page/[page].astro # Blog pagination
│   │   │   └── category/[slug].astro # Category filter with pagination
│   │   ├── legal/
│   │   │   └── [slug].astro # Legal docs via <forja-legal>
│   │   ├── rss.xml.ts       # RSS feed endpoint
│   │   ├── rss.ts           # RSS redirect
│   │   └── [...route].astro # CMS page catch-all
│   └── styles/
│       ├── global.css       # Tailwind v4 theme + prose styles
│       └── sections.css     # BEM styles for all @forjacms/sections components
├── start-preview.sh         # Helper to start dev server per site
├── Dockerfile               # Multi-stage build (builds @forjacms/sections)
├── astro.config.mjs
├── .env.example
└── package.json
```

## Connecting to the API

The template uses the `@forjacms/client` SDK for all API calls. The client is initialized once in `src/lib/api.ts` and provides typed wrapper functions with in-process caching:

```typescript
import { ForjaClient } from '@forjacms/client';

const client = () => new ForjaClient({
  baseUrl: import.meta.env.CMS_API_URL,
  apiKey: import.meta.env.CMS_API_KEY,
  siteId: import.meta.env.CMS_SITE_ID,
});

// Typed, paginated, locale-filtered
const blogs = await client().blogs.listPublished({ page: 1, localeId: locale.locale_id });
```

Blog and category listings support server-side locale filtering via the `localeId` parameter, ensuring pagination metadata is accurate for the active language.

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

The template uses **Tailwind CSS v4** with a custom dark mode variant tied to the `data-theme` attribute. Edit theme tokens in `src/styles/global.css`:

```css
@import "tailwindcss";

@theme {
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

Section web components are styled via BEM class rules in `src/styles/sections.css`. Each section type has its own set of rules targeting the BEM classes emitted by `@forjacms/sections`:

```css
@reference "tailwindcss";
@reference "./global.css";

.forja-hero { @apply relative py-20 px-6; }
.forja-hero__title { @apply text-4xl font-bold text-zinc-900 dark:text-white mb-6; }
```

### Layout

The `Base.astro` layout provides the HTML shell with:
- SSR-rendered `Nav.astro` and `Footer.astro` (using `forja-nav__` and `forja-footer__` BEM classes)
- Dark mode initialization script (runs before first paint, no flash)
- `@forjacms/sections/define` import that registers all web components
- Theme toggle, language switcher, and mobile menu event wiring

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

- **Any Node.js host** -- Railway, Render, DigitalOcean App Platform
- **Docker** -- create a simple Dockerfile that copies the build output and runs `node dist/server/entry.mjs`
- **Self-hosted** -- run directly with Node.js behind nginx or Caddy

Set the `CMS_API_URL`, `CMS_API_KEY`, and `CMS_SITE_ID` environment variables on your hosting platform.
