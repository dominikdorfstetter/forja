# OpenYapper Admin Dashboard

React-based admin interface for managing OpenYapper CMS content.

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: Material UI (MUI) v5
- **Data Fetching**: React Query (TanStack Query)
- **Forms**: react-hook-form + zod validation
- **Auth**: Clerk (@clerk/clerk-react)
- **i18n**: i18next with 8 locales (en, de, fr, es, it, pt, nl, pl)
- **Routing**: React Router v6

## Features

- Multi-site content management (blogs, pages, CV entries, legal docs)
- Media library with image variants and upload
- Navigation menu builder with drag-and-drop
- Webhook management with delivery logs
- API key management with usage tracking
- Taxonomy (categories and tags)
- Content templates
- Editorial workflow (draft/review/publish)
- Audit logging and change history
- Site settings and feature toggles
- Command palette (Cmd+K) for quick navigation
- Site preview integration with template dev servers

## Quick Start

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173` and proxies API requests to `http://localhost:8000`.

No `.env` file is needed for development — the admin fetches its Clerk configuration from the backend at runtime via `GET /api/v1/config`.

## Production Build

```bash
npm run build
```

This outputs static files to `../backend/static/dashboard/`, which are served by the backend at `/dashboard`.

## Project Structure

```
admin/
├── src/
│   ├── App.tsx              # Router and providers
│   ├── main.tsx             # Entry point
│   ├── components/          # Shared UI components
│   │   ├── Layout.tsx       # Main layout with sidebar
│   │   └── shared/          # Reusable components
│   ├── pages/               # Route pages
│   │   ├── Settings.tsx     # Site settings
│   │   ├── Blogs.tsx        # Blog list
│   │   ├── blog-detail/     # Blog editor (tabs)
│   │   ├── Pages.tsx        # Page list
│   │   ├── page-detail/     # Page editor (tabs)
│   │   ├── Media.tsx        # Media library
│   │   ├── Navigation.tsx   # Menu builder
│   │   ├── Legal.tsx        # Legal documents
│   │   ├── CV.tsx           # CV entries
│   │   ├── Taxonomy.tsx     # Tags & categories
│   │   └── ...
│   ├── services/
│   │   └── api.ts           # Axios API client
│   ├── types/
│   │   └── api.ts           # TypeScript types (mirrors backend DTOs)
│   ├── hooks/               # Custom React hooks
│   ├── i18n/
│   │   └── locales/         # Translation files (8 languages)
│   ├── store/               # Context providers
│   ├── theme/               # MUI theme configuration
│   └── utils/               # Utility functions
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Development

```bash
npm run dev          # Start dev server with HMR
npm run build        # Production build
npm run typecheck    # TypeScript type check (tsc --noEmit)
npm run preview      # Preview production build locally
```

## API Integration

The admin communicates with the backend REST API at `/api/v1`. The Vite dev server proxies all `/api` requests to `http://localhost:8000`.

Authentication is handled by Clerk — the admin fetches the Clerk publishable key from `GET /api/v1/config` on startup, then attaches JWT tokens to all API requests via the `Authorization: Bearer` header.

For API key-only testing (no Clerk), you can use browser dev tools or tools like Postman with the `X-API-Key` header.
