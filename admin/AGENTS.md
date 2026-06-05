# admin — Forja Admin Dashboard

React 19 SPA for managing Forja content. Vite build, MUI v9 (Material 3
"expressive"), TanStack Query for server state, react-hook-form + zod for forms,
Clerk for auth, i18next for 11 locales. Dev server `:3000` (proxies API to
`:8000`); production build outputs to `../backend/static/dashboard/`.

## Commands

```bash
npm run dev               # dev server with HMR (:3000)
npm run build             # production build → ../backend/static/dashboard/
npm run typecheck         # tsc (strict)
npm run lint              # ESLint
npm test                  # Vitest
npm run generate:openapi  # regenerate src/generated/api-types.ts from backend
npm run react-doctor:online  # health score (must be 100)
```

No `.env` — config is fetched from the backend at runtime (`GET /api/v1/config`).

## Layout

| Dir | Role |
|-----|------|
| [`src/components/`](src/components/AGENTS.md) | Reusable UI + the design system (`design-system`, `listPageV2`). |
| [`src/pages/`](src/pages/AGENTS.md) | Route-level pages (one folder per feature/content type). |
| [`src/hooks/`](src/hooks/AGENTS.md) | Reusable hooks (data, UI state). |
| [`src/services/`](src/services/AGENTS.md) | API client functions (one module per resource). |
| [`src/store/`](src/store/) | React contexts — `AuthContext`, `SiteContext`. |
| [`src/i18n/`](src/i18n/AGENTS.md) | i18next config + `locales/*.json` (11 locales). |
| `src/generated/` | `api-types.ts` — generated from backend OpenAPI; do not hand-edit. |
| `src/theme/` | MUI theme + Material 3 expressive tokens. |
| `src/types/` | Shared TS types. `src/utils/` | Pure helpers. `src/test/` | Vitest setup + helpers. |

## Conventions (MUI v9 + this codebase)

- **MUI v9**: `alignItems` / `justifyContent` / `flexWrap` are **not** direct props
  — put them in `sx`. TextField test ids go via `slotProps={{ htmlInput: {...} }}`.
- **New list pages** compose `listPageV2` (PageHeader / DataTableV2 / FilterSelect)
  + design-system (`M3Button`) + EmptyState/LoadingState — raw MUI in a page body
  is a smell.
- **Layout chrome**: `Layout.tsx` owns outer `maxWidth` + padding; pages must not
  add their own (it stacks).
- **i18n**: every user-facing string through `react-i18next`; backfill all 11
  locales. **Test IDs**: add `data-testid` for e2e.
- **Path alias**: `@/` → `admin/src/`.
- **Tests are the agent's eyes** — write/keep them green; `src/test/setup.ts`
  globally mocks Clerk, matchMedia, and the API.
