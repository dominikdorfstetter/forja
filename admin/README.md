# Forja Admin Dashboard

React-based admin interface for managing Forja CMS content.

> Full documentation: **[dominikdorfstetter.github.io/forja](https://dominikdorfstetter.github.io/forja/)**

## Tech Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7 · Vitest
- **UI Library**: Material UI (MUI) v7
- **Editor**: Tiptap block editor with Markdown storage
- **Data Fetching**: TanStack Query (React Query)
- **Forms**: react-hook-form + zod validation
- **Auth**: Clerk (@clerk/clerk-react)
- **i18n**: i18next with 8 locales (en, de, fr, es, it, pt, nl, pl)
- **Routing**: React Router v7

## Features

- Multi-site content management (blogs, pages, CV entries, legal docs)
- Rich block editor with slash commands, tables, code highlighting, image picker
- Media library with image variants and upload
- Navigation menu builder with drag-and-drop
- AI Content Assist (drafts, SEO metadata, excerpts, translations)
- Federation dashboard (Fediverse quick posts, followers, comments, blocklist, activity log)
- Privacy-first analytics dashboard
- Webhook management with delivery logs
- API key management with usage tracking
- Taxonomy (categories and tags)
- Editorial workflow (draft/review/publish)
- Audit logging and change history
- Command palette (Cmd+K) for quick navigation
- Site preview integration with template dev servers

## Quick Start

```bash
npm install
npm run dev
```

Dev server: `http://localhost:5173` (proxies API to `http://localhost:8000`).

No `.env` file needed — the admin fetches Clerk configuration from the backend at runtime via `GET /api/v1/config`.

## Development

```bash
npm run dev              # Start dev server with HMR
npm run build            # Production build → ../backend/static/dashboard/
npm run typecheck        # TypeScript type check
npm run lint             # ESLint
npm test                 # Run tests (Vitest)
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

## API Integration

The admin communicates with the backend REST API at `/api/v1`. Authentication is handled by Clerk — JWT tokens are attached to all API requests via the `Authorization: Bearer` header.

See the [API reference](https://dominikdorfstetter.github.io/forja/api/) for endpoint details.
