---
title: Admin Dashboard
sidebar_position: 3
description: React-based admin dashboard architecture and key patterns.
---

# Admin Dashboard

The Forja admin dashboard is a React single-page application built with Vite. It is served by the backend at `/dashboard` and communicates with the API on the same origin. User authentication is handled by Clerk.

## Tech Stack

| Library | Purpose |
|---------|---------|
| React 19 | UI framework |
| Vite 8 | Build tool and dev server |
| MUI v7 (Material UI) | Component library and theming |
| React Query (@tanstack/react-query) | Server state management and caching |
| react-hook-form + zod | Form state management and validation |
| Clerk (@clerk/clerk-react) | Authentication (sign-in, sign-up, session management) |
| React Router v7 | Client-side routing |
| axios | HTTP client for API calls |
| notistack | Toast notifications |
| react-i18next | Internationalization |

## Directory Structure

```
admin/src/
├── main.tsx             # Entry point, ClerkProvider setup
├── App.tsx              # BrowserRouter, route definitions, providers
├── components/
│   ├── Layout/          # Shell layout (sidebar, topbar, content area)
│   ├── auth/            # RequireAuth guard component
│   ├── shared/          # Reusable components (ErrorBoundary, dialogs, etc.)
│   ├── blogs/           # Blog-specific components
│   ├── pages/           # Page-specific components
│   ├── media/           # Media library components
│   └── ...              # Domain-specific component folders
├── pages/
│   ├── Login.tsx
│   ├── DashboardHome.tsx
│   ├── Sites.tsx
│   ├── Blogs.tsx
│   ├── BlogDetail.tsx
│   ├── Pages.tsx
│   ├── PageDetail.tsx
│   ├── Media.tsx
│   ├── Navigation.tsx
│   ├── Legal.tsx
│   ├── Portfolio.tsx
│   ├── ApiKeys.tsx
│   ├── Webhooks.tsx
│   ├── Redirects.tsx
│   ├── Members.tsx
│   ├── Settings.tsx
│   └── ...              # One file per route
├── services/
│   └── api.ts           # Axios instance + API service functions
├── types/
│   └── api.ts           # TypeScript interfaces mirroring backend DTOs
├── store/
│   ├── SiteContext.tsx   # Active site selection context
│   ├── AuthContext.tsx   # Auth state context
│   └── NavigationGuardContext.tsx  # Unsaved changes guard
├── hooks/               # Custom React hooks
├── i18n/                # Translation files and i18next config
├── theme/               # MUI theme configuration (light/dark mode)
├── data/                # Static data, constants
├── utils/               # Utility functions
└── test/                # Test utilities
```

## Routing

The app uses `BrowserRouter` with a `/dashboard` basename. All routes are nested under a `RequireAuth` wrapper that redirects unauthenticated users to the login page.

```
/dashboard/login         -> Login page (Clerk SignIn)
/dashboard/sign-up       -> Sign-up page (Clerk SignUp)
/dashboard/dashboard     -> Home / overview
/dashboard/sites         -> Site list
/dashboard/sites/:id     -> Site detail
/dashboard/blogs         -> Blog list
/dashboard/blogs/:id     -> Blog editor
/dashboard/pages         -> Page list
/dashboard/pages/:id     -> Page editor
/dashboard/media         -> Media library
/dashboard/navigation    -> Navigation menu builder
/dashboard/legal         -> Legal documents
/dashboard/portfolio     -> Portfolio (experience entries, skills, projects)
/dashboard/members       -> Site member management
/dashboard/api-keys      -> API key management
/dashboard/taxonomy      -> Tags and categories
/dashboard/webhooks      -> Webhook configuration
/dashboard/redirects     -> URL redirect rules
/dashboard/settings      -> Site settings
/dashboard/api-docs      -> Embedded Swagger UI
/dashboard/profile       -> User profile
/dashboard/activity      -> Audit log viewer
/dashboard/notifications -> In-app notifications
```

## Provider Hierarchy

The app wraps the route tree in several context providers:

```
ErrorBoundary
  ThemeModeProvider          (MUI light/dark theme)
    LocalizationProvider     (date-fns adapter for date pickers)
      SnackbarProvider       (notistack toasts)
        QueryClientProvider  (React Query cache)
          BrowserRouter
            AuthProvider     (Clerk auth state)
              SiteProvider   (active site selection)
                NavigationGuardProvider  (unsaved changes warning)
                  Routes
```

## API Communication

All API calls go through the axios instance in `services/api.ts`. The admin is served from the same origin as the backend (`/dashboard`), so API calls to `/api/v1/...` do not require CORS.

### React Query Patterns

Data fetching uses React Query with a 5-minute stale time:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
    },
  },
});
```

Typical query usage:

```typescript
const { data: blogs, isLoading } = useQuery({
  queryKey: ['blogs', siteId],
  queryFn: () => api.getBlogs(siteId),
});
```

Mutations invalidate relevant query keys to trigger refetches:

```typescript
const mutation = useMutation({
  mutationFn: (data) => api.createBlog(siteId, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['blogs', siteId] });
  },
});
```

### Type Safety

TypeScript interfaces in `types/api.ts` mirror the backend DTOs. This ensures type safety from the API response through to the UI components.

## Forms

Forms use `react-hook-form` for state management and `zod` for schema validation:

```typescript
const schema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  locale: z.string(),
});

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
});
```

## Authentication Flow

1. User navigates to `/dashboard`.
2. `RequireAuth` component checks Clerk session.
3. If unauthenticated, user is redirected to `/dashboard/login`.
4. Clerk handles sign-in (including social/SSO providers).
5. On success, the Clerk session token is attached to API requests as `Authorization: Bearer <JWT>`.
6. The backend validates the JWT against Clerk's JWKS.

## Site Context

The admin supports managing multiple sites. The `SiteProvider` tracks the currently selected site and persists the selection. Most API calls and UI state are scoped to the active site.

## Theming

The `ThemeModeProvider` supports light and dark modes via MUI's theming system. The user's preference is persisted in local storage.

## List page architecture

The admin has two layers of shared building blocks for list-style pages. Choosing between them is a deliberate architectural decision, not a preference.

### `listPageV2/` — primitives (default)

`admin/src/components/shared/listPageV2/` is a set of small, composable primitives: `PageHeader`, `Toolbar`, `SearchField`, `FilterSelect`, `DataTableV2`, `Pagination`, `RowActionBtn`, `ActionMenu`. Each is unopinionated about what it renders, and pages assemble them as needed. This is the default for any new list page.

Pagination, search, sort, and basic dialog state for these pages comes from the `useListPageState` hook (`admin/src/hooks/useListPageState.ts`). CRUD mutations come from `useCrudMutations`, bulk selection from `useBulkSelection`.

**When to use**: any list-style page in the admin. Approximately 25 pages currently use these primitives, including `Legal`, `Portfolio`, `Media`, `Members`, `Webhooks`, `Redirects`, `Taxonomy`, `ApiKeys`, `Notifications`, `ActivityLog`, `TrashPage`, `Forms`, `FormTemplates`, `FormSubmissions`, `ClerkUsers`, `ContentTemplates`, `MyDrafts`.

### `EntityListPage` — content-entity composable

`admin/src/components/shared/entityListPage/EntityListPage.tsx` is a higher-level composable built on top of the `listPageV2` primitives. It is **not** a general list composable — it is hard-wired to:

- A content entity with a `ContentStatus` workflow (Draft / Review / Published / Archived).
- A two-tab UI: `active` vs. `archived`.
- A `BulkContentRequest` shape for bulk publish / archive / restore actions.

**When to use**: only for content entities that fit this exact shape. Currently used by `Blogs.tsx` and `Pages.tsx`.

### `ContentDetailPage` — content-entity detail composable

`admin/src/components/shared/contentDetailPage/ContentDetailPage.tsx` is the matching detail-page composable for the same content-entity model. Pages provide a `ContentDetailAdapter` describing how to fetch / save / review / preview the entity and its localizations. Compound fetches (entity + localizations + nested sections) belong **inside** the adapter's `fetchDetail`, not wrapped around the composable.

**When to use**: content-entity detail pages that map cleanly onto the adapter contract. Currently used by `BlogDetail` and `PageDetailPage`.

### Why not port every list page to `EntityListPage`?

Several list pages have structural constraints that make `EntityListPage` the wrong shape:

| Page | Why `listPageV2` primitives, not `EntityListPage` |
|---|---|
| `Sites.tsx` | Card grid (`SiteCard`), not a row list. No `ContentStatus`. The tenancy widget is a card with bespoke actions, not a table row. |
| `Documents.tsx` | Composite layout: folder-tree sidebar (`DocumentFolderSidebar`) plus content area (`DocumentContentArea`). Documents have folder hierarchy, not a content-status workflow. |
| `Legal.tsx` | Legal documents have status, but the workflow is `Draft → Published → Unpublished → Archived` with version semantics that differ from the generic content workflow. The remaining reducer (`LegalDocumentsReducer.ts`) holds domain workflow dialog state (publish / unpublish / archive / bulk-*), not generic UI state — generic state already comes from `useListPageState`. |
| `Forms.tsx` / `FormTemplates.tsx` | Forms are a sibling content model with their own status set. The pages opted for a "lean alternative" to `EntityListPage` to avoid forcing the form workflow into the content-status mold. |

The general rule: **`EntityListPage` is content-status-shaped. Use it when your entity is, and use the primitives otherwise.** Domain workflow state (publish dialogs, archive confirmations, bespoke action toolbars) lives in the page; generic UI state (page, page size, search, sort, modal open/close) comes from `useListPageState`.

