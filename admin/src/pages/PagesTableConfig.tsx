import {
  Checkbox,
  Typography,
  Chip,
  TableSortLabel,
} from '@mui/material';
import { format } from 'date-fns';
import type { TFunction } from 'i18next';
import type { PageListItem } from '@/types/api';
import type { DataTableColumn } from '@/components/shared/DataTable';
import StatusChip from '@/components/shared/StatusChip';
import PageTypeChip from '@/components/shared/PageTypeChip';
import PageActionsMenu from '@/components/pages/PageActionsMenu';
import type { SortDir } from '@/pages/PagesReducer';

interface PagesColumnDeps {
  t: TFunction;
  bulk: {
    count: number;
    allSelected: (ids: string[]) => boolean;
    selectAll: (ids: string[]) => void;
    isSelected: (id: string) => boolean;
    toggle: (id: string) => void;
  };
  pageIds: string[];
  sortBy: string;
  sortDir: SortDir;
  canWrite: boolean;
  isAdmin: boolean;
  handleSort: (column: string) => void;
  onView: (page: PageListItem) => void;
  onPublish: (page: PageListItem) => void;
  onUnpublish: (page: PageListItem) => void;
  onClone: (page: PageListItem) => void;
  onDelete: (page: PageListItem) => void;
  onArchive: (page: PageListItem) => void;
  onRestore: (page: PageListItem) => void;
  cloneDisabled: boolean;
}

export function buildPagesColumns(deps: PagesColumnDeps): DataTableColumn<PageListItem>[] {
  const { t, bulk, pageIds, sortBy, sortDir, canWrite, isAdmin, handleSort, onView, onPublish, onUnpublish, onClone, onDelete, onArchive, onRestore, cloneDisabled } = deps;

  return [
    {
      header: (
        <Checkbox
          indeterminate={bulk.count > 0 && !bulk.allSelected(pageIds)}
          checked={bulk.allSelected(pageIds)}
          onChange={() => bulk.selectAll(pageIds)}
          aria-label={t('pages.table.selectAll')}
        />
      ),
      padding: 'checkbox',
      render: (pg) => (
        <Checkbox
          checked={bulk.isSelected(pg.id)}
          onChange={() => bulk.toggle(pg.id)}
          aria-label={t('pages.table.selectRow', { route: pg.route })}
        />
      ),
    },
    {
      header: (
        <TableSortLabel active={sortBy === 'route'} direction={sortBy === 'route' ? sortDir : 'asc'} onClick={() => handleSort('route')}>
          {t('pages.table.route')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (pg) => <Typography variant="body2" fontFamily="monospace">{pg.route}</Typography>,
    },
    {
      header: (
        <TableSortLabel active={sortBy === 'page_type'} direction={sortBy === 'page_type' ? sortDir : 'asc'} onClick={() => handleSort('page_type')}>
          {t('pages.table.type')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (pg) => <PageTypeChip value={pg.page_type} />,
    },
    {
      header: (
        <TableSortLabel active={sortBy === 'status'} direction={sortBy === 'status' ? sortDir : 'asc'} onClick={() => handleSort('status')}>
          {t('pages.table.status')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (pg) => <StatusChip value={pg.status} />,
    },
    {
      header: t('pages.table.inNav'),
      scope: 'col',
      render: (pg) => pg.is_in_navigation
        ? <Chip label={t('common.labels.yes')} size="small" color="primary" variant="outlined" />
        : <Chip label={t('common.labels.no')} size="small" variant="outlined" />,
    },
    {
      header: (
        <TableSortLabel active={sortBy === 'created_at'} direction={sortBy === 'created_at' ? sortDir : 'asc'} onClick={() => handleSort('created_at')}>
          {t('pages.table.created')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (pg) => format(new Date(pg.created_at), 'PP'),
    },
    {
      header: t('pages.table.actions'),
      scope: 'col',
      align: 'right',
      render: (pg) => (
        <PageActionsMenu
          page={pg}
          canWrite={canWrite}
          isAdmin={isAdmin}
          onView={onView}
          onPublish={onPublish}
          onUnpublish={onUnpublish}
          onClone={onClone}
          onDelete={onDelete}
          onArchive={onArchive}
          onRestore={onRestore}
          cloneDisabled={cloneDisabled}
        />
      ),
    },
  ];
}

interface PagesFilterDeps {
  t: TFunction;
  workflowEnabled: boolean;
}

function buildStatusFilterOptions({ t, workflowEnabled }: PagesFilterDeps) {
  return [
    { value: '', label: t('common.filters.all') },
    { value: 'Draft', label: t('common.status.draft') },
    ...(workflowEnabled ? [{ value: 'InReview', label: t('common.status.inReview') }] : []),
    ...(workflowEnabled ? [{ value: 'Scheduled', label: t('common.status.scheduled') }] : []),
    { value: 'Published', label: t('common.status.published') },
  ];
}

function buildTypeFilterOptions({ t }: { t: TFunction }) {
  return [
    { value: '', label: t('common.filters.all') },
    { value: 'Static', label: t('pages.wizard.types.static') },
    { value: 'Landing', label: t('pages.wizard.types.landing') },
    { value: 'Contact', label: t('pages.wizard.types.contact') },
    { value: 'BlogIndex', label: t('pages.wizard.types.blogIndex') },
    { value: 'Custom', label: t('pages.wizard.types.custom') },
  ];
}

interface PagesFiltersDeps {
  t: TFunction;
  workflowEnabled: boolean;
  isArchived: boolean;
  statusFilter: string;
  typeFilter: string;
  onStatusFilterChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
}

export function buildPagesFilters(deps: PagesFiltersDeps) {
  const { t, workflowEnabled, isArchived, statusFilter, typeFilter, onStatusFilterChange, onTypeFilterChange } = deps;
  const statusFilterOptions = buildStatusFilterOptions({ t, workflowEnabled });
  const typeFilterOptions = buildTypeFilterOptions({ t });

  const filters = [];
  if (!isArchived) {
    filters.push({
      key: 'status',
      label: t('common.filters.status'),
      options: statusFilterOptions,
      value: statusFilter,
      onChange: onStatusFilterChange,
    });
  }
  filters.push({
    key: 'type',
    label: t('common.filters.filterByType'),
    options: typeFilterOptions,
    value: typeFilter,
    onChange: onTypeFilterChange,
  });
  return filters;
}
