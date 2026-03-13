import {
  Alert,
  Box,
  Chip,
  IconButton,
  Paper,
  TableSortLabel,
  Tooltip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SchoolIcon from '@mui/icons-material/School';
import { useTranslation } from 'react-i18next';
import type { SkillResponse } from '@/types/api';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';
import TableFilterBar from '@/components/shared/TableFilterBar';

interface PaginationMeta {
  total_items: number;
  page: number;
  page_size: number;
}

interface CvSkillsSectionProps {
  skills: SkillResponse[] | undefined;
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
  onEdit: (skill: SkillResponse) => void;
  onDelete: (skill: SkillResponse) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (column: string) => void;
}

export default function CvSkillsSection({
  skills,
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
}: CvSkillsSectionProps) {
  const { t } = useTranslation();

  const skillColumns: DataTableColumn<SkillResponse>[] = [
    {
      header: (
        <TableSortLabel
          active={sortBy === 'name'}
          direction={sortBy === 'name' ? sortDir : 'asc'}
          onClick={() => onSort('name')}
        >
          {t('cv.skills.table.name')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (skill) => skill.name,
    },
    {
      header: t('cv.skills.table.slug'),
      scope: 'col',
      render: (skill) => <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{skill.slug}</Box>,
    },
    {
      header: (
        <TableSortLabel
          active={sortBy === 'category'}
          direction={sortBy === 'category' ? sortDir : 'asc'}
          onClick={() => onSort('category')}
        >
          {t('cv.skills.table.category')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (skill) => skill.category ? <Chip label={skill.category} size="small" variant="outlined" /> : '\u2014',
    },
    {
      header: (
        <TableSortLabel
          active={sortBy === 'proficiency_level'}
          direction={sortBy === 'proficiency_level' ? sortDir : 'asc'}
          onClick={() => onSort('proficiency_level')}
        >
          {t('cv.skills.table.proficiency')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (skill) => skill.proficiency_level != null ? `${skill.proficiency_level}%` : '\u2014',
    },
    {
      header: t('cv.skills.table.icon'),
      scope: 'col',
      render: (skill) => skill.icon || '\u2014',
    },
    {
      header: t('cv.skills.table.actions'),
      scope: 'col',
      align: 'right',
      render: (skill) => (
        <>
          {canWrite && <Tooltip title={t('common.actions.edit')}><IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => onEdit(skill)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
          {isAdmin && <Tooltip title={t('common.actions.delete')}><IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => onDelete(skill)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
        </>
      ),
    },
  ];

  if (loading) {
    return <LoadingState label={t('cv.skills.loading')} />;
  }

  if (error) {
    return <Alert severity="error">{t('cv.skills.loadError')}</Alert>;
  }

  if (!skills || skills.length === 0) {
    return (
      <EmptyState
        icon={<SchoolIcon sx={{ fontSize: 64 }} />}
        title={t('cv.skills.empty.title')}
        description={t('cv.skills.empty.description')}
        action={{ label: t('cv.skills.addSkill'), onClick: onOpenCreate }}
      />
    );
  }

  return (
    <Paper>
      <TableFilterBar
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchPlaceholder={t('cv.skills.searchPlaceholder')}
      />
      <DataTable<SkillResponse>
        data={skills}
        columns={skillColumns}
        getRowKey={(skill) => skill.id}
        meta={meta}
        page={page}
        onPageChange={onPageChange}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={onRowsPerPageChange}
        size="small"
      />
    </Paper>
  );
}
