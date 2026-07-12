# @forjacms/client

Typed TypeScript SDK for the Forja CMS content API. Works in Node.js, browsers, and edge runtimes.

## Install

```bash
npm install @forjacms/client
```

## Quick Start

```typescript
import { ForjaClient } from '@forjacms/client';

const forja = new ForjaClient({
  baseUrl: 'https://cms.example.com/api/v1',
  apiKey: 'dk_read_...',
  siteId: 'your-site-uuid',
});
```

## Usage

### Blogs

```typescript
// Published blogs (paginated)
const blogs = await forja.blogs.listPublished({ page: 1, pageSize: 10 });
console.log(blogs.data);    // BlogListItem[]
console.log(blogs.meta);    // { page, page_size, total_pages, total_items }

// By category
const techBlogs = await forja.blogs.listByCategory('tech', { page: 1 });

// Featured blogs
const featured = await forja.blogs.listFeatured({ limit: 5 });

// Similar posts
const similar = await forja.blogs.listSimilar('blog-uuid', { limit: 3 });

// Single blog (returns null if not found)
const blog = await forja.blogs.get('my-blog-slug');

// RSS feed
const rss = await forja.blogs.rss();
```

### Pages

```typescript
// Get page by route (returns null if not found)
const page = await forja.pages.getByRoute('/about');

// Page sections
const sections = await forja.pages.getSections('page-uuid');

// Section translations
const translations = await forja.pages.getSectionLocalizations('section-uuid');
```

### Navigation

```typescript
// All menus
const menus = await forja.navigation.listMenus();

// Single menu by slug
const primary = await forja.navigation.getMenuBySlug('primary');

// Navigation tree (with optional locale)
const tree = await forja.navigation.getTree('menu-uuid', { locale: 'de' });

// Menu items
const items = await forja.navigation.listItems('menu-uuid');
```

### Taxonomy

```typescript
// Tags (paginated, searchable)
const tags = await forja.taxonomy.listTags({ search: 'rust', sortBy: 'slug' });

// Categories
const categories = await forja.taxonomy.listCategories();

// Categories with blog counts
const withCounts = await forja.taxonomy.getCategoriesWithBlogCounts();

// Tags/categories for a specific content item
const contentTags = await forja.taxonomy.getContentTags('content-uuid');
```

### Analytics

```typescript
// Track a pageview
await forja.analytics.trackPageview({ path: '/blog/hello-world' });

// Analytics report
const report = await forja.analytics.getReport({ days: 30, topN: 10 });
console.log(report.total_views, report.total_unique_visitors);

// Page-specific analytics
const pageStats = await forja.analytics.getPageAnalytics({
  path: '/blog/hello-world',
  days: 7,
});
```

### CV / Resume

```typescript
// Skills
const skills = await forja.cv.listSkills({ page: 1 });
const skill = await forja.cv.getSkillBySlug('typescript');

// CV entries filtered by type
const workHistory = await forja.cv.listEntries({ entryType: 'Work' });
```

### Legal

```typescript
// Legal documents
const docs = await forja.legal.list();
const privacy = await forja.legal.getBySlug('privacy-policy');

// Cookie consent
const consent = await forja.legal.getCookieConsent();
```

### Projects

```typescript
// Published portfolio projects (paginated)
const projects = await forja.projects.listPublished({ page: 1 });

// Single project by id or slug (returns null if not found)
const project = await forja.projects.get('project-uuid');
const bySlug = await forja.projects.getBySlug('my-project');
```

### Redirects

```typescript
// Path-based lookup for SSR middleware (returns null if no redirect)
const redirect = await forja.redirects.lookup('/old-path');
```

### Site

```typescript
// Site metadata
const site = await forja.site.get();

// Configured locales (SiteLocaleResponse[], see below)
const locales = await forja.site.listLocales();

// Head/body code injection snippets
const injection = await forja.site.getCodeInjection();
```

### Media

```typescript
// Media library (paginated)
const media = await forja.media.list({ page: 1 });

// Single media item (returns null if not found)
const item = await forja.media.get('media-uuid');
```

### Social

```typescript
// Social media links (GitHub, LinkedIn, ...)
const links = await forja.social.list();
```

### Forms

```typescript
// Form definition + ALTCHA challenge
const form = await forja.forms.getForm('contact');
const challenge = await forja.forms.getAltchaChallenge('contact');

// Submit
await forja.forms.submitForm('contact', payload);

// GDPR self-service: look up / fetch / delete a submission by reference code
const lookup = await forja.forms.lookupSubmission('ref-code');
const submission = await forja.forms.getSubmission('ref-code');
await forja.forms.deleteSubmission('ref-code');
```

### Collections (Custom Types)

`collections(typeKey)` returns a resource scoped to a per-site custom type:

```typescript
const recipes = await forja.collections('recipe').published({ page: 1 });
const one = await forja.collections('recipe').bySlug('spaghetti');
const schema = await forja.collections('recipe').schema();
```

## Site Locales

`SiteLocaleResponse` is the canonical shape returned by every endpoint that
lists or resolves the locales configured for a site. Pinning this contract
here because consumers have drifted in the past (inventing a `text_direction`
field, expecting a top-level `id`, treating `url_prefix` as required).

**Example payload:**

```json
{
  "site_id": "550e8400-e29b-41d4-a716-446655440000",
  "locale_id": "660e8400-e29b-41d4-a716-446655440000",
  "is_default": true,
  "is_active": true,
  "url_prefix": null,
  "created_at": "2024-01-15T10:30:00Z",
  "code": "en",
  "name": "English",
  "native_name": "English",
  "direction": "ltr"
}
```

**Identity.** The natural key is the composite `(site_id, locale_id)`. There
is no top-level `id` — a locale can be attached to many sites, and a site
can carry many locales.

**Field reference:**

| Field         | Type                  | Notes                                                                                                   |
| ------------- | --------------------- | ------------------------------------------------------------------------------------------------------- |
| `site_id`     | UUID                  | Composite-key half #1.                                                                                  |
| `locale_id`   | UUID                  | Composite-key half #2.                                                                                  |
| `is_default`  | boolean               | Exactly one row per site has this `true`.                                                               |
| `is_active`   | boolean               | Configured-but-not-served when `false`. Consumers usually filter to `is_active = true`.                 |
| `url_prefix`  | string \| null        | Path segment selecting this locale. Nullable; the default locale conventionally has none.               |
| `created_at`  | ISO-8601 (UTC)        | When the assignment was created.                                                                        |
| `code`        | string                | BCP-47 (e.g. `"en"`, `"de-AT"`), denormalised from the `locales` row.                                   |
| `name`        | string                | English-language label (e.g. `"English"`), denormalised.                                                |
| `native_name` | string \| null        | Locale's own name (e.g. `"Deutsch"`), denormalised. Nullable for locales without a defined native form. |
| `direction`   | `"ltr"` \| `"rtl"`    | Text direction. **The field is `direction` — NOT `text_direction`.**                                    |

**Denormalisation rationale.** `code`, `name`, `native_name`, and `direction`
live on the `locales` table but are inlined into the response so a consumer
can render a locale switcher without a second round-trip. The trade-off is
deliberate: assignment-rate-of-change is much lower than read-rate.

**Anti-patterns to avoid in consumers:**

- ❌ Renaming `direction` → `text_direction` (the upstream name wins).
- ❌ Expecting a top-level `id` (use the `(site_id, locale_id)` composite).
- ❌ Treating `url_prefix` as required (it's nullable; the default locale typically has none).

## Pagination

All paginated responses include helpers for navigating pages:

```typescript
const page1 = await forja.blogs.listPublished({ pageSize: 10 });

// Fetch next page
const page2 = await page1.fetchNext(); // null if on last page

// Fetch all items across all pages
const allBlogs = await page1.fetchAll();

// Async iterator
for await (const page of page1) {
  console.log(page.data);
}
```

## Error Handling

The SDK throws typed errors for different failure scenarios:

All errors extend `ForjaError`, so a single `instanceof ForjaError` check catches
any SDK failure:

```typescript
import {
  ForjaError,
  ForjaAuthError,
  ForjaPermissionError,
  ForjaNotFoundError,
  ForjaRateLimitError,
  ForjaValidationError,
  ForjaServerError,
  ForjaNetworkError,
} from '@forjacms/client';

try {
  const blogs = await forja.blogs.listPublished();
} catch (error) {
  if (error instanceof ForjaAuthError) {
    // Invalid or missing API key (401)
  } else if (error instanceof ForjaRateLimitError) {
    // Rate limited (429) — check error.retryAfter
    console.log(`Retry after ${error.retryAfter} seconds`);
  } else if (error instanceof ForjaNetworkError) {
    // Network failure — server unreachable
  }
}
```

A 404 maps to `ForjaNotFoundError` — but methods that fetch a single resource by ID or slug catch it and return `null` instead of throwing.

## Custom Fetch

Pass a custom `fetch` implementation for edge runtimes or testing:

```typescript
const forja = new ForjaClient({
  baseUrl: 'https://cms.example.com/api/v1',
  apiKey: 'dk_read_...',
  siteId: 'your-site-uuid',
  fetch: customFetchFn,
});
```

## Framework Integration

### React

```typescript
import { ForjaClient } from '@forjacms/client';
import { useEffect, useState } from 'react';

const forja = new ForjaClient({ baseUrl: '...', apiKey: '...', siteId: '...' });

function BlogList() {
  const [blogs, setBlogs] = useState([]);

  useEffect(() => {
    forja.blogs.listPublished({ page: 1 }).then((res) => setBlogs(res.data));
  }, []);

  return blogs.map((b) => <article key={b.id}>{b.slug}</article>);
}
```

### Angular (v17+)

The `@forjacms/client/angular` subpath provides Angular DI integration and a signal-based resource helper. It requires the optional `@angular/core` peer dependency (`>=17`) — non-Angular consumers don't need it.

**Setup:**

```typescript
// app.config.ts
import { provideForja } from '@forjacms/client/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideForja({
      baseUrl: environment.cmsApiUrl,
      apiKey: environment.cmsApiKey,
      siteId: environment.cmsSiteId,
    }),
  ],
};
```

**Usage in components:**

```typescript
import { Component } from '@angular/core';
import { injectForja, forjaResource } from '@forjacms/client/angular';

@Component({
  template: `
    @if (blogs.isLoading()) {
      <p>Loading...</p>
    } @else if (blogs.error()) {
      <p>Error: {{ blogs.error()!.message }}</p>
    } @else {
      @for (blog of blogs.value()!.data; track blog.id) {
        <article>{{ blog.slug }}</article>
      }
    }
    <button (click)="blogs.reload()">Refresh</button>
  `,
})
export class BlogListComponent {
  private forja = injectForja();
  blogs = forjaResource(() => this.forja.blogs.listPublished({ page: 1 }));
}
```

The `forjaResource()` helper returns an object with:
- `value()` — Signal with the resolved data (or `undefined` while loading)
- `isLoading()` — Signal indicating loading state
- `error()` — Signal with the error (or `null` on success)
- `reload()` — Re-execute the loader

### Vanilla TypeScript

```typescript
import { ForjaClient } from '@forjacms/client';

const forja = new ForjaClient({ baseUrl: '...', apiKey: '...', siteId: '...' });

const blogs = await forja.blogs.listPublished();
document.getElementById('count')!.textContent = `${blogs.meta.total_items} posts`;
```

## License

AGPL-3.0-or-later
