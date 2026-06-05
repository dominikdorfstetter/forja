# Forja Admin Dashboard

React-based admin interface for managing Forja CMS content.

> Full documentation: **[forja-docs.dorfstetter.at](https://forja-docs.dorfstetter.at)**

## Tech Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 8 · Vitest
- **UI Library**: Material UI (MUI) v9
- **Editor**: Tiptap block editor with Markdown storage
- **Data Fetching**: TanStack Query (React Query)
- **Forms**: react-hook-form + zod validation
- **Auth**: Clerk (@clerk/clerk-react)
- **i18n**: i18next with 11 languages (en, de, de-AT, fr, es, it, pt, nl, pl, uk, ar) including RTL
- **Routing**: React Router v7

## Features

- Multi-site content management (blogs, pages, portfolio with projects, legal docs)
- Rich block editor with slash commands, tables, code highlighting, image picker, Zen mode
- Media library with image variants, focal point, and upload
- Navigation wizard with page, blog, and legal pickers
- AI Content Assist (drafts, SEO metadata, excerpts, translations)
- Privacy-first analytics dashboard
- Webhook management with delivery logs, debounce, templates, and analytics
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

Dev server: `http://localhost:3000` (proxies API to `http://localhost:8000`).

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
npm run generate:openapi # Regenerate src/generated/api-types.ts from backend OpenAPI spec
```

## API Integration

The admin communicates with the backend REST API at `/api/v1`. Authentication is handled by Clerk — JWT tokens are attached to all API requests via the `Authorization: Bearer` header.

Request/response shapes are generated from the backend's OpenAPI document (utoipa) into `src/generated/api-types.ts` via `npm run generate:openapi`. Regenerate after pulling backend DTO changes; the checked-in file is the contract the admin compiles against. Hand-written Zod schemas remain for UX refinements (custom error messages, async checks) — the shape comes from the generated types.

See the [API reference](https://forja-docs.dorfstetter.at/api/overview) for endpoint details.

## Quality Gates

```bash
npm test                         # Vitest test suite
npm run typecheck                # TypeScript strict mode
npm run lint                     # ESLint
npm run react-doctor:online      # React Doctor (score must be 100)
```

## Accessibility

All components target WCAG 2.1 Level AA compliance. See the [Accessibility guide](https://forja-docs.dorfstetter.at/developer/accessibility) for standards.

## Internationalization

The dashboard ships in 11 languages. All user-visible strings use `react-i18next`. Locale files are in `src/i18n/locales/`. See the [Locales guide](https://forja-docs.dorfstetter.at/admin-guide/locales) for details.
