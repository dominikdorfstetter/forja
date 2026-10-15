import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/design-system';
import type { DataTableV2Column } from './dataTableV2Types';
import { ariaSortFor } from './dataTableV2Layout';

const checkboxStyle: CSSProperties = { accentColor: 'var(--primary)', cursor: 'pointer' };
const rowDivider = (isLast: boolean) => (isLast ? 'none' : '1px solid var(--outline-variant)');

/** Runs `action` on Enter / Space — the keyboard twin of a click. */
function onActivateKey(action: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };
}

function RowActionsCell<T>({
  row,
  rowActions,
}: {
  row: T;
  rowActions: (row: T) => ReactNode;
}) {
  return (
    <div
      role="cell"
      style={{ display: 'flex', justifyContent: 'flex-end', position: 'relative' }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {rowActions(row)}
    </div>
  );
}

function ColumnHeaderCell<T>({ column, onSort }: { column: DataTableV2Column<T>; onSort?: (key: string) => void }) {
  const sortable = !!onSort;
  return (
    <div
      role="columnheader"
      aria-sort={ariaSortFor(column.sorted)}
      tabIndex={sortable ? 0 : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        justifyContent: column.align === 'right' ? 'flex-end' : 'flex-start',
        cursor: sortable ? 'pointer' : 'default',
        userSelect: 'none',
      }}
      onClick={sortable ? () => onSort(column.key) : undefined}
      onKeyDown={sortable ? onActivateKey(() => onSort(column.key)) : undefined}
    >
      {column.label}
      {column.sorted === 'desc' && <Icon name="arrow_downward" size={12} />}
      {column.sorted === 'asc' && <Icon name="arrow_upward" size={12} />}
    </div>
  );
}

interface DataTableHeaderProps<T> {
  columns: DataTableV2Column<T>[];
  gridCols: string;
  selectable: boolean;
  allChecked: boolean;
  someChecked: boolean;
  onToggleAll?: (next: boolean) => void;
  onSort?: (columnKey: string) => void;
  hasActions: boolean;
}

/** 44px uppercase header row with the indeterminate "select all" checkbox. */
export function DataTableHeader<T>({
  columns,
  gridCols,
  selectable,
  allChecked,
  someChecked,
  onToggleAll,
  onSort,
  hasActions,
}: DataTableHeaderProps<T>) {
  const { t } = useTranslation();
  const headerCheckRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (headerCheckRef.current) {
      headerCheckRef.current.indeterminate = someChecked;
    }
  }, [someChecked]);

  return (
    <div
      role="row"
      style={{
        display: 'grid',
        gridTemplateColumns: gridCols,
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        height: 44,
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 1,
        color: 'var(--on-surface-variant)',
        borderBottom: '1px solid var(--outline-variant)',
      }}
    >
      {selectable && (
        <input
          ref={headerCheckRef}
          type="checkbox"
          checked={allChecked}
          onChange={() => onToggleAll?.(!allChecked)}
          aria-label={t('listPage.selectAll', 'Select all rows')}
          style={checkboxStyle}
        />
      )}
      {columns.map((c) => (
        <ColumnHeaderCell key={c.key} column={c} onSort={onSort} />
      ))}
      {hasActions && (
        <div style={{ textAlign: 'right' }}>{t('listPage.actions.label', 'Actions')}</div>
      )}
    </div>
  );
}

function DataTableEmpty({ message }: { message?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        padding: '48px 20px',
        textAlign: 'center',
        color: 'var(--on-surface-variant)',
        fontSize: 13,
      }}
    >
      {message || t('listPage.empty.default', 'Nothing here yet.')}
    </div>
  );
}

interface DataTableSkeletonProps {
  count: number;
  /** Placeholder cells per row (selection + columns + actions tracks). */
  cellCount: number;
  gridCols: string;
  rowH: number;
}

function DataTableSkeleton({ count, cellCount, gridCols, rowH }: DataTableSkeletonProps) {
  return Array.from({ length: count }).map((_, i) => (
    <div
      key={`skeleton-${i}`}
      style={{
        display: 'grid',
        gridTemplateColumns: gridCols,
        gap: 12,
        padding: '0 16px',
        minHeight: rowH,
        alignItems: 'center',
        borderBottom: rowDivider(i === count - 1),
      }}
    >
      {Array.from({ length: cellCount }).map((_, j) => (
        <div
          key={j}
          aria-hidden="true"
          style={{
            height: 12,
            borderRadius: 6,
            background: 'var(--surface-container-high)',
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  ));
}

function DataTableCell<T>({ column, row }: { column: DataTableV2Column<T>; row: T }) {
  const value = column.render
    ? column.render(row)
    : ((row as unknown as Record<string, ReactNode>)[column.key] ?? null);
  return (
    <div
      role="cell"
      style={{
        minWidth: 0,
        fontSize: column.muted ? 13 : 14,
        color: column.muted ? 'var(--on-surface-variant)' : 'var(--on-surface)',
        textAlign: column.align === 'right' ? 'right' : 'left',
        // multiline cells grow the row instead of clipping; the
        // default stays tidy single-line ellipsis.
        ...(column.multiline
          ? { whiteSpace: 'normal', paddingTop: 6, paddingBottom: 6 }
          : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
      }}
    >
      {value}
    </div>
  );
}

interface DataTableRowProps<T> {
  row: T;
  rowKey: string;
  columns: DataTableV2Column<T>[];
  gridCols: string;
  rowH: number;
  isLast: boolean;
  /** Present only when the table is selectable. */
  selection?: { isSelected: boolean; onToggle: (key: string) => void };
  onRowClick?: (row: T) => void;
  renderActions?: (row: T) => ReactNode;
}

function DataTableRow<T>({
  row,
  rowKey,
  columns,
  gridCols,
  rowH,
  isLast,
  selection,
  onRowClick,
  renderActions,
}: DataTableRowProps<T>) {
  const { t } = useTranslation();
  const isSelected = !!selection?.isSelected;
  const clickable = !!onRowClick;
  return (
    <div
      role="row"
      aria-selected={selection ? isSelected : undefined}
      onClick={() => onRowClick?.(row)}
      onKeyDown={(e) => {
        if (!onRowClick) return;
        onActivateKey(() => onRowClick(row))(e);
      }}
      tabIndex={clickable ? 0 : undefined}
      style={{
        display: 'grid',
        gridTemplateColumns: gridCols,
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        minHeight: rowH,
        borderBottom: rowDivider(isLast),
        background: isSelected ? 'var(--surface-container)' : 'transparent',
        cursor: clickable ? 'pointer' : 'default',
        transition: 'background 120ms',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'var(--surface-container)';
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'transparent';
      }}
    >
      {selection && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            selection.onToggle(rowKey);
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={t('listPage.selectRow', 'Select row')}
          style={checkboxStyle}
        />
      )}
      {columns.map((c) => (
        <DataTableCell key={c.key} column={c} row={row} />
      ))}
      {renderActions && <RowActionsCell row={row} rowActions={renderActions} />}
    </div>
  );
}

interface DataTableBodyProps<T> {
  rows: T[];
  getKey: (row: T) => string;
  columns: DataTableV2Column<T>[];
  gridCols: string;
  rowH: number;
  tracks: { selectable: boolean; hasActions: boolean };
  selection?: { selected: ReadonlySet<string>; onToggle: (key: string) => void };
  onRowClick?: (row: T) => void;
  renderActions?: (row: T) => ReactNode;
  emptyMessage?: ReactNode;
  loadingRows?: number;
}

/** Empty message, loading skeleton, or the data rows — in that precedence. */
export function DataTableBody<T>({
  rows,
  getKey,
  columns,
  gridCols,
  rowH,
  tracks,
  selection,
  onRowClick,
  renderActions,
  emptyMessage,
  loadingRows,
}: DataTableBodyProps<T>) {
  if (rows.length === 0 && !loadingRows) return <DataTableEmpty message={emptyMessage} />;
  if (loadingRows) {
    const cellCount = Number(tracks.selectable) + columns.length + Number(tracks.hasActions);
    return <DataTableSkeleton count={loadingRows} cellCount={cellCount} gridCols={gridCols} rowH={rowH} />;
  }
  return rows.map((row, i) => {
    const key = getKey(row);
    return (
      <DataTableRow
        key={key}
        row={row}
        rowKey={key}
        columns={columns}
        gridCols={gridCols}
        rowH={rowH}
        isLast={i === rows.length - 1}
        selection={selection && { isSelected: selection.selected.has(key), onToggle: selection.onToggle }}
        onRowClick={onRowClick}
        renderActions={renderActions}
      />
    );
  });
}
