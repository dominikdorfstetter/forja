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

## Read-only / write-permission seam (`useReadOnly`)

`useReadOnly()` is the **canonical** way a component reflects the current user's
write permission — prefer it over reading `useAuth().canWrite` directly so write
affordances express intent at the use site (#6). It returns:

- `readOnly` / `canWrite` — booleans.
- `disabledProps` — spread onto an MUI control: `<Button {...disabledProps} />`.
- `gate(handler)` — returns the handler when writable, `undefined` otherwise.
  MUI hides/no-ops `onDelete`/`onChange`/`onClick` when they're `undefined`:
  `<Chip onDelete={gate(() => remove(id))} />`.

Defence is double-belt — UI gating **and** API-side RBAC (403). UI patterns:
- Hide a write button: render behind `{canWrite && …}`, or give it a
  `btn.create` / `btn.add` / `btn.delete` / `btn.save` / `btn.submit` testid
  (Layout hides those under read-only) — or `disabled={!canWrite}`.
- Inline mutation triggers (`Chip onDelete`, `Autocomplete onChange`) **must** be
  gated; the `forja/require-read-only-gate` ESLint rule fails CI otherwise.
- dnd-kit drag handles: pass `disabled: readOnly` to `useDraggable`/`useSortable`
  and don't spread the listeners under read-only.

The viewer walk in `e2e/features/auth/read-only-mode.feature` asserts a viewer
reaches no write controls across the content pages.
