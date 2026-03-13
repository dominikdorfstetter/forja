import {
  Paper,
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
import SortableNavigationRow from '@/components/navigation/SortableNavigationRow';

interface NavigationItemsTableProps {
  flattenedItems: { item: NavigationItem; depth: number }[];
  orderedItems: NavigationItem[];
  activeId: string | null;
  canWrite: boolean;
  isAdmin: boolean;
  sensors: SensorDescriptor<object>[];
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onEdit: (item: NavigationItem) => void;
  onDelete: (item: NavigationItem) => void;
}

export default function NavigationItemsTable({
  flattenedItems,
  orderedItems,
  activeId,
  canWrite,
  isAdmin,
  sensors,
  onDragStart,
  onDragEnd,
  onEdit,
  onDelete,
}: NavigationItemsTableProps) {
  const { t } = useTranslation();
  const activeItem = activeId ? orderedItems.find((i) => i.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {canWrite && <TableCell scope="col" sx={{ width: 48, px: 1 }} />}
              <TableCell scope="col">{t('navigation.table.title', 'Title')}</TableCell>
              <TableCell scope="col">{t('navigation.table.link')}</TableCell>
              <TableCell scope="col">{t('navigation.table.type')}</TableCell>
              <TableCell scope="col">{t('navigation.table.icon')}</TableCell>
              <TableCell scope="col">{t('navigation.table.newTab')}</TableCell>
              <TableCell scope="col" align="right">{t('navigation.table.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <SortableContext items={flattenedItems.map(({ item }) => item.id)} strategy={verticalListSortingStrategy}>
            <TableBody>
              {flattenedItems.map(({ item, depth }) => (
                <SortableNavigationRow
                  key={item.id}
                  item={item}
                  depth={depth}
                  canWrite={canWrite}
                  isAdmin={isAdmin}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </TableBody>
          </SortableContext>
        </Table>
      </TableContainer>
      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
        {activeItem ? (
          <Paper
            elevation={12}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 1,
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'primary.main',
              pointerEvents: 'none',
            }}
          >
            <DragIndicatorIcon fontSize="small" color="primary" />
            <Typography variant="body2" fontWeight={500} noWrap>
              {activeItem.title || activeItem.page_id || activeItem.external_url || '\u2014'}
            </Typography>
          </Paper>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
