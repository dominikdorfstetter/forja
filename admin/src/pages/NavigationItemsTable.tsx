import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  DndContext,
  closestCenter,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type SensorDescriptor,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import type { NavigationItem } from '@/types/api';
import type { FlatItem } from '@/pages/NavigationReducer';
import SortableNavigationRow from '@/components/navigation/SortableNavigationRow';
import { useTableDensity } from '@/components/shared/listPageV2';

interface NavigationItemsTableProps {
  flattenedItems: FlatItem[];
  orderedItems: NavigationItem[];
  activeId: string | null;
  expandedIds: Set<string>;
  totalLocales: number;
  pageRouteMap: Map<string, string>;
  canWrite: boolean;
  isAdmin: boolean;
  sensors: SensorDescriptor<object>[];
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onEdit: (item: NavigationItem) => void;
  onDelete: (item: NavigationItem) => void;
  onToggleExpand: (id: string) => void;
}

const headCellSx = {
  color: 'var(--on-surface-variant)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: 'uppercase' as const,
  borderBottom: '1px solid var(--outline-variant)',
  fontVariationSettings: '"wght" 600, "opsz" 11',
  bgcolor: 'transparent',
  height: 44,
  py: 0,
};

export default function NavigationItemsTable({
  flattenedItems,
  orderedItems,
  activeId,
  expandedIds,
  totalLocales,
  pageRouteMap,
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
  const { size, rowHeight } = useTableDensity();
  const activeItem = activeId ? orderedItems.find((i) => i.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <TableContainer
        data-testid="nav-items-table"
        data-density={size === 'small' ? 'compact' : 'comfortable'}
        sx={{
          bgcolor: 'var(--surface-container-low)',
          border: '1px solid var(--outline-variant)',
          borderRadius: '20px',
          overflow: 'hidden',
        }}
      >
        <Table
          size={size}
          sx={{
            '& td': {
              borderBottom: '1px solid var(--outline-variant)',
              color: 'var(--on-surface)',
              height: rowHeight,
            },
            '& tbody tr': {
              transition: 'background 160ms cubic-bezier(0.2, 0, 0, 1)',
              '&:hover': { bgcolor: 'var(--surface-container)' },
            },
            '& tbody tr:last-of-type td': { borderBottom: 'none' },
          }}
        >
          <TableHead>
            <TableRow>
              {canWrite && <TableCell scope="col" sx={{ ...headCellSx, width: 48, px: 1 }} />}
              <TableCell scope="col" sx={headCellSx}>{t('navigation.table.title', 'Title')}</TableCell>
              <TableCell scope="col" sx={headCellSx}>{t('navigation.table.link')}</TableCell>
              <TableCell scope="col" sx={headCellSx}>{t('navigation.table.type')}</TableCell>
              {totalLocales > 0 && (
                <TableCell scope="col" sx={headCellSx}>{t('navigation.table.languages', 'Languages')}</TableCell>
              )}
              <TableCell scope="col" align="right" sx={headCellSx}>{t('navigation.table.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <SortableContext items={flattenedItems.map(({ item }) => item.id)} strategy={verticalListSortingStrategy}>
            <TableBody>
              {flattenedItems.map((flatItem) => (
                <SortableNavigationRow
                  key={flatItem.item.id}
                  flatItem={flatItem}
                  isExpanded={expandedIds.has(flatItem.item.id)}
                  totalLocales={totalLocales}
                  pageRouteMap={pageRouteMap}
                  canWrite={canWrite}
                  isAdmin={isAdmin}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleExpand={onToggleExpand}
                />
              ))}
            </TableBody>
          </SortableContext>
        </Table>
      </TableContainer>
      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
        {activeItem ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 1,
              borderRadius: '14px',
              bgcolor: 'var(--surface-container-highest)',
              border: '1px solid var(--primary)',
              boxShadow: '0 12px 24px -6px rgb(0 0 0 / 0.45)',
              pointerEvents: 'none',
              color: 'var(--on-surface)',
            }}
          >
            <DragIndicatorIcon fontSize="small" sx={{ color: 'var(--primary)' }} />
            <Typography
              variant="body2"
              noWrap
              sx={{ fontWeight: 600, fontVariationSettings: '"wght" 600, "opsz" 14' }}
            >
              {activeItem.title || activeItem.page_id || activeItem.external_url || '\u2014'}
            </Typography>
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
