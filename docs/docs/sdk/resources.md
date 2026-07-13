---
sidebar_position: 2
---

# Resource Reference

This page documents every resource namespace on `ForjaClient` with method signatures, return types, and usage examples.

## Blogs

**Accessor:** `forja.blogs`

Methods for fetching published blog posts, filtering by category, and retrieving featured or related content.

### `listPublished(params?)`

Fetch a paginated list of published blog posts.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `number` | `1` | Page number |
| `pageSize` | `number` | API default | Items per page |

**Returns:** `PaginatedResult<BlogListItem>`

```typescript
const blogs = await forja.blogs.listPublished({ page: 1, pageSize: 10 });

console.log(blogs.data);           // BlogListItem[]
console.log(blogs.meta.total_items); // total count across all pages
```

### `listByCategory(slug, params?)`

Fetch published blogs filtered by category slug.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `slug` | `string` | Yes | Category slug to filter by |
| `page` | `number` | No | Page number |
| `pageSize` | `number` | No | Items per page |

**Returns:** `PaginatedResult<BlogListItem>`

```typescript
const techBlogs = await forja.blogs.listByCategory('technology', {
  page: 1,
  pageSize: 5,
});
```

### `listFeatured(opts?)`

Fetch featured blog posts. Returns full detail responses including localizations and categories.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | `number` | API default | Maximum number of results |

**Returns:** `BlogDetailResponse[]`

```typescript
const featured = await forja.blogs.listFeatured({ limit: 3 });

for (const blog of featured) {
  const title = blog.localizations[0]?.title;
  console.log(title, blog.is_featured); // true
}
```

### `listSimilar(blogId, opts?)`

Fetch blog posts similar to a given blog, useful for "related posts" sections.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `blogId` | `string` | Yes | UUID of the reference blog |
| `limit` | `number` | No | Maximum number of results |

**Returns:** `BlogListItem[]`

```typescript
const similar = await forja.blogs.listSimilar('blog-uuid', { limit: 4 });
```

### `get(idOrSlug)`

Fetch a single blog by ID or slug. Returns full detail including localizations, categories, and documents.

**Returns:** `BlogDetailResponse | null` — returns `null` if not found.

```typescript
const blog = await forja.blogs.get('my-blog-uuid');

if (blog) {
  console.log(blog.localizations[0]?.title);
  console.log(blog.categories.map((c) => c.slug));
  console.log(blog.documents.length);
}
```

### `getBySlug(slug)`

Fetch a blog by its slug. Internally resolves the slug to an ID and fetches the full detail.

**Returns:** `BlogDetailResponse | null` — returns `null` if not found.

```typescript
const blog = await forja.blogs.getBySlug('getting-started-with-forja');

if (blog) {
  const localization = blog.localizations[0];
  console.log(localization?.title, localization?.excerpt);
}
```

### `rss()`

Fetch the RSS feed for the site as raw XML.

**Returns:** `string`

```typescript
const xml = await forja.blogs.rss();
// Serve as application/rss+xml
```

---

## Pages

**Accessor:** `forja.pages`

Methods for fetching CMS pages by their URL route and retrieving page sections with localizations.

### `getByRoute(route)`

Fetch a page by its URL route. The leading slash is optional.

**Returns:** `PageDetailResponse | null` — returns `null` if not found.

```typescript
const aboutPage = await forja.pages.getByRoute('/about');

if (aboutPage) {
  console.log(aboutPage.page_type);   // 'Static' | 'Landing' | ...
  console.log(aboutPage.localizations[0]?.title);
}
```

### `getSections(pageId)`

Fetch all sections for a page, ordered by `display_order`.

**Returns:** `PageSectionResponse[]`

```typescript
const sections = await forja.pages.getSections('page-uuid');

for (const section of sections) {
  console.log(section.section_type, section.display_order);
}
```

### `getSectionLocalizations(sectionId)`

Fetch translations for a specific page section.

**Returns:** `SectionLocalizationResponse[]`

```typescript
const translations = await forja.pages.getSectionLocalizations('section-uuid');

for (const t of translations) {
  console.log(t.locale_id, t.title, t.text);
}
```

### `getPageSectionLocalizations(pageId)`

Fetch all section translations for an entire page in a single call.

**Returns:** `SectionLocalizationResponse[]`

```typescript
const allTranslations = await forja.pages.getPageSectionLocalizations('page-uuid');
```

---

## Navigation

**Accessor:** `forja.navigation`

Methods for fetching navigation menus and building menu trees for site headers, footers, and sidebars.

### `listMenus()`

Fetch all navigation menus for the site.

**Returns:** `NavigationMenuResponse[]`

```typescript
const menus = await forja.navigation.listMenus();

for (const menu of menus) {
  console.log(menu.slug, menu.item_count);
}
```

### `getMenu(id)`

Fetch a single menu by its UUID.

**Returns:** `NavigationMenuResponse | null` — returns `null` if not found.

```typescript
const menu = await forja.navigation.getMenu('menu-uuid');
```

### `getMenuBySlug(slug)`

Fetch a menu by its slug.

**Returns:** `NavigationMenuResponse | null` — returns `null` if not found.

```typescript
const primaryMenu = await forja.navigation.getMenuBySlug('primary');

if (primaryMenu) {
  console.log(primaryMenu.max_depth, primaryMenu.is_active);
}
```

### `getTree(menuId, opts?)`

Fetch the navigation tree for a menu. Each node contains its children, making it suitable for rendering nested menus.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `menuId` | `string` | Yes | UUID of the menu |
| `locale` | `string` | No | Locale code for translated titles |

**Returns:** `NavigationTree[]`

```typescript
const tree = await forja.navigation.getTree('menu-uuid', { locale: 'en' });

function renderNav(nodes: NavigationTree[]) {
  return nodes.map((node) => ({
    title: node.title,
    url: node.external_url ?? `/${node.page_slug}`,
    children: node.children.length > 0 ? renderNav(node.children) : [],
  }));
}
```

### `listItems(menuId)`

Fetch a flat list of all items in a menu.

**Returns:** `NavigationItemResponse[]`

```typescript
const items = await forja.navigation.listItems('menu-uuid');
```

### `getItem(id)`

Fetch a single navigation item by ID.

**Returns:** `NavigationItemResponse | null` — returns `null` if not found.

```typescript
const item = await forja.navigation.getItem('item-uuid');
```

---

## Taxonomy

**Accessor:** `forja.taxonomy`

Methods for fetching tags and categories, and resolving taxonomy associations for content items.

### `listTags(params?)`

Fetch a paginated, searchable list of tags.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `number` | `1` | Page number |
| `pageSize` | `number` | API default | Items per page |
| `search` | `string` | — | Filter by search term |
| `sortBy` | `string` | — | Sort field (e.g. `slug`) |
| `sortDir` | `'asc' \| 'desc'` | — | Sort direction |

**Returns:** `PaginatedResult<TagResponse>`

```typescript
const tags = await forja.taxonomy.listTags({
  search: 'rust',
  sortBy: 'slug',
  sortDir: 'asc',
});

console.log(tags.data); // TagResponse[]
```

### `listCategories(params?)`

Fetch a paginated, searchable list of categories.

**Returns:** `PaginatedResult<CategoryResponse>`

```typescript
const categories = await forja.taxonomy.listCategories({ pageSize: 50 });
```

### `getTag(id)`

Fetch a single tag by its UUID.

**Returns:** `TagResponse | null` -- returns `null` if not found.

```typescript
const tag = await forja.taxonomy.getTag('tag-uuid');
```

### `getTagBySlug(slug)`

Fetch a tag by its slug.

**Returns:** `TagResponse | null` -- returns `null` if not found.

```typescript
const tag = await forja.taxonomy.getTagBySlug('rust');

if (tag) {
  console.log(tag.name, tag.slug);
}
```

### `getCategory(id)`

Fetch a single category by its UUID.

**Returns:** `CategoryResponse | null` -- returns `null` if not found.

```typescript
const category = await forja.taxonomy.getCategory('category-uuid');
```

### `getCategoryChildren(parentId)`

Fetch child categories for a given parent category.

**Returns:** `CategoryResponse[]`

```typescript
const children = await forja.taxonomy.getCategoryChildren('parent-uuid');

for (const child of children) {
  console.log(child.name, child.slug);
}
```

### `getCategoriesWithBlogCounts()`

Fetch all categories along with the number of published blog posts in each.

**Returns:** `CategoryWithCountResponse[]`

```typescript
const categoriesWithCounts = await forja.taxonomy.getCategoriesWithBlogCounts();

for (const cat of categoriesWithCounts) {
  console.log(`${cat.slug}: ${cat.blog_count} posts`);
}
```

### `getContentTags(contentId)`

Fetch tags associated with a specific content item.

**Returns:** `TagResponse[]`

```typescript
const blogTags = await forja.taxonomy.getContentTags(blog.content_id);
```

### `getContentCategories(contentId)`

Fetch categories associated with a specific content item.

**Returns:** `CategoryResponse[]`

```typescript
const blogCategories = await forja.taxonomy.getContentCategories(blog.content_id);
```

---

## Analytics

**Accessor:** `forja.analytics`

Methods for tracking pageviews and retrieving analytics reports.

### `trackPageview(request)`

Record a pageview event. Call this from your frontend to track visitor activity.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | `string` | Yes | Page path (e.g. `/blog/hello-world`) |
| `referrer` | `string` | No | Referrer URL |

**Returns:** `TrackPageviewResponse` — `{ ok: boolean }`

```typescript
await forja.analytics.trackPageview({
  path: '/blog/hello-world',
  referrer: 'https://google.com',
});
```

### `getReport(params?)`

Fetch an analytics summary report for the site.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | `number` | — | Number of days to include |
| `topN` | `number` | — | Number of top content items to return |
| `startDate` | `string` | — | Start date (ISO format) |
| `endDate` | `string` | — | End date (ISO format) |

**Returns:** `AnalyticsReportResponse`

```typescript
const report = await forja.analytics.getReport({ days: 30, topN: 10 });

console.log('Total views:', report.total_views);
console.log('Unique visitors:', report.total_unique_visitors);
console.log('Top pages:', report.top_content);
console.log('Trend data:', report.trend);
```

### `getPageAnalytics(params)`

Fetch analytics for a specific page path, including trend data and referrer breakdown.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | `string` | Yes | Page path |
| `days` | `number` | No | Number of days |
| `startDate` | `string` | No | Start date (ISO) |
| `endDate` | `string` | No | End date (ISO) |

**Returns:** `AnalyticsPageDetailResponse`

```typescript
const pageStats = await forja.analytics.getPageAnalytics({
  path: '/blog/hello-world',
  days: 7,
});

console.log(pageStats.total_views, pageStats.total_unique_visitors);
console.log('Referrers:', pageStats.referrers);
```

---

## CV

**Accessor:** `forja.cv`

Methods for fetching skills and CV/resume entries (work history, education, certifications, etc.).

### `listSkills(params?)`

Fetch a paginated, searchable list of skills.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `number` | `1` | Page number |
| `pageSize` | `number` | API default | Items per page |
| `search` | `string` | — | Filter by search term |
| `sortBy` | `string` | — | Sort field |
| `sortDir` | `'asc' \| 'desc'` | — | Sort direction |

**Returns:** `PaginatedResult<SkillResponse>`

```typescript
const skills = await forja.cv.listSkills({ pageSize: 100 });

for (const skill of skills.data) {
  console.log(skill.name, skill.category, skill.proficiency_level);
}
```

### `getSkill(id)`

Fetch a single skill by its UUID.

**Returns:** `SkillResponse | null` — returns `null` if not found.

```typescript
const skill = await forja.cv.getSkill('skill-uuid');
```

### `getSkillBySlug(slug)`

Fetch a skill by its slug.

**Returns:** `SkillResponse | null` — returns `null` if not found.

```typescript
const typescript = await forja.cv.getSkillBySlug('typescript');

if (typescript) {
  console.log(typescript.name, typescript.icon, typescript.proficiency_level);
}
```

### `listEntries(params?)`

Fetch a paginated list of CV entries. Supports filtering by entry type.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `number` | `1` | Page number |
| `pageSize` | `number` | API default | Items per page |
| `search` | `string` | — | Filter by search term |
| `sortBy` | `string` | — | Sort field |
| `sortDir` | `'asc' \| 'desc'` | — | Sort direction |
| `entryType` | `CvEntryType` | — | Filter: `'Work'`, `'Education'`, `'Volunteer'`, `'Certification'`, `'Project'` |

**Returns:** `PaginatedResult<CvEntryResponse>`

```typescript
const workHistory = await forja.cv.listEntries({ entryType: 'Work' });

for (const entry of workHistory.data) {
  console.log(entry.company, entry.location, entry.start_date);
  if (entry.is_current) console.log('(current position)');
}
```

### `getEntry(id)`

Fetch a single CV entry by its UUID.

**Returns:** `CvEntryResponse | null` -- returns `null` if not found.

```typescript
const entry = await forja.cv.getEntry('entry-uuid');
```

### `getEntryDetail(id)`

Fetch a CV entry's full detail by its UUID. For CV entries the relational graph is bounded, so the detail shape is **identical** to [`getEntry`](#getentryid) — the `/cv/{id}/detail` route exists purely for uniformity across content types ([ADR 0003](https://github.com/dominikdorfstetter/forja/blob/main/docs/adr/0003-uniform-content-route-convention.md)).

**Returns:** `CvEntryResponse | null` -- returns `null` if not found.

```typescript
const entry = await forja.cv.getEntryDetail('entry-uuid');
```

---

## Legal

**Accessor:** `forja.legal`

Methods for fetching legal documents (privacy policies, terms of service, cookie consent) and their consent groups.

### `list(params?)`

Fetch a paginated list of legal documents.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `number` | `1` | Page number |
| `pageSize` | `number` | API default | Items per page |
| `search` | `string` | — | Filter by search term |
| `sortBy` | `string` | — | Sort field |
| `sortDir` | `'asc' \| 'desc'` | — | Sort direction |

**Returns:** `PaginatedResult<LegalDocumentResponse>`

```typescript
const docs = await forja.legal.list();

for (const doc of docs.data) {
  console.log(doc.document_type, doc.cookie_name);
}
```

### `get(id)`

Fetch a legal document by ID, including its localizations.

**Returns:** `LegalDocumentDetailResponse | null` — returns `null` if not found.

```typescript
const doc = await forja.legal.get('doc-uuid');

if (doc) {
  const localization = doc.localizations[0];
  console.log(localization?.title, localization?.intro);
}
```

### `getBySlug(slug)`

Fetch a legal document by its slug, including localizations.

**Returns:** `LegalDocumentDetailResponse | null` — returns `null` if not found.

```typescript
const privacy = await forja.legal.getBySlug('privacy-policy');

if (privacy) {
  console.log(privacy.document_type); // 'PrivacyPolicy'
}
```

### `getDetail(id)`

Fetch a legal document by ID with full detail including localizations and version history.

**Returns:** `LegalDocumentDetailResponse | null` -- returns `null` if not found.

```typescript
const detail = await forja.legal.getDetail('doc-uuid');

if (detail) {
  console.log(detail.document_type, detail.localizations.length);
}
```

### `listVersions(id)`

Fetch version history for a legal document.

**Returns:** `LegalVersionResponse[]`

```typescript
const versions = await forja.legal.listVersions('doc-uuid');

for (const version of versions) {
  console.log(version.version_number, version.published_at);
}
```

### `getCookieConsent()`

Fetch the cookie consent document with its consent groups and items. Returns the full structure needed to render a cookie consent banner.

**Returns:** `LegalDocumentWithGroups | null` — returns `null` if no cookie consent document exists.

```typescript
const consent = await forja.legal.getCookieConsent();

if (consent) {
  for (const group of consent.groups) {
    console.log(group.cookie_name, group.is_required, group.default_enabled);
    for (const item of group.items) {
      console.log('  -', item.cookie_name, item.is_required);
    }
  }
}
```

### `getGroups(documentId)`

Fetch consent groups for a legal document, each including its items.

**Returns:** `LegalGroupWithItems[]`

```typescript
const groups = await forja.legal.getGroups('doc-uuid');
```

### `getGroupItems(groupId)`

Fetch individual consent items within a consent group.

**Returns:** `LegalItemResponse[]`

```typescript
const items = await forja.legal.getGroupItems('group-uuid');
```

---

## Site

**Accessor:** `forja.site`

### `get()`

Fetch the site configuration including name, logo, theme, timezone, and locale settings.

**Returns:** `SiteResponse`

```typescript
const site = await forja.site.get();

console.log(site.name);
console.log(site.base_url);
console.log(site.timezone);
console.log(site.default_locale_id);
console.log(site.is_active);
```

### `listLocales()`

Fetch all available locales for the site.

**Returns:** `LocaleResponse[]`

```typescript
const locales = await forja.site.listLocales();

for (const locale of locales) {
  console.log(locale.code, locale.name);
}
```

### `getSettings()`

Fetch the curated public subset of the site's settings — contact email, web-manifest colors, and SEO defaults.

**Returns:** `PublicSiteSettings`

```typescript
const settings = await forja.site.getSettings();

console.log(settings.contact_email);
console.log(settings.theme_color, settings.background_color);
console.log(settings.seo_title_template);
console.log(settings.seo_default_description);
```

:::info Read-tier accessible
Unlike the raw admin settings endpoint (which requires an Admin key), this read works with a `Read` API key. The shape deliberately excludes operational configuration — allowed origins, storage quotas, data retention, module flags, and code injection (use `getCodeInjection()` for the latter).
:::

Fields that are not configured on the server fall back to the backend's house defaults: empty strings for `contact_email` and `seo_default_description`, `#ffffff` for both colors, and `{{title}} | {{site_name}}` for the title template.

---

## Media

**Accessor:** `forja.media`

### `list(params?)`

Fetch a paginated list of media assets.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `number` | `1` | Page number |
| `pageSize` | `number` | API default | Items per page |

**Returns:** `PaginatedResult<MediaResponse>`

```typescript
const media = await forja.media.list({ page: 1, pageSize: 20 });

for (const asset of media.data) {
  console.log(asset.public_url, asset.mime_type);
}
```

### `get(id)`

Fetch a media asset by its UUID, including all generated variants (thumbnails, responsive sizes).

**Returns:** `MediaResponse | null` — returns `null` if not found.

```typescript
const media = await forja.media.get('media-uuid');

if (media) {
  console.log(media.public_url);
  console.log(media.mime_type, media.width, media.height);

  // Access responsive variants
  for (const variant of media.variants) {
    console.log(variant.variant_name, variant.width, variant.height, variant.public_url);
  }
}
```

:::tip Using Media with Blogs
Blog posts reference media assets by ID through `cover_image_id` and `header_image_id`. Use `forja.media.get()` to resolve them to URLs:

```typescript
const blog = await forja.blogs.getBySlug('my-post');
const cover = blog?.cover_image_id
  ? await forja.media.get(blog.cover_image_id)
  : null;
```
:::

---

## Social

**Accessor:** `forja.social`

### `list()`

Fetch all social media links for the site, ordered by `display_order`.

**Returns:** `SocialLinkResponse[]`

```typescript
const links = await forja.social.list();

for (const link of links) {
  console.log(link.title, link.url, link.icon);
}
```

---

## UI Strings

**Accessor:** `forja.strings(locale)`

Site-scoped dictionary of interface chrome strings (labels, headings, aria texts) that site operators manage in the admin panel, resolved for one locale.

### `strings(locale)`

Fetch the resolved UI strings for a locale as a flat `key → value` map.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `locale` | `string` | Yes | Locale code to resolve values for (e.g. `'en'`, `'de-AT'`) |

**Returns:** `UiStringsResponse` — a flat `Record<string, string>` map of key → resolved value.

```typescript
const strings = await forja.strings('de');

const minRead = strings['blog.min_read'] ?? 'min read';
const darkModeLabel = strings['nav.aria.toggle_dark'] ?? 'Toggle dark mode';
```

:::info Locale is required
The `locale` parameter is mandatory — the API rejects requests without it (`400 ERR_STRINGS_LOCALE_REQUIRED`). Unknown locale codes fall back silently to the site's default locale.
:::

Resolution and fallback behavior:

- One value per key, resolved server-side via the fallback chain: exact locale match → site default locale → first localization matching the language code.
- Keys with no localization at all are omitted from the map — keep a template-side default for every key you render (never render an empty string).
- Keys are dot-namespaced lowercase identifiers (`blog.min_read`, `footer.rights_reserved`, `nav.aria.toggle_dark`).
- Responses are cached server-side for a short interval, so fetching the map once per page render is cheap.

---

## Projects

**Accessor:** `forja.projects`

Methods for fetching portfolio projects with localizations, links, media, and skill associations.

### `listPublished(params?)`

Fetch a paginated list of published portfolio projects.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `number` | `1` | Page number |
| `pageSize` | `number` | API default | Items per page |

**Returns:** `PaginatedResult<ProjectListItem>`

```typescript
const projects = await forja.projects.listPublished({ page: 1, pageSize: 10 });

for (const project of projects.data) {
  console.log(project.title, project.slug);
}
```

### `get(id)`

Fetch a single project by its UUID — the **lightweight** list shape: scalar fields, `skill_ids`, and `localizations`. The relational graph (`links`, `media`, `cv_entry_ids`) is held off this route; use [`getDetail`](#getdetailid) ([ADR 0003](https://github.com/dominikdorfstetter/forja/blob/main/docs/adr/0003-uniform-content-route-convention.md)).

**Returns:** `ProjectResponse | null` -- returns `null` if not found.

```typescript
const project = await forja.projects.get('project-uuid');

if (project) {
  console.log(project.localizations[0]?.title);
  console.log(project.skill_ids);
}
```

### `getDetail(id)`

Fetch a single project's **full** relational graph by its UUID — everything `get` returns plus `links`, `media`, and `cv_entry_ids`.

**Returns:** `ProjectDetailResponse | null` -- returns `null` if not found.

```typescript
const project = await forja.projects.getDetail('project-uuid');

if (project) {
  console.log(project.links, project.media);
}
```

### `getBySlug(slug)`

Fetch a project by its URL slug — the lightweight shape, same as [`get`](#getid).

**Returns:** `ProjectResponse | null` -- returns `null` if not found.

```typescript
const project = await forja.projects.getBySlug('my-portfolio-project');

if (project) {
  console.log(project.localizations[0]?.description);
}
```

---

## Redirects

**Accessor:** `forja.redirects`

Methods for looking up URL redirects, useful in SSR middleware for handling moved or renamed content.

### `lookup(path)`

Check if a path has a redirect configured. Returns the redirect target if found.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | `string` | Yes | The URL path to check for redirects |

**Returns:** `RedirectResponse | null` -- returns `null` if no redirect is configured for the path.

```typescript
const redirect = await forja.redirects.lookup('/old-blog-post');

if (redirect) {
  console.log(redirect.target_path, redirect.status_code); // e.g. '/new-post', 301
}
```
