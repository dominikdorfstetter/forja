# admin/src/pages — Route-level pages

Top-level pages wired to routes — the dashboard (`DashboardHome` = "Your
workbench"), content lists/editors (Blogs, Pages, Legal, Portfolio, Forms,
Collections), Assets/Media, Navigation, Taxonomy, Site Settings, Trash, etc.
Larger editors get their own subfolder (e.g. `blog-detail/`, `page-detail/`).

## Conventions

- **Don't add outer `maxWidth`/padding** — `components/Layout.tsx` owns the page
  chrome; adding your own stacks it.
- List pages compose `listPageV2` + design-system; loading/empty/error states use
  the shared `LoadingState`/`EmptyState`.
- Pages are the composition layer: fetch via `hooks/`+`services/`, render via
  `components/`. Keep data-fetching, state, and rendering separated.
- Routes are site-scoped via `SiteContext`; most queries key on `selectedSiteId`.
- Sidebar entries are data-driven from `components/layout/navConfig.ts` — add a nav
  item there, not inline. (Note: Documents lives under Assets; Members/Webhooks/
  API keys live under Site Settings, not as standalone nav items.)
