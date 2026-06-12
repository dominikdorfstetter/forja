import { useState, useCallback, useRef } from 'react';
import {
  Alert,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import { Pagination, Toolbar, ToolbarSpacer, SearchField, FilterSelect } from '@/components/shared/listPageV2';
import WorkIcon from '@mui/icons-material/Work';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reorderCvEntries } from '@/services/cv';
import type { CvEntryResponse, CvEntryType, ReorderItem } from '@/types/api';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import SortableCvEntryRow from './SortableCvEntryRow';
import { queryKeys } from '@/lib/queryKeys';

const ENTRY_TYPES: CvEntryType[] = ['Work', 'Education', 'Volunteer', 'Certification', 'Project'];

interface PaginationMeta {
  total_items: number;
  page: number;
  page_size: number;
}

interface CvEntriesSectionProps {
  entries: CvEntryResponse[] | undefined;
  meta: PaginationMeta | undefined;
  loading: boolean;
  error: Error | null;
  page: number;
  rowsPerPage: number;
  canWrite: boolean;
  isAdmin: boolean;
  siteId: string;
  onPage: (page: number) => void;
  onPerPage: (pageSize: number) => void;
  onOpenCreate: () => void;
  onEdit: (entry: CvEntryResponse) => void;
  onDelete: (entry: CvEntryResponse) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (column: string) => void;
  entryTypeFilter: string;
  onEntryTypeFilterChange: (value: string) => void;
}

export default function CvEntriesSection({
  entries,
  meta,
  loading,
  error,
  page,
  rowsPerPage,
  canWrite,
  isAdmin,
  siteId,
  onPage,
  onPerPage,
  onOpenCreate,
  onEdit,
  onDelete,
  searchValue,
  onSearchChange,
  sortBy,
  sortDir,
  onSort,
  entryTypeFilter,
  onEntryTypeFilterChange,
}: CvEntriesSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError } = useErrorSnackbar();

  const [orderedEntries, setOrderedEntries] = useState<CvEntryResponse[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const prevEntriesRef = useRef<CvEntryResponse[] | undefined>(undefined);
  if (entries && entries !== prevEntriesRef.current) {
    setOrderedEntries(entries);
  }
  prevEntriesRef.current = entries;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const reorderMutation = useMutation({
    mutationFn: (items: ReorderItem[]) => reorderCvEntries(siteId, items),
    onError: (err) => {
      showError(err);
      queryClient.invalidateQueries({ queryKey: queryKeys.cvEntries(siteId) });
    },
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedEntries((prev) => {
      const oldIndex = prev.findIndex((e) => e.id === active.id);
      const newIndex = prev.findIndex((e) => e.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      const items: ReorderItem[] = reordered.map((entry, index) => ({
        id: entry.id,
        display_order: index,
      }));
      reorderMutation.mutate(items);
      return reordered;
    });
  }, [reorderMutation]);

  const activeEntry = activeId ? orderedEntries.find((e) => e.id === activeId) : null;

  if (loading) {
    return <LoadingState label={t('cv.entries.loading')} />;
  }

  if (error) {
    return <Alert severity="error">{t('cv.entries.loadError')}</Alert>;
  }

  if (!orderedEntries || orderedEntries.length === 0) {
    return (
      <EmptyState
        icon={<WorkIcon sx={{ fontSize: 64 }} />}
        title={t('cv.entries.empty.title')}
        description={t('cv.entries.empty.description')}
        action={{ label: t('cv.entries.addEntry'), onClick: onOpenCreate }}
      />
    );
  }

  return (
    <Box data-testid="cv-entries.section">
      <Toolbar>
        <SearchField
          value={searchValue}
          onChange={onSearchChange}
          placeholder={t('cv.entries.searchPlaceholder')}
          data-testid="cv-entries.search"
        />
        <FilterSelect
          value={entryTypeFilter}
          onChange={onEntryTypeFilterChange}
          options={ENTRY_TYPES.map((type) => ({ value: type, label: type }))}
          placeholder={t('common.filters.filterByType')}
          width={180}
          data-testid="cv-entries.filter-entryType"
        />
        <ToolbarSpacer />
      </Toolbar>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <TableContainer
          sx={{
            borderRadius: '20px',
            border: '1px solid var(--outline-variant)',
            background: 'var(--surface-container-low)',
            /* M3-styled MUI table chrome: header row picks up the same
               uppercase/tracked typography DataTableV2 uses; cell dividers
               use --outline-variant; default Paper backgrounds go transparent. */
            '& .MuiTableHead-root .MuiTableCell-root': {
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: 'var(--on-surface-variant)',
              background: 'transparent',
              borderBottom: '1px solid var(--outline-variant)',
              height: 44,
              py: 0,
            },
            '& .MuiTableBody-root .MuiTableCell-root': {
              borderBottom: '1px solid var(--outline-variant)',
              color: 'var(--on-surface)',
              fontSize: 14,
              background: 'transparent',
            },
            '& .MuiTableBody-root .MuiTableRow-root:last-of-type .MuiTableCell-root': {
              borderBottom: 'none',
            },
            '& .MuiTableBody-root .MuiTableRow-root:hover .MuiTableCell-root': {
              background: 'var(--surface-container)',
            },
            '& .MuiTableSortLabel-root, & .MuiTableSortLabel-active, & .MuiTableSortLabel-icon': {
              color: 'inherit !important',
            },
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                {canWrite && <TableCell scope="col" sx={{ width: 48, px: 1 }} />}
                <TableCell scope="col">
                  <TableSortLabel
                    active={sortBy === 'company'}
                    direction={sortBy === 'company' ? sortDir : 'asc'}
                    onClick={() => onSort('company')}
                  >
                    {t('cv.entries.table.company')}
                  </TableSortLabel>
                </TableCell>
                <TableCell scope="col">{t('cv.entries.table.location')}</TableCell>
                <TableCell scope="col">
                  <TableSortLabel
                    active={sortBy === 'entry_type'}
                    direction={sortBy === 'entry_type' ? sortDir : 'asc'}
                    onClick={() => onSort('entry_type')}
                  >
                    {t('cv.entries.table.type')}
                  </TableSortLabel>
                </TableCell>
                <TableCell scope="col">
                  <TableSortLabel
                    active={sortBy === 'start_date'}
                    direction={sortBy === 'start_date' ? sortDir : 'asc'}
                    onClick={() => onSort('start_date')}
                  >
                    {t('cv.entries.table.dates')}
                  </TableSortLabel>
                </TableCell>
                <TableCell scope="col">{t('cv.entries.table.current')}</TableCell>
                <TableCell scope="col" align="right">{t('cv.entries.table.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <SortableContext items={orderedEntries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
              <TableBody>
                {orderedEntries.map((entry) => (
                  <SortableCvEntryRow
                    key={entry.id}
                    entry={entry}
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
          {activeEntry ? (
            <Paper elevation={12} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'primary.main', pointerEvents: 'none' }}>
              <DragIndicatorIcon fontSize="small" color="primary" />
              <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>{activeEntry.company}</Typography>
            </Paper>
          ) : null}
        </DragOverlay>
      </DndContext>
      {meta && (
        <Pagination
          total={meta.total_items}
          page={page}
          perPage={rowsPerPage}
          onPage={onPage}
          onPerPage={(n) => {
            onPerPage(n);
            onPage(1);
          }}
        />
      )}
    </Box>
  );
}
