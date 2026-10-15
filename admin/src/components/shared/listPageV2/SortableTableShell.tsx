import type { ComponentProps, ReactNode } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import {
  DndContext,
  closestCenter,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DragPreviewCard } from './SortableTableParts';
import { sortableContentTableSx } from './sortableTableSx';
import { useReorderSensors } from './sortableHooks';
import { useTableDensity } from './useTableDensity';

export interface SortableTableShellProps {
  /** Row ids in display order. */
  itemIds: string[];
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  /** Writers get the leading drag-handle column. */
  canWrite: boolean;
  /** Header cells after the drag-handle column. */
  headCells: ReactNode;
  /** Label of the row being dragged; `null`/`undefined` while nothing is dragged. */
  dragPreview?: ReactNode;
  /** Defaults to the shared pointer sensor (`useReorderSensors`). */
  sensors?: ComponentProps<typeof DndContext>['sensors'];
  'data-testid'?: string;
  /** The sortable rows. */
  children: ReactNode;
}

/**
 * Drag-to-reorder table chrome: dnd-kit context, density-aware M3 table,
 * header row with the drag-handle column, and the floating drag preview.
 */
export function SortableTableShell({
  itemIds,
  onDragStart,
  onDragEnd,
  canWrite,
  headCells,
  dragPreview,
  sensors,
  'data-testid': testId,
  children,
}: SortableTableShellProps) {
  const { size, rowHeight } = useTableDensity();
  const defaultSensors = useReorderSensors();

  return (
    <DndContext sensors={sensors ?? defaultSensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <TableContainer data-testid={testId} data-density={size === 'small' ? 'compact' : 'comfortable'} sx={sortableContentTableSx(rowHeight)}>
        <Table size={size}>
          <TableHead>
            <TableRow>
              {canWrite && <TableCell scope="col" sx={{ width: 48, px: 1 }} />}
              {headCells}
            </TableRow>
          </TableHead>
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <TableBody>{children}</TableBody>
          </SortableContext>
        </Table>
      </TableContainer>
      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
        {dragPreview == null ? null : <DragPreviewCard>{dragPreview}</DragPreviewCard>}
      </DragOverlay>
    </DndContext>
  );
}
