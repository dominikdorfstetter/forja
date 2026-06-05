# admin/src/components — Reusable UI

Shared, reusable components and the in-house design system. Feature-specific
component groups live in subfolders (e.g. `blogs/`, `media/`, `command-palette/`,
`editor/`, `layout/`, `dashboard/`).

## Key building blocks

- `design-system/` — `M3Button`, `M3IconButton`, etc. (Material 3 expressive).
- `listPageV2/` — `PageHeader`, `DataTableV2`, `FilterSelect` for list pages.
- `EmptyState` / `LoadingState` — standard async-state UI.
- `editor/` — the Tiptap block editor (Markdown storage; custom commands in
  `editor/types.ts`).

## Conventions

- Compose the design system + `listPageV2`, not raw MUI, in page bodies.
- **MUI v9**: layout props (`alignItems`, `justifyContent`, `flexWrap`) go in `sx`,
  not as direct props. TextField test ids via `slotProps={{ htmlInput: {...} }}`.
- Add `data-testid` for e2e; Tooltip uses `aria-label`, so query by label in tests.
- All user-facing text via `react-i18next` — no hardcoded strings.
- Watch file size (>~250 lines is a split signal); one clear responsibility per file.
