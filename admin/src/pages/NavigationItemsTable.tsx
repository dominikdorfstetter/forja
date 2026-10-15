import { TableCell } from '@mui/material';
import type { DragStartEvent, DragEndEvent, SensorDescriptor } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import type { NavigationItem } from '@/types/api';
import type { FlatItem } from '@/pages/NavigationReducer';
import SortableNavigationRow from '@/components/navigation/SortableNavigationRow';
import { SortableTableShell } from '@/components/shared/listPageV2';

interface NavigationItemsTableProps {
  flattenedItems: FlatItem[];
  orderedItems: NavigationItem[];
  activeId: string | null;
  expandedIds: Set<string>;
  totalLocales: number;
  pageRouteMap: Map<string, string>;
  legalRouteMap: Map<string, string>;
  canWrite: boolean;
  isAdmin: boolean;
  sensors: SensorDescriptor<object>[];
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onEdit: (item: NavigationItem) => void;
  onDelete: (item: NavigationItem) => void;
  onToggleExpand: (id: string) => void;
}

export default function NavigationItemsTable({
  flattenedItems,
  orderedItems,
  activeId,
  expandedIds,
  totalLocales,
  pageRouteMap,
  legalRouteMap,
  canWrite,
  isAdmin,
  sensors,
  onDragStart,
  onDragEnd,
  onEdit,
  onDelete,
  onToggleExpand,
}: NavigationItemsTableProps) {
  const { t } = useTranslation();
  const activeItem = activeId ? orderedItems.find((i) => i.id === activeId) : null;

  return (
    <SortableTableShell
      data-testid="nav-items-table"
      itemIds={flattenedItems.map(({ item }) => item.id)}
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      canWrite={canWrite}
      dragPreview={activeItem ? activeItem.title || activeItem.page_id || activeItem.external_url || '\u2014' : undefined}
      headCells={
        <>
          <TableCell scope="col">{t('navigation.table.title', 'Title')}</TableCell>
          <TableCell scope="col">{t('navigation.table.link')}</TableCell>
          <TableCell scope="col">{t('navigation.table.type')}</TableCell>
          {totalLocales > 0 && (
            <TableCell scope="col">{t('navigation.table.languages', 'Languages')}</TableCell>
          )}
          <TableCell scope="col" align="right">{t('navigation.table.actions')}</TableCell>
        </>
      }
    >
      {flattenedItems.map((flatItem) => (
        <SortableNavigationRow
          key={flatItem.item.id}
          flatItem={flatItem}
          isExpanded={expandedIds.has(flatItem.item.id)}
          totalLocales={totalLocales}
          pageRouteMap={pageRouteMap}
          legalRouteMap={legalRouteMap}
          canWrite={canWrite}
          isAdmin={isAdmin}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </SortableTableShell>
  );
}
