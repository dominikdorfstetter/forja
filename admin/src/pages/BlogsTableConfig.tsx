import {
  Checkbox,
  Typography,
  Chip,
  TableSortLabel,
} from '@mui/material';
import { format } from 'date-fns';
import type { TFunction } from 'i18next';
import type { BlogListItem } from '@/types/api';
import type { DataTableColumn } from '@/components/shared/DataTable';
import StatusChip from '@/components/shared/StatusChip';
import BlogActionsMenu from '@/components/blogs/BlogActionsMenu';
import type { SortDir } from '@/pages/BlogsReducer';

interface BlogsColumnDeps {
  t: TFunction;
  bulk: {
    count: number;
    allSelected: (ids: string[]) => boolean;
    selectAll: (ids: string[]) => void;
    isSelected: (id: string) => boolean;
    toggle: (id: string) => void;
  };
  blogIds: string[];
  sortBy: string;
  sortDir: SortDir;
  canWrite: boolean;
  isAdmin: boolean;
  handleSort: (column: string) => void;
  onView: (blog: BlogListItem) => void;
  onPublish: (blog: BlogListItem) => void;
  onUnpublish: (blog: BlogListItem) => void;
  onClone: (blog: BlogListItem) => void;
  onDelete: (blog: BlogListItem) => void;
  onArchive: (blog: BlogListItem) => void;
  onRestore: (blog: BlogListItem) => void;
  cloneDisabled: boolean;
}

export function buildBlogsColumns(deps: BlogsColumnDeps): DataTableColumn<BlogListItem>[] {
  const { t, bulk, blogIds, sortBy, sortDir, canWrite, isAdmin, handleSort, onView, onPublish, onUnpublish, onClone, onDelete, onArchive, onRestore, cloneDisabled } = deps;

  return [
    {
      header: (
        <Checkbox
          indeterminate={bulk.count > 0 && !bulk.allSelected(blogIds)}
          checked={bulk.allSelected(blogIds)}
          onChange={() => bulk.selectAll(blogIds)}
          aria-label={t('blogs.table.selectAll')}
        />
      ),
      padding: 'checkbox',
      render: (blog) => (
        <Checkbox
          checked={bulk.isSelected(blog.id)}
          onChange={() => bulk.toggle(blog.id)}
          aria-label={t('blogs.table.selectRow', { slug: blog.slug })}
        />
      ),
    },
    {
      header: (
        <TableSortLabel active={sortBy === 'slug'} direction={sortBy === 'slug' ? sortDir : 'asc'} onClick={() => handleSort('slug')}>
          {t('blogs.table.slug')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (blog) => <Typography variant="body2" fontFamily="monospace">{blog.slug || '\u2014'}</Typography>,
    },
    {
      header: (
        <TableSortLabel active={sortBy === 'author'} direction={sortBy === 'author' ? sortDir : 'asc'} onClick={() => handleSort('author')}>
          {t('blogs.table.author')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (blog) => blog.author,
    },
    {
      header: (
        <TableSortLabel active={sortBy === 'status'} direction={sortBy === 'status' ? sortDir : 'asc'} onClick={() => handleSort('status')}>
          {t('blogs.table.status')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (blog) => <StatusChip value={blog.status} />,
    },
    {
      header: t('blogs.table.featured'),
      scope: 'col',
      render: (blog) => blog.is_featured ? <Chip label={t('common.labels.featured')} size="small" color="primary" variant="outlined" /> : null,
    },
    {
      header: (
        <TableSortLabel active={sortBy === 'published_date'} direction={sortBy === 'published_date' ? sortDir : 'desc'} onClick={() => handleSort('published_date')}>
          {t('blogs.table.published')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (blog) => format(new Date(blog.published_date), 'PP'),
    },
    {
      header: t('blogs.table.actions'),
      scope: 'col',
      align: 'right',
      render: (blog) => (
        <BlogActionsMenu
          blog={blog}
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

interface BlogsFilterDeps {
  t: TFunction;
  workflowEnabled: boolean;
}

function buildBlogsStatusFilterOptions({ t, workflowEnabled }: BlogsFilterDeps) {
  return [
    { value: '', label: t('common.filters.all') },
    { value: 'Draft', label: t('common.status.draft') },
    ...(workflowEnabled ? [{ value: 'InReview', label: t('common.status.inReview') }] : []),
    ...(workflowEnabled ? [{ value: 'Scheduled', label: t('common.status.scheduled') }] : []),
    { value: 'Published', label: t('common.status.published') },
  ];
}

interface BlogsFilterArrayDeps {
  t: TFunction;
  workflowEnabled: boolean;
  isArchived: boolean;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
}

export function buildBlogsFilters(deps: BlogsFilterArrayDeps) {
  const { t, workflowEnabled, isArchived, statusFilter, onStatusFilterChange } = deps;
  if (isArchived) return [];
  const statusFilterOptions = buildBlogsStatusFilterOptions({ t, workflowEnabled });
  return [
    {
      key: 'status',
      label: t('common.filters.status'),
      options: statusFilterOptions,
      value: statusFilter,
      onChange: onStatusFilterChange,
    },
  ];
}
