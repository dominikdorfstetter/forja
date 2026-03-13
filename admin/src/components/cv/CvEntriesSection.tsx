import {
  Alert,
  Chip,
  IconButton,
  Paper,
  TableSortLabel,
  Tooltip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import WorkIcon from '@mui/icons-material/Work';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import type { CvEntryResponse, CvEntryType } from '@/types/api';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';
import TableFilterBar from '@/components/shared/TableFilterBar';

export const ENTRY_TYPES: CvEntryType[] = ['Work', 'Education', 'Volunteer', 'Certification', 'Project'];

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
  onPageChange: (_: unknown, page: number) => void;
  onRowsPerPageChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
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
  entryTypeFilter,
  onEntryTypeFilterChange,
}: CvEntriesSectionProps) {
  const { t } = useTranslation();

  const entryColumns: DataTableColumn<CvEntryResponse>[] = [
    {
      header: (
        <TableSortLabel
          active={sortBy === 'company'}
          direction={sortBy === 'company' ? sortDir : 'asc'}
          onClick={() => onSort('company')}
        >
          {t('cv.entries.table.company')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (entry) => entry.company,
    },
    {
      header: t('cv.entries.table.location'),
      scope: 'col',
      render: (entry) => entry.location,
    },
    {
      header: (
        <TableSortLabel
          active={sortBy === 'entry_type'}
          direction={sortBy === 'entry_type' ? sortDir : 'asc'}
          onClick={() => onSort('entry_type')}
        >
          {t('cv.entries.table.type')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (entry) => <Chip label={entry.entry_type} size="small" variant="outlined" />,
    },
    {
      header: (
        <TableSortLabel
          active={sortBy === 'start_date'}
          direction={sortBy === 'start_date' ? sortDir : 'asc'}
          onClick={() => onSort('start_date')}
        >
          {t('cv.entries.table.dates')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (entry) => (
        <>
          {format(new Date(entry.start_date), 'PP')}
          {' - '}
          {entry.is_current ? t('common.labels.present') : (entry.end_date ? format(new Date(entry.end_date), 'PP') : '\u2014')}
        </>
      ),
    },
    {
      header: t('cv.entries.table.current'),
      scope: 'col',
      render: (entry) => entry.is_current ? t('common.labels.yes') : t('common.labels.no'),
    },
    {
      header: (
        <TableSortLabel
          active={sortBy === 'display_order'}
          direction={sortBy === 'display_order' ? sortDir : 'asc'}
          onClick={() => onSort('display_order')}
        >
          {t('cv.entries.table.order')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (entry) => entry.display_order,
    },
    {
      header: t('cv.entries.table.actions'),
      scope: 'col',
      align: 'right',
      render: (entry) => (
        <>
          {canWrite && <Tooltip title={t('common.actions.edit')}><IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => onEdit(entry)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
          {isAdmin && <Tooltip title={t('common.actions.delete')}><IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => onDelete(entry)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
        </>
      ),
    },
  ];

  if (loading) {
    return <LoadingState label={t('cv.entries.loading')} />;
  }

  if (error) {
    return <Alert severity="error">{t('cv.entries.loadError')}</Alert>;
  }

  if (!entries || entries.length === 0) {
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
    <Paper>
      <TableFilterBar
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchPlaceholder={t('cv.entries.searchPlaceholder')}
        filters={[{
          key: 'entryType',
          label: t('common.filters.filterByType'),
          value: entryTypeFilter,
          onChange: onEntryTypeFilterChange,
          options: [
            { value: '', label: t('common.filters.all') },
            ...ENTRY_TYPES.map((type) => ({ value: type, label: type })),
          ],
        }]}
      />
      <DataTable<CvEntryResponse>
        data={entries}
        columns={entryColumns}
        getRowKey={(entry) => entry.id}
        meta={meta}
        page={page}
        onPageChange={onPageChange}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={onRowsPerPageChange}
        size="medium"
      />
    </Paper>
  );
}
