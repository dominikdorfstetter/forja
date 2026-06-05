---
sidebar_position: 3
---

# Pagination

Several SDK methods return paginated results. The SDK wraps these in a `PaginatedResult<T>` object that provides metadata about the current page and helper methods for fetching additional pages.

## PaginatedResult\<T\>

Every paginated method (e.g. `listPublished`, `listTags`, `listEntries`) returns a `PaginatedResult<T>` with the following shape:

```typescript
interface PaginatedResult<T> {
  /** Items on the current page */
  data: T[];

  /** Pagination metadata */
  meta: {
    page: number;        // Current page number (1-based)
    page_size: number;   // Items per page
    total_pages: number; // Total number of pages
    total_items: number; // Total number of items across all pages
  };

  /** Fetch the next page, or null if already on the last page */
  fetchNext(): Promise<PaginatedResult<T> | null>;

  /** Fetch all remaining items across all pages */
  fetchAll(): Promise<T[]>;

  /** Async iterator over all pages starting from the current one */
  [Symbol.asyncIterator](): AsyncIterableIterator<Paginated<T>>;
}
```

## Basic Usage

```typescript
const result = await forja.blogs.listPublished({ page: 1, pageSize: 10 });

console.log(result.data);              // BlogListItem[] (up to 10 items)
console.log(result.meta.page);         // 1
console.log(result.meta.total_pages);  // e.g. 5
console.log(result.meta.total_items);  // e.g. 42
```

## Pagination Parameters

Methods that return paginated results accept `PaginationParams`:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `number` | `1` | Page number (1-based) |
| `pageSize` | `number` | API default | Number of items per page |

Some resources accept `SearchablePaginationParams`, which extends `PaginationParams` with additional filtering options:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | `string` | — | Free-text search filter |
| `sortBy` | `string` | — | Field name to sort by |
| `sortDir` | `'asc' \| 'desc'` | — | Sort direction |

Methods that accept `SearchablePaginationParams` include:
- `forja.taxonomy.listTags()`
- `forja.taxonomy.listCategories()`
- `forja.cv.listSkills()`
- `forja.cv.listEntries()` (also accepts `entryType`)
- `forja.legal.list()`

## fetchNext()

Fetch the next page of results. Returns `null` when the current page is the last page.

```typescript
const page1 = await forja.blogs.listPublished({ page: 1, pageSize: 10 });
const page2 = await page1.fetchNext();

if (page2) {
  console.log('Page 2 items:', page2.data.length);
  const page3 = await page2.fetchNext();
  // ...
} else {
  console.log('No more pages');
}
```

This is useful for implementing "Load More" buttons:

```typescript
let currentPage = await forja.blogs.listPublished({ pageSize: 10 });
const allItems = [...currentPage.data];

async function loadMore() {
  const next = await currentPage.fetchNext();
  if (next) {
    currentPage = next;
    allItems.push(...next.data);
  }
  return next !== null; // true if there are potentially more pages
}
```

## fetchAll()

Fetch all remaining items across all pages starting from the current page. This makes sequential requests for each subsequent page and returns a flat array of all items.

```typescript
const page1 = await forja.blogs.listPublished({ pageSize: 20 });
const allBlogs = await page1.fetchAll();

console.log(`Fetched all ${allBlogs.length} blogs`);
```

:::warning Large Datasets
`fetchAll()` loads every page sequentially. For sites with thousands of items, this can result in many HTTP requests. Consider using pagination or the async iterator with early termination instead.
:::

## Async Iteration

`PaginatedResult` implements `Symbol.asyncIterator`, allowing you to use `for await...of` to iterate over all pages:

```typescript
const page1 = await forja.blogs.listPublished({ pageSize: 10 });

for await (const page of page1) {
  console.log(`Page ${page.meta.page} of ${page.meta.total_pages}`);

  for (const blog of page.data) {
    console.log(blog.slug);
  }
}
```

The iterator yields `Paginated<T>` objects (with `data` and `meta`) for each page, starting from the current page.

### Early Termination

You can break out of the loop to stop fetching additional pages:

```typescript
const result = await forja.taxonomy.listTags({ pageSize: 50 });
const collected: TagResponse[] = [];

for await (const page of result) {
  collected.push(...page.data);
  if (collected.length >= 200) break; // Stop after collecting enough
}
```

## Complete Example: Building a Blog Archive

```typescript
import { ForjaClient } from '@forjacms/client';
import type { BlogListItem } from '@forjacms/client';

const forja = new ForjaClient({
  baseUrl: 'https://cms.example.com/api/v1',
  apiKey: 'dk_read_...',
  siteId: 'your-site-uuid',
});

// Fetch all published blogs, grouped by year
const blogsByYear = new Map<number, BlogListItem[]>();

const firstPage = await forja.blogs.listPublished({ pageSize: 50 });

for await (const page of firstPage) {
  for (const blog of page.data) {
    const year = new Date(blog.published_date).getFullYear();
    const yearBlogs = blogsByYear.get(year) ?? [];
    yearBlogs.push(blog);
    blogsByYear.set(year, yearBlogs);
  }
}

// Output the archive
for (const [year, blogs] of [...blogsByYear.entries()].sort((a, b) => b[0] - a[0])) {
  console.log(`\n${year} (${blogs.length} posts)`);
  for (const blog of blogs) {
    console.log(`  - ${blog.slug}`);
  }
}
```
