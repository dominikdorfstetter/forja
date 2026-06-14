import { useContext, useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/design-system';
import { ThemeModeContext } from '@/theme/ThemeContext';

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

/**
 * Grid-based DataTable v2. Density-aware row height (driven by the
 * --density CSS var via the ThemeMode context), indeterminate "all"
 * checkbox, optional selection + actions columns, column sort indicators.
 *
 * Visually matches the Forja Redesign table pattern: 44px uppercase header,
 * hover + selected backgrounds via surface-container tokens, pill-ish 20px
 * outer radius on the card.
 */
export function DataTableV2<T>({
  columns,
  rows,
  getKey,
  selected,
  onToggleSelect,
  onToggleAll,
  onRowClick,
  renderActions,
  onSort,
  emptyMessage,
  loadingRows,
  ...rest
}: DataTableV2Props<T>) {
  const { t } = useTranslation();
  // Tolerate a missing ThemeModeProvider so the table works in lightweight
  // test harnesses that don't wrap with providers. The attribute on <html>
  // remains authoritative when a provider IS present because it re-renders
  // on density change.
  const themeCtx = useContext(ThemeModeContext);
  const density = themeCtx?.density ?? 'comfortable';
  const selectable = !!selected && !!onToggleSelect;
  const rowH = density === 'compact' ? 40 : 52;

  const gridCols = [
    selectable ? '40px' : null,
    ...columns.map((c) => c.width || '1fr'),
    renderActions ? '56px' : null,
  ]
    .filter(Boolean)
    .join(' ');

  const allChecked = selectable && rows.length > 0 && rows.every((r) => selected!.has(getKey(r)));
  const someChecked =
    selectable && rows.some((r) => selected!.has(getKey(r))) && !allChecked;

  const headerCheckRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (headerCheckRef.current) {
      headerCheckRef.current.indeterminate = !!someChecked;
    }
  }, [someChecked]);

  // On narrow viewports fixed-width columns would squeeze 1fr columns to zero
  // and overflow: hidden silently clipped them. `overflow-x: auto` on an
  // inner wrapper preserves the rounded chrome on the outer card while
  // letting the grid scroll horizontally when it truly doesn't fit.
  const minGridWidth = columns.reduce((sum, c) => {
    const w = c.width || '120px';
    const n = typeof w === 'string' && w.endsWith('px') ? parseInt(w, 10) : 120;
    return sum + n;
  }, (selectable ? 40 : 0) + (renderActions ? 56 : 0) + 12 * (columns.length - 1));

  return (
    <div
      role="table"
      data-testid={rest['data-testid']}
      style={{
        background: 'var(--surface-container-low)',
        border: '1px solid var(--outline-variant)',
        borderRadius: 20,
        overflow: 'hidden',
      }}
    >
     <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: minGridWidth }}>
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
            checked={!!allChecked}
            onChange={() => onToggleAll?.(!allChecked)}
            aria-label={t('listPage.selectAll', 'Select all rows')}
            style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
          />
        )}
        {columns.map((c) => {
          const sortable = !!onSort;
          return (
            <div
              key={c.key}
              role="columnheader"
              aria-sort={
                c.sorted === 'asc' ? 'ascending' : c.sorted === 'desc' ? 'descending' : undefined
              }
              tabIndex={sortable ? 0 : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                justifyContent: c.align === 'right' ? 'flex-end' : 'flex-start',
                cursor: sortable ? 'pointer' : 'default',
                userSelect: 'none',
              }}
              onClick={sortable ? () => onSort(c.key) : undefined}
              onKeyDown={
                sortable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSort(c.key);
                      }
                    }
                  : undefined
              }
            >
              {c.label}
              {c.sorted === 'desc' && <Icon name="arrow_downward" size={12} />}
              {c.sorted === 'asc' && <Icon name="arrow_upward" size={12} />}
            </div>
          );
        })}
        {renderActions && (
          <div style={{ textAlign: 'right' }}>{t('listPage.actions.label', 'Actions')}</div>
        )}
      </div>

      {rows.length === 0 && !loadingRows ? (
        <div
          style={{
            padding: '48px 20px',
            textAlign: 'center',
            color: 'var(--on-surface-variant)',
            fontSize: 13,
          }}
        >
          {emptyMessage || t('listPage.empty.default', 'Nothing here yet.')}
        </div>
      ) : loadingRows ? (
        Array.from({ length: loadingRows }).map((_, i) => (
          <div
            key={`skeleton-${i}`}
            style={{
              display: 'grid',
              gridTemplateColumns: gridCols,
              gap: 12,
              padding: '0 16px',
              minHeight: rowH,
              alignItems: 'center',
              borderBottom: i < loadingRows - 1 ? '1px solid var(--outline-variant)' : 'none',
            }}
          >
            {(selectable ? [null] : []).concat(columns.map(() => null), renderActions ? [null] : []).map((_, j) => (
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
        ))
      ) : (
        rows.map((row, i) => {
          const key = getKey(row);
          const isSelected = !!(selectable && selected!.has(key));
          return (
            <div
              key={key}
              role="row"
              aria-selected={selectable ? isSelected : undefined}
              onClick={() => onRowClick?.(row)}
              onKeyDown={(e) => {
                if (!onRowClick) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onRowClick(row);
                }
              }}
              tabIndex={onRowClick ? 0 : undefined}
              style={{
                display: 'grid',
                gridTemplateColumns: gridCols,
                alignItems: 'center',
                gap: 12,
                padding: '0 16px',
                minHeight: rowH,
                borderBottom: i < rows.length - 1 ? '1px solid var(--outline-variant)' : 'none',
                background: isSelected ? 'var(--surface-container)' : 'transparent',
                cursor: onRowClick ? 'pointer' : 'default',
                transition: 'background 120ms',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = 'var(--surface-container)';
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.background = 'transparent';
              }}
            >
              {selectable && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleSelect!(key);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={t('listPage.selectRow', 'Select row')}
                  style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
              )}
              {columns.map((c) => {
                const rawValue = c.render
                  ? c.render(row)
                  : ((row as unknown as Record<string, ReactNode>)[c.key] ?? null);
                return (
                  <div
                    key={c.key}
                    role="cell"
                    style={{
                      minWidth: 0,
                      fontSize: c.muted ? 13 : 14,
                      color: c.muted ? 'var(--on-surface-variant)' : 'var(--on-surface)',
                      textAlign: c.align === 'right' ? 'right' : 'left',
                      // multiline cells grow the row instead of clipping; the
                      // default stays tidy single-line ellipsis.
                      ...(c.multiline
                        ? { whiteSpace: 'normal', paddingTop: 6, paddingBottom: 6 }
                        : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
                    }}
                  >
                    {rawValue}
                  </div>
                );
              })}
              {renderActions && (
                <RowActionsCell row={row} rowActions={renderActions} />
              )}
            </div>
          );
        })
      )}
      </div>
     </div>
    </div>
  );
}
