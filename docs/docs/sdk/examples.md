---
sidebar_position: 5
---

# Integration Examples

Real-world examples of using `@forjacms/client` with popular frameworks and runtimes.

## Astro SSR

### Client Setup

Create a shared client instance in a utility module:

```typescript
// src/lib/cms.ts
import { ForjaClient } from '@forjacms/client';

export const cms = new ForjaClient({
  baseUrl: import.meta.env.CMS_API_URL,
  apiKey: import.meta.env.CMS_API_KEY,
  siteId: import.meta.env.CMS_SITE_ID,
});
```

### Blog Detail Page

```astro
---
// src/pages/blog/[slug].astro
import { cms } from '../../lib/cms';
import Layout from '../../layouts/Layout.astro';

const { slug } = Astro.params;
const blog = await cms.blogs.getBySlug(slug!);

if (!blog) return Astro.redirect('/404');

const coverMedia = blog.cover_image_id
  ? await cms.media.get(blog.cover_image_id)
  : null;

const localization = blog.localizations[0];
const tags = await cms.taxonomy.getContentTags(blog.content_id);
const similar = await cms.blogs.listSimilar(blog.id, { limit: 3 });
---

<Layout title={localization?.meta_title ?? localization?.title ?? ''}>
  <article>
    {coverMedia && (
      <img
        src={coverMedia.public_url}
        alt={localization?.title ?? ''}
        width={coverMedia.width ?? undefined}
        height={coverMedia.height ?? undefined}
      />
    )}

    <h1>{localization?.title}</h1>

    {localization?.subtitle && <p class="subtitle">{localization.subtitle}</p>}

    <div class="meta">
      <span>By {blog.author}</span>
      <time datetime={blog.published_date}>
        {new Date(blog.published_date).toLocaleDateString()}
      </time>
      {blog.reading_time_minutes && (
        <span>{blog.reading_time_minutes} min read</span>
      )}
    </div>

    <div class="tags">
      {tags.map((tag) => (
        <span class="tag">{tag.slug}</span>
      ))}
    </div>

    <div class="content" set:html={localization?.body} />

    {similar.length > 0 && (
      <aside>
        <h2>Related Posts</h2>
        <ul>
          {similar.map((post) => (
            <li><a href={`/blog/${post.slug}`}>{post.slug}</a></li>
          ))}
        </ul>
      </aside>
    )}
  </article>
</Layout>
```

### Blog Index with Pagination

```astro
---
// src/pages/blog/[...page].astro
import { cms } from '../../lib/cms';
import Layout from '../../layouts/Layout.astro';

const currentPage = Number(Astro.params.page) || 1;
const blogs = await cms.blogs.listPublished({ page: currentPage, pageSize: 12 });
---

<Layout title="Blog">
  <h1>Blog</h1>

  <div class="grid">
    {blogs.data.map((blog) => (
      <a href={`/blog/${blog.slug}`} class="card">
        <h2>{blog.slug}</h2>
        <time datetime={blog.published_date}>
          {new Date(blog.published_date).toLocaleDateString()}
        </time>
      </a>
    ))}
  </div>

  <nav class="pagination">
    {currentPage > 1 && (
      <a href={`/blog/${currentPage - 1}`}>Previous</a>
    )}
    <span>Page {blogs.meta.page} of {blogs.meta.total_pages}</span>
    {currentPage < blogs.meta.total_pages && (
      <a href={`/blog/${currentPage + 1}`}>Next</a>
    )}
  </nav>
</Layout>
```

### Navigation Component

```astro
---
// src/components/MainNav.astro
import { cms } from '../lib/cms';
import type { NavigationTree } from '@forjacms/client';

const menu = await cms.navigation.getMenuBySlug('primary');
const tree = menu
  ? await cms.navigation.getTree(menu.id, { locale: 'en' })
  : [];

function getUrl(node: NavigationTree): string {
  return node.external_url ?? `/${node.page_slug ?? ''}`;
}
---

<nav>
  <ul>
    {tree.map((node) => (
      <li>
        <a
          href={getUrl(node)}
          target={node.open_in_new_tab ? '_blank' : undefined}
          rel={node.open_in_new_tab ? 'noopener noreferrer' : undefined}
        >
          {node.title}
        </a>
        {node.children.length > 0 && (
          <ul>
            {node.children.map((child) => (
              <li>
                <a href={getUrl(child)}>{child.title}</a>
              </li>
            ))}
          </ul>
        )}
      </li>
    ))}
  </ul>
</nav>
```

### Cookie Consent Banner

```astro
---
// src/components/CookieConsent.astro
import { cms } from '../lib/cms';

const consent = await cms.legal.getCookieConsent();
---

{consent && (
  <div id="cookie-banner" data-testid="cookie-banner">
    <h3>Cookie Settings</h3>
    {consent.groups.map((group) => (
      <label>
        <input
          type="checkbox"
          name={group.cookie_name}
          checked={group.default_enabled || group.is_required}
          disabled={group.is_required}
        />
        {group.cookie_name}
        {group.is_required && <span>(required)</span>}
      </label>
    ))}
    <button id="accept-cookies">Save Preferences</button>
  </div>
)}
```

---

## React (with TanStack Query)

### Client and Query Setup

```typescript
// src/lib/cms.ts
import { ForjaClient } from '@forjacms/client';

export const cms = new ForjaClient({
  baseUrl: import.meta.env.VITE_CMS_API_URL,
  apiKey: import.meta.env.VITE_CMS_API_KEY,
  siteId: import.meta.env.VITE_CMS_SITE_ID,
});
```

### Custom Hooks

```typescript
// src/hooks/use-blogs.ts
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { cms } from '../lib/cms';
import type { BlogDetailResponse, BlogListItem, PaginatedResult } from '@forjacms/client';

export function useBlogList(pageSize = 10) {
  return useInfiniteQuery<PaginatedResult<BlogListItem>>({
    queryKey: ['blogs', pageSize],
    queryFn: ({ pageParam = 1 }) =>
      cms.blogs.listPublished({ page: pageParam as number, pageSize }),
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.total_pages
        ? lastPage.meta.page + 1
        : undefined,
    initialPageParam: 1,
  });
}

export function useBlogBySlug(slug: string) {
  return useQuery<BlogDetailResponse | null>({
    queryKey: ['blog', slug],
    queryFn: () => cms.blogs.getBySlug(slug),
  });
}

export function useFeaturedBlogs(limit = 3) {
  return useQuery({
    queryKey: ['blogs', 'featured', limit],
    queryFn: () => cms.blogs.listFeatured({ limit }),
  });
}
```

### Blog List Component

```tsx
// src/components/BlogList.tsx
import { useBlogList } from '../hooks/use-blogs';

export function BlogList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useBlogList(12);

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Failed to load blogs.</p>;

  const blogs = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div>
      <div className="grid">
        {blogs.map((blog) => (
          <article key={blog.id}>
            <a href={`/blog/${blog.slug}`}>
              <h2>{blog.slug}</h2>
              <time dateTime={blog.published_date}>
                {new Date(blog.published_date).toLocaleDateString()}
              </time>
            </a>
          </article>
        ))}
      </div>

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
```

### Blog Detail Component

Render blog HTML content safely using DOMPurify to sanitize the CMS output:

```tsx
// src/components/BlogDetail.tsx
import { useParams } from 'react-router-dom';
import { useBlogBySlug } from '../hooks/use-blogs';
import { useQuery } from '@tanstack/react-query';
import { cms } from '../lib/cms';
import DOMPurify from 'dompurify';

export function BlogDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: blog, isLoading, error } = useBlogBySlug(slug!);

  const { data: cover } = useQuery({
    queryKey: ['media', blog?.cover_image_id],
    queryFn: () => cms.media.get(blog!.cover_image_id!),
    enabled: !!blog?.cover_image_id,
  });

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Failed to load blog.</p>;
  if (!blog) return <p>Blog not found.</p>;

  const localization = blog.localizations[0];
  const sanitizedBody = localization?.body
    ? DOMPurify.sanitize(localization.body)
    : '';

  return (
    <article>
      {cover && <img src={cover.public_url ?? ''} alt="" />}
      <h1>{localization?.title}</h1>
      <SanitizedHtml html={sanitizedBody} className="blog-content" />
    </article>
  );
}

/** Renders pre-sanitized HTML using a shadow DOM container. */
function SanitizedHtml({ html, className }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      // Clear previous content and set sanitized output via DOM API
      while (ref.current.firstChild) ref.current.firstChild.remove();
      const template = document.createElement('template');
      template.textContent = html; // textContent is safe; we parse only DOMPurify output
      ref.current.append(...Array.from(new DOMParser().parseFromString(html, 'text/html').body.childNodes).map(n => n.cloneNode(true)));
    }
  }, [html]);

  return <div ref={ref} className={className} />;
}
```

:::warning HTML Content Safety
When rendering HTML from the CMS in a browser context, always sanitize it first using a library like [DOMPurify](https://github.com/cure53/DOMPurify). Astro's `set:html` handles this server-side, but client-side frameworks need explicit sanitization.
:::

---

## Angular (v17+ with Signals)

The `@forjacms/client/angular` subpath provides Angular DI integration and a signal-based resource helper. No manual `OnInit`, `subscribe`, or `signal.set()` boilerplate needed.

### App Configuration

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideForja } from '@forjacms/client/angular';
import { environment } from './environments/environment';

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

### Blog List Component

```typescript
// blog-list.component.ts
import { Component } from '@angular/core';
import { injectForja, forjaResource } from '@forjacms/client/angular';

@Component({
  selector: 'app-blog-list',
  template: `
    @if (blogs.isLoading()) {
      <p>Loading blogs...</p>
    } @else if (blogs.error()) {
      <p>Failed to load: {{ blogs.error()!.message }}</p>
      <button (click)="blogs.reload()">Retry</button>
    } @else {
      <div class="grid">
        @for (blog of blogs.value()!.data; track blog.id) {
          <article>
            <a [routerLink]="['/blog', blog.slug]">
              <h2>{{ blog.slug }}</h2>
              <time [attr.datetime]="blog.published_date">
                {{ blog.published_date | date }}
              </time>
            </a>
          </article>
        }
      </div>
    }
  `,
})
export class BlogListComponent {
  private forja = injectForja();
  blogs = forjaResource(() => this.forja.blogs.listPublished({ page: 1, pageSize: 12 }));
}
```

### Navigation Component

```typescript
// nav.component.ts
import { Component, computed } from '@angular/core';
import { injectForja, forjaResource } from '@forjacms/client/angular';

@Component({
  selector: 'app-nav',
  template: `
    <nav>
      <ul>
        @for (node of tree.value() ?? []; track node.id) {
          <li>
            <a
              [href]="node.external_url ?? '/' + node.page_slug"
              [target]="node.open_in_new_tab ? '_blank' : '_self'"
            >
              {{ node.title }}
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
})
export class NavComponent {
  private forja = injectForja();
  private menu = forjaResource(() => this.forja.navigation.getMenuBySlug('primary'));
  tree = forjaResource(() =>
    this.menu.value()
      ? this.forja.navigation.getTree(this.menu.value()!.id)
      : Promise.resolve([])
  );
}
```

### Cookie Consent

```typescript
// cookie-banner.component.ts
import { Component } from '@angular/core';
import { injectForja, forjaResource } from '@forjacms/client/angular';

@Component({
  selector: 'app-cookie-banner',
  template: `
    @if (consent.value(); as doc) {
      <div class="cookie-banner">
        @for (group of doc.groups; track group.id) {
          <label>
            <input
              type="checkbox"
              [checked]="group.default_enabled"
              [disabled]="group.is_required"
            />
            {{ group.cookie_name }}
          </label>
        }
      </div>
    }
  `,
})
export class CookieBannerComponent {
  private forja = injectForja();
  consent = forjaResource(() => this.forja.legal.getCookieConsent());
}
```

:::tip forjaResource API
`forjaResource(loader)` returns an object with four members:
- `value()` — `Signal<T | undefined>` with the resolved data
- `isLoading()` — `Signal<boolean>` for loading state
- `error()` — `Signal<Error | null>` for error state
- `reload()` — re-execute the loader function
:::

---

## Vanilla TypeScript (Node.js Script)

### Static Site Generator Script

A standalone script that fetches all blog content and writes it to disk, useful for static site generation or data export.

```typescript
// scripts/export-blogs.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ForjaClient } from '@forjacms/client';

const forja = new ForjaClient({
  baseUrl: process.env.CMS_API_URL!,
  apiKey: process.env.CMS_API_KEY!,
  siteId: process.env.CMS_SITE_ID!,
});

async function exportBlogs() {
  const outputDir = join(process.cwd(), 'content', 'blogs');
  mkdirSync(outputDir, { recursive: true });

  // Fetch all blogs using the async iterator
  const firstPage = await forja.blogs.listPublished({ pageSize: 50 });
  let count = 0;

  for await (const page of firstPage) {
    for (const blog of page.data) {
      // Fetch full detail for each blog
      const detail = await forja.blogs.get(blog.id);
      if (!detail) continue;

      const localization = detail.localizations[0];
      if (!localization) continue;

      const filename = `${blog.slug ?? blog.id}.json`;
      const filePath = join(outputDir, filename);

      writeFileSync(filePath, JSON.stringify({
        id: blog.id,
        slug: blog.slug,
        title: localization.title,
        excerpt: localization.excerpt,
        body: localization.body,
        author: blog.author,
        published_date: blog.published_date,
        categories: detail.categories.map((c) => c.slug),
      }, null, 2));

      count++;
    }
  }

  console.log(`Exported ${count} blog posts to ${outputDir}`);
}

exportBlogs().catch(console.error);
```

### Analytics Reporting Script

```typescript
// scripts/analytics-report.ts
import { ForjaClient } from '@forjacms/client';

const forja = new ForjaClient({
  baseUrl: process.env.CMS_API_URL!,
  apiKey: process.env.CMS_API_KEY!,
  siteId: process.env.CMS_SITE_ID!,
});

async function generateReport() {
  const report = await forja.analytics.getReport({ days: 30, topN: 20 });

  console.log('--- 30-Day Analytics Report ---');
  console.log(`Total views: ${report.total_views}`);
  console.log(`Unique visitors: ${report.total_unique_visitors}`);
  console.log('');
  console.log('Top content:');

  for (const item of report.top_content) {
    console.log(`  ${item.path} — ${item.total_views} views (${item.unique_visitors} unique)`);
  }

  console.log('');
  console.log('Daily trend (last 7 days):');

  const recentTrend = report.trend.slice(-7);
  for (const point of recentTrend) {
    const bar = '#'.repeat(Math.ceil(point.total_views / 10));
    console.log(`  ${point.date}: ${bar} (${point.total_views})`);
  }
}

generateReport().catch(console.error);
```

### Site Health Check Script

```typescript
// scripts/health-check.ts
import { ForjaClient, ForjaNetworkError, ForjaAuthError } from '@forjacms/client';

const forja = new ForjaClient({
  baseUrl: process.env.CMS_API_URL!,
  apiKey: process.env.CMS_API_KEY!,
  siteId: process.env.CMS_SITE_ID!,
});

async function healthCheck() {
  const checks: { name: string; status: string; detail?: string }[] = [];

  // Check site config
  try {
    const site = await forja.site.get();
    checks.push({ name: 'Site Config', status: 'OK', detail: site.name });
  } catch (error) {
    if (error instanceof ForjaAuthError) {
      checks.push({ name: 'Site Config', status: 'FAIL', detail: 'Auth error — check API key' });
    } else if (error instanceof ForjaNetworkError) {
      checks.push({ name: 'Site Config', status: 'FAIL', detail: 'Network error — CMS unreachable' });
    } else {
      checks.push({ name: 'Site Config', status: 'FAIL', detail: String(error) });
    }
  }

  // Check blog content
  try {
    const blogs = await forja.blogs.listPublished({ pageSize: 1 });
    checks.push({
      name: 'Blog Content',
      status: 'OK',
      detail: `${blogs.meta.total_items} published posts`,
    });
  } catch {
    checks.push({ name: 'Blog Content', status: 'FAIL' });
  }

  // Check navigation
  try {
    const menus = await forja.navigation.listMenus();
    checks.push({
      name: 'Navigation',
      status: 'OK',
      detail: `${menus.length} menus`,
    });
  } catch {
    checks.push({ name: 'Navigation', status: 'FAIL' });
  }

  // Check social links
  try {
    const links = await forja.social.list();
    checks.push({
      name: 'Social Links',
      status: 'OK',
      detail: `${links.length} links`,
    });
  } catch {
    checks.push({ name: 'Social Links', status: 'FAIL' });
  }

  // Output results
  console.log('--- CMS Health Check ---');
  for (const check of checks) {
    const icon = check.status === 'OK' ? '[PASS]' : '[FAIL]';
    console.log(`${icon} ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
  }

  const failed = checks.filter((c) => c.status === 'FAIL');
  if (failed.length > 0) {
    process.exit(1);
  }
}

healthCheck().catch(console.error);
```
