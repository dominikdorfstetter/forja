---
sidebar_position: 1
---

# Content SDK

`@forjacms/client` is the official TypeScript SDK for consuming the Forja CMS content API. It provides typed methods for all public endpoints, pagination helpers, and structured error handling.

## Features

- **Typed responses** — every API response has a TypeScript interface
- **Resource-based API** — organized by domain: blogs, pages, navigation, taxonomy, analytics, CV, legal, media, social
- **Pagination helpers** — `fetchNext()`, `fetchAll()`, and async iteration
- **Error mapping** — HTTP errors mapped to typed error classes
- **Runtime-agnostic** — works in Node.js, browsers, Deno, and edge runtimes (uses `fetch`)
- **Custom fetch** — inject your own `fetch` for testing or platform compatibility

## Installation

```bash
npm install @forjacms/client
```

## Quick Start

```typescript
import { ForjaClient } from '@forjacms/client';

const forja = new ForjaClient({
  baseUrl: 'https://your-forja-instance.com/api/v1',
  apiKey: 'your-read-api-key',
  siteId: 'your-site-uuid',
});

// Fetch published blogs
const blogs = await forja.blogs.listPublished({ page: 1, pageSize: 10 });

// Fetch site info
const site = await forja.site.get();

// Fetch navigation tree
const nav = await forja.navigation.getTree('menu-id', { locale: 'en' });
```

## Configuration

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `baseUrl` | `string` | Yes | Full URL to the Forja API (e.g. `https://cms.example.com/api/v1`) |
| `apiKey` | `string` | Yes | API key with at least `Read` permission |
| `siteId` | `string` | Yes | UUID of the site to query |
| `fetch` | `typeof fetch` | No | Custom fetch implementation (defaults to `globalThis.fetch`) |

:::tip API Key Permissions
All consumer SDK methods require a **Read** API key at minimum. Create one in the admin dashboard under **Settings > API Keys**.
:::

## Available Resources

The `ForjaClient` instance exposes the following resource namespaces:

| Resource | Accessor | Description |
|----------|----------|-------------|
| Blogs | `forja.blogs` | Published blog posts, featured lists, category filtering, RSS |
| Pages | `forja.pages` | CMS pages by route, sections, localizations |
| Navigation | `forja.navigation` | Menus, navigation trees, menu items |
| Taxonomy | `forja.taxonomy` | Tags, categories, content associations |
| Analytics | `forja.analytics` | Pageview tracking, reports, per-page stats |
| CV | `forja.cv` | Skills, CV entries (work, education, etc.) |
| Legal | `forja.legal` | Legal documents, cookie consent, consent groups |
| Site | `forja.site` | Site configuration and metadata |
| Media | `forja.media` | Media assets and variants |
| Social | `forja.social` | Social media links |
| Projects | `forja.projects` | Portfolio projects with localizations, links, media, skill associations |
| Redirects | `forja.redirects` | URL redirect lookup for SSR middleware |

The `forja.site` resource also provides `forja.site.listLocales()` for fetching available locales.

See the full [Resource Reference](./resources) for method signatures and examples.

## TypeScript Support

All response types are exported from the package and can be imported directly:

```typescript
import type {
  BlogListItem,
  BlogDetailResponse,
  PageDetailResponse,
  NavigationTree,
  SiteResponse,
  MediaResponse,
  PaginationMeta,
} from '@forjacms/client';
```

## Custom Fetch

Pass a custom `fetch` implementation for environments that do not provide a global `fetch`, or for injecting test doubles:

```typescript
import { ForjaClient } from '@forjacms/client';
import nodeFetch from 'node-fetch';

const forja = new ForjaClient({
  baseUrl: 'https://cms.example.com/api/v1',
  apiKey: 'dk_read_...',
  siteId: 'your-site-uuid',
  fetch: nodeFetch as unknown as typeof fetch,
});
```

:::info Runtime Compatibility
In modern Node.js (18+), Deno, Bun, and all browsers, `globalThis.fetch` is available natively. The `fetch` option is only needed for older Node.js versions or for injecting mocks in tests.
:::
