import { useContext } from 'react';
import { ThemeModeContext } from '@/theme/ThemeContext';
import type { DataTableV2Props } from './dataTableV2Types';
import { gridTemplateColumns, headerSelectionState, minGridWidth } from './dataTableV2Layout';
import { DataTableBody, DataTableHeader } from './DataTableV2Parts';

export type { DataTableV2Column, DataTableV2Props } from './dataTableV2Types';

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
  // Tolerate a missing ThemeModeProvider so the table works in lightweight
  // test harnesses that don't wrap with providers. The attribute on <html>
  // remains authoritative when a provider IS present because it re-renders
  // on density change.
  const themeCtx = useContext(ThemeModeContext);
  const density = themeCtx?.density ?? 'comfortable';
  const rowH = density === 'compact' ? 40 : 52;

  const selection = selected && onToggleSelect ? { selected, onToggle: onToggleSelect } : undefined;
  const tracks = { selectable: !!selection, hasActions: !!renderActions };
  const gridCols = gridTemplateColumns(columns, tracks);
  const { allChecked, someChecked } = headerSelectionState(rows, selection?.selected, getKey);

  // On narrow viewports fixed-width columns would squeeze 1fr columns to zero
  // and overflow: hidden silently clipped them. `overflow-x: auto` on an
  // inner wrapper preserves the rounded chrome on the outer card while
  // letting the grid scroll horizontally when it truly doesn't fit.
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
        <div style={{ minWidth: minGridWidth(columns, tracks) }}>
          <DataTableHeader
            columns={columns}
            gridCols={gridCols}
            selectable={tracks.selectable}
            allChecked={allChecked}
            someChecked={someChecked}
            onToggleAll={onToggleAll}
            onSort={onSort}
            hasActions={tracks.hasActions}
          />
          <DataTableBody
            rows={rows}
            getKey={getKey}
            columns={columns}
            gridCols={gridCols}
            rowH={rowH}
            tracks={tracks}
            selection={selection}
            onRowClick={onRowClick}
            renderActions={renderActions}
            emptyMessage={emptyMessage}
            loadingRows={loadingRows}
          />
        </div>
      </div>
    </div>
  );
}
