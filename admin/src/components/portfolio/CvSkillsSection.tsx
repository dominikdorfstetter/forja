import { useState } from 'react';
import { Alert, Box, Chip, Rating } from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import { useTranslation } from 'react-i18next';
import type { SkillResponse } from '@/types/api';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import {
  Toolbar,
  ToolbarSpacer,
  SearchField,
  DataTableV2,
  type DataTableV2Column,
  Pagination,
  RowActionBtn,
  ActionMenu,
  type ActionMenuItem,
} from '@/components/shared/listPageV2';

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
  onPage: (page: number) => void;
  onPerPage: (pageSize: number) => void;
  onOpenCreate: () => void;
  onEdit: (skill: SkillResponse) => void;
  onDelete: (skill: SkillResponse) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (column: string) => void;
}

function SkillRowActions({
  skill,
  canWrite,
  isAdmin,
  onEdit,
  onDelete,
}: {
  skill: SkillResponse;
  canWrite: boolean;
  isAdmin: boolean;
  onEdit: (s: SkillResponse) => void;
  onDelete: (s: SkillResponse) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (!canWrite && !isAdmin) return null;

  const items: ActionMenuItem[] = [];
  if (canWrite) {
    items.push({ icon: 'edit', label: t('common.actions.edit'), onClick: () => onEdit(skill) });
  }
  if (isAdmin) {
    items.push({
      icon: 'delete',
      label: t('common.actions.delete'),
      danger: true,
      onClick: () => onDelete(skill),
    });
  }

  return (
    <div style={{ position: 'relative' }}>
      <RowActionBtn
        open={open}
        ariaLabel={t('common.table.actions')}
        data-testid="skill-actions.btn.menu"
        onClick={() => setOpen((p) => !p)}
      />
      {open && <ActionMenu items={items} onClose={() => setOpen(false)} />}
    </div>
  );
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
}: CvSkillsSectionProps) {
  const { t } = useTranslation();

  const sortedDir = (key: string): 'asc' | 'desc' | undefined =>
    sortBy === key ? sortDir : undefined;

  const columns: DataTableV2Column<SkillResponse>[] = [
    {
      key: 'name',
      label: t('cv.skills.table.name'),
      width: '1fr',
      sorted: sortedDir('name'),
      render: (s) => s.name,
    },
    {
      key: 'slug',
      label: t('cv.skills.table.slug'),
      width: '1fr',
      muted: true,
      render: (s) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{s.slug}</span>
      ),
    },
    {
      key: 'category',
      label: t('cv.skills.table.category'),
      width: '140px',
      sorted: sortedDir('category'),
      render: (s) =>
        s.category ? (
          <Chip label={s.category} size="small" variant="outlined" />
        ) : (
          '\u2014'
        ),
    },
    {
      key: 'proficiency_level',
      label: t('cv.skills.table.proficiency'),
      width: '160px',
      sorted: sortedDir('proficiency_level'),
      render: (s) =>
        s.proficiency_level != null ? (
          <Rating
            value={s.proficiency_level}
            max={5}
            readOnly
            size="small"
            getLabelText={(value) => `${value} ${value === 1 ? 'Star' : 'Stars'}`}
          />
        ) : (
          '\u2014'
        ),
    },
    {
      key: 'icon',
      label: t('cv.skills.table.icon'),
      width: '80px',
      muted: true,
      render: (s) => s.icon || '\u2014',
    },
  ];

  if (error) {
    return <Alert severity="error">{t('cv.skills.loadError')}</Alert>;
  }

  const total = meta?.total_items ?? 0;

  return (
    <Box data-testid="cv-skills.section">
      <Toolbar>
        <SearchField
          value={searchValue}
          onChange={onSearchChange}
          placeholder={t('cv.skills.searchPlaceholder')}
          data-testid="cv-skills.search"
        />
        <ToolbarSpacer />
      </Toolbar>

      {loading ? (
        <LoadingState label={t('cv.skills.loading')} />
      ) : !skills || skills.length === 0 ? (
        <EmptyState
          icon={<SchoolIcon sx={{ fontSize: 64 }} />}
          title={t('cv.skills.empty.title')}
          description={t('cv.skills.empty.description')}
          action={canWrite ? { label: t('cv.skills.addSkill'), onClick: onOpenCreate } : undefined}
        />
      ) : (
        <>
          <DataTableV2<SkillResponse>
            data-testid="cv-skills.table"
            columns={columns}
            rows={skills}
            getKey={(s) => s.id}
            onSort={onSort}
            renderActions={(s) => (
              <SkillRowActions
                skill={s}
                canWrite={canWrite}
                isAdmin={isAdmin}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            )}
          />
          <Pagination
            total={total}
            page={page}
            perPage={rowsPerPage}
            onPage={onPage}
            onPerPage={(n) => {
              onPerPage(n);
              onPage(1);
            }}
          />
        </>
      )}
    </Box>
  );
}
