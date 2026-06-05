# admin/src/hooks — Reusable hooks

Custom React hooks: data-fetching wrappers around TanStack Query (e.g.
`useDashboardData`, `useSiteContextData`), media URL resolution (`useMediaUrl`),
navigation guards, error snackbars, and other shared UI state.

## Conventions

- Extract a hook when the same data/state logic appears in more than one place —
  no duplication across pages.
- Query hooks key on `selectedSiteId` (most data is site-scoped) and set `enabled`
  appropriately so they don't fire without a site.
- Keep hooks focused and pure where possible; isolate side effects. >~150 lines is
  a split signal.
- `useRef<T>()` needs an explicit initial value under React 19 + strict TS
  (e.g. `useRef<T>(undefined)`).
