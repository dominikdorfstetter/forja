import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  TableSortLabel,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import type { Tag } from '@/types/api';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';
import TableFilterBar from '@/components/shared/TableFilterBar';

interface PaginationMeta {
  total_items: number;
  page: number;
  page_size: number;
}

interface TagsSectionProps {
  tags: Tag[] | undefined;
  meta: PaginationMeta | undefined;
  loading: boolean;
  page: number;
  rowsPerPage: number;
  canWrite: boolean;
  isAdmin: boolean;
  onPageChange: (_: unknown, page: number) => void;
  onRowsPerPageChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onOpenCreate: () => void;
  onEdit: (tag: Tag) => void;
  onDelete: (tag: Tag) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (column: string) => void;
}

export default function TagsSection({
  tags,
  meta,
  loading,
  page,
  rowsPerPage,
  canWrite,
  isAdmin,
  onPageChange,
  onRowsPerPageChange,
  onOpenCreate,
  onEdit,
  onDelete,
  searchValue,
  onSearchChange,
  sortBy,
  sortDir,
  onSort,
}: TagsSectionProps) {
  const { t } = useTranslation();

  const tagColumns: DataTableColumn<Tag>[] = [
    {
      header: (
        <TableSortLabel active={sortBy === 'slug'} direction={sortBy === 'slug' ? sortDir : 'asc'} onClick={() => onSort('slug')}>
          {t('taxonomy.tags.table.slug')}
        </TableSortLabel>
      ),
      render: (tag) => <Typography variant="body2" fontFamily="monospace">{tag.slug}</Typography>,
    },
    {
      header: t('taxonomy.tags.table.scope'),
      render: (tag) => tag.is_global
        ? <Chip label={t('common.labels.global')} size="small" color="info" variant="outlined" />
        : <Chip label={t('common.labels.site')} size="small" variant="outlined" />,
    },
    {
      header: (
        <TableSortLabel active={sortBy === 'created_at'} direction={sortBy === 'created_at' ? sortDir : 'asc'} onClick={() => onSort('created_at')}>
          {t('taxonomy.tags.table.created')}
        </TableSortLabel>
      ),
      render: (tag) => format(new Date(tag.created_at), 'PP'),
    },
    {
      header: t('taxonomy.tags.table.actions'),
      scope: 'col',
      align: 'right',
      render: (tag) => (
        <>
          {canWrite && <Tooltip title={t('common.actions.edit')}><IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => onEdit(tag)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
          {isAdmin && <Tooltip title={t('common.actions.delete')}><IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => onDelete(tag)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
        </>
      ),
    },
  ];

  return (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6" component="h2">
          {t('taxonomy.tags.title')} {meta && `(${meta.total_items})`}
        </Typography>
        {canWrite && <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={onOpenCreate}
        >
          {t('taxonomy.tags.addTag')}
        </Button>}
      </Box>
      <Divider />
      <TableFilterBar
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchPlaceholder={t('taxonomy.tags.searchPlaceholder')}
        testIdPrefix="taxonomy.tags"
      />

      {loading ? (
        <LoadingState label={t('taxonomy.tags.loading')} />
      ) : !tags || tags.length === 0 ? (
        <EmptyState
          icon={<LocalOfferIcon sx={{ fontSize: 48 }} />}
          title={t('taxonomy.tags.empty.title')}
          description={t('taxonomy.tags.empty.description')}
          action={{ label: t('taxonomy.tags.addTag'), onClick: onOpenCreate }}
        />
      ) : (
        <DataTable<Tag>
          data={tags}
          columns={tagColumns}
          getRowKey={(tag) => tag.id}
          meta={meta}
          page={page}
          onPageChange={onPageChange}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={onRowsPerPageChange}
        />
      )}
    </Paper>
  );
}
