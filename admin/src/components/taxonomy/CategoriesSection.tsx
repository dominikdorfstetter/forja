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
import CategoryIcon from '@mui/icons-material/Category';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import type { Category } from '@/types/api';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';
import TableFilterBar from '@/components/shared/TableFilterBar';

interface PaginationMeta {
  total_items: number;
  page: number;
  page_size: number;
}

interface CategoriesSectionProps {
  categories: Category[] | undefined;
  meta: PaginationMeta | undefined;
  loading: boolean;
  page: number;
  rowsPerPage: number;
  canWrite: boolean;
  isAdmin: boolean;
  onPageChange: (_: unknown, page: number) => void;
  onRowsPerPageChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onOpenCreate: () => void;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (column: string) => void;
}

export default function CategoriesSection({
  categories,
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
}: CategoriesSectionProps) {
  const { t } = useTranslation();

  const catColumns: DataTableColumn<Category>[] = [
    {
      header: (
        <TableSortLabel active={sortBy === 'slug'} direction={sortBy === 'slug' ? sortDir : 'asc'} onClick={() => onSort('slug')}>
          {t('taxonomy.categories.table.slug')}
        </TableSortLabel>
      ),
      render: (cat) => <Typography variant="body2" fontFamily="monospace">{cat.slug}</Typography>,
    },
    {
      header: t('taxonomy.categories.table.parent'),
      render: (cat) => cat.parent_id
        ? <Chip label={t('common.labels.child')} size="small" variant="outlined" />
        : '\u2014',
    },
    {
      header: t('taxonomy.categories.table.scope'),
      render: (cat) => cat.is_global
        ? <Chip label={t('common.labels.global')} size="small" color="info" variant="outlined" />
        : <Chip label={t('common.labels.site')} size="small" variant="outlined" />,
    },
    {
      header: (
        <TableSortLabel active={sortBy === 'created_at'} direction={sortBy === 'created_at' ? sortDir : 'asc'} onClick={() => onSort('created_at')}>
          {t('taxonomy.categories.table.created')}
        </TableSortLabel>
      ),
      render: (cat) => format(new Date(cat.created_at), 'PP'),
    },
    {
      header: t('taxonomy.categories.table.actions'),
      scope: 'col',
      align: 'right',
      render: (cat) => (
        <>
          {canWrite && <Tooltip title={t('common.actions.edit')}><IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => onEdit(cat)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
          {isAdmin && <Tooltip title={t('common.actions.delete')}><IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => onDelete(cat)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
        </>
      ),
    },
  ];

  return (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6" component="h2">
          {t('taxonomy.categories.title')} {meta && `(${meta.total_items})`}
        </Typography>
        {canWrite && <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={onOpenCreate}
        >
          {t('taxonomy.categories.addCategory')}
        </Button>}
      </Box>
      <Divider />
      <TableFilterBar
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchPlaceholder={t('taxonomy.categories.searchPlaceholder')}
        testIdPrefix="taxonomy.categories"
      />

      {loading ? (
        <LoadingState label={t('taxonomy.categories.loading')} />
      ) : !categories || categories.length === 0 ? (
        <EmptyState
          icon={<CategoryIcon sx={{ fontSize: 48 }} />}
          title={t('taxonomy.categories.empty.title')}
          description={t('taxonomy.categories.empty.description')}
          action={{ label: t('taxonomy.categories.addCategory'), onClick: onOpenCreate }}
        />
      ) : (
        <DataTable<Category>
          data={categories}
          columns={catColumns}
          getRowKey={(cat) => cat.id}
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
