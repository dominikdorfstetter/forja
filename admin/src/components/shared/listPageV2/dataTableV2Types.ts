import type { ReactNode } from 'react';

export interface DataTableV2Column<T> {
  /** Stable key used as React key and as sort key when sortable. */
  key: string;
  /** Column header text or node. */
  label: ReactNode;
  /** CSS grid width — e.g. "1fr", "140px", "minmax(120px, 1fr)". */
  width?: string;
  /** Alignment of header + cell. */
  align?: 'left' | 'right';
  /** Render a cell value. Defaults to `row[column.key]` if omitted and T is indexable. */
  render?: (row: T) => ReactNode;
  /** Sort direction indicator — drives arrow rendering only; logic is caller's. */
  sorted?: 'asc' | 'desc';
  /** Muted (secondary) text styling for this column. */
  muted?: boolean;
  /**
   * Opt out of the single-line contract: keep tall / multi-line content from
   * clipping by dropping `nowrap` + `overflow: hidden` and letting the cell
   * grow the row (e.g. an inline editor control, a two-line name+slug stack,
   * or a progress bar above a byte-count label). Pairs with the row's
   * `minHeight` so 40/52px stays the floor, not a hard ceiling.
   */
  multiline?: boolean;
}

export interface DataTableV2Props<T> {
  columns: DataTableV2Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
  selected?: ReadonlySet<string>;
  onToggleSelect?: (key: string) => void;
  onToggleAll?: (next: boolean) => void;
  onRowClick?: (row: T) => void;
  renderActions?: (row: T) => ReactNode;
  onSort?: (columnKey: string) => void;
  emptyMessage?: ReactNode;
  loadingRows?: number;
  'data-testid'?: string;
}
