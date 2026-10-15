import type { DataTableV2Column } from './dataTableV2Types';

/** Fixed widths of the optional leading checkbox and trailing actions tracks. */
const SELECT_TRACK_PX = 40;
const ACTIONS_TRACK_PX = 56;
const COLUMN_GAP_PX = 12;
/** Width assumed for non-px (fr/minmax) columns when sizing the scroll floor. */
const FLEX_COLUMN_FLOOR_PX = 120;

interface TrackFlags {
  selectable: boolean;
  hasActions: boolean;
}

/** CSS `grid-template-columns` for the header, skeleton and data rows. */
export function gridTemplateColumns<T>(
  columns: readonly DataTableV2Column<T>[],
  { selectable, hasActions }: TrackFlags,
): string {
  return [
    selectable ? `${SELECT_TRACK_PX}px` : null,
    ...columns.map((c) => c.width || '1fr'),
    hasActions ? `${ACTIONS_TRACK_PX}px` : null,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Minimum grid width before the table scrolls horizontally. On narrow
 * viewports fixed-width columns would otherwise squeeze 1fr columns to zero.
 */
export function minGridWidth<T>(
  columns: readonly DataTableV2Column<T>[],
  { selectable, hasActions }: TrackFlags,
): number {
  const base =
    (selectable ? SELECT_TRACK_PX : 0) +
    (hasActions ? ACTIONS_TRACK_PX : 0) +
    COLUMN_GAP_PX * (columns.length - 1);
  return columns.reduce((sum, c) => {
    const w = c.width || `${FLEX_COLUMN_FLOOR_PX}px`;
    const n = w.endsWith('px') ? parseInt(w, 10) : FLEX_COLUMN_FLOOR_PX;
    return sum + n;
  }, base);
}

/** Header-checkbox state: every row selected, or some (indeterminate). */
export function headerSelectionState<T>(
  rows: readonly T[],
  selected: ReadonlySet<string> | undefined,
  getKey: (row: T) => string,
): { allChecked: boolean; someChecked: boolean } {
  if (!selected) return { allChecked: false, someChecked: false };
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(getKey(r)));
  const someChecked = !allChecked && rows.some((r) => selected.has(getKey(r)));
  return { allChecked, someChecked };
}

/** `aria-sort` value for a column's sort indicator. */
export function ariaSortFor(sorted: DataTableV2Column<unknown>['sorted']) {
  if (sorted === 'asc') return 'ascending';
  if (sorted === 'desc') return 'descending';
  return undefined;
}
