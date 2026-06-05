import { useState } from 'react';
import { Box, Chip } from '@mui/material';
import CategoryIcon from '@mui/icons-material/Category';
import { useTranslation } from 'react-i18next';
import type { Category } from '@/types/api';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
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
import { M3Button, Icon } from '@/components/design-system';

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

function CategoryRowActions({
  category,
  canWrite,
  isAdmin,
  onEdit,
  onDelete,
}: {
  category: Category;
  canWrite: boolean;
  isAdmin: boolean;
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!canWrite && !isAdmin) return null;

  const items: ActionMenuItem[] = [
    ...(canWrite
      ? [{ icon: 'edit', label: t('common.actions.edit'), onClick: () => onEdit(category) }]
      : []),
    ...(isAdmin
      ? [
          {
            icon: 'delete',
            label: t('common.actions.delete'),
            danger: true,
            onClick: () => onDelete(category),
          },
        ]
      : []),
  ];

  return (
    <div style={{ position: 'relative' }}>
      <RowActionBtn
        open={open}
        ariaLabel={t('common.table.actions')}
        data-testid="category-actions.btn.menu"
        onClick={() => setOpen((p) => !p)}
      />
      {open && <ActionMenu items={items} onClose={() => setOpen(false)} />}
    </div>
  );
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
  const fmt = useLocalizedFormat();

  const sortedDir = (k: string): 'asc' | 'desc' | undefined =>
    sortBy === k ? sortDir : undefined;

  const columns: DataTableV2Column<Category>[] = [
    {
      key: 'slug',
      label: t('taxonomy.categories.table.slug'),
      width: '1fr',
      sorted: sortedDir('slug'),
      render: (cat) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {cat.slug}
        </span>
      ),
    },
    {
      key: 'parent',
      label: t('taxonomy.categories.table.parent'),
      width: '90px',
      render: (cat) =>
        cat.parent_id ? (
          <Chip label={t('common.labels.child')} size="small" variant="outlined" />
        ) : (
          '\u2014'
        ),
    },
    {
      key: 'scope',
      label: t('taxonomy.categories.table.scope'),
      width: '100px',
      render: (cat) =>
        cat.is_global ? (
          <Chip label={t('common.labels.global')} size="small" color="info" variant="outlined" />
        ) : (
          <Chip label={t('common.labels.site')} size="small" variant="outlined" />
        ),
    },
    {
      key: 'created_at',
      label: t('taxonomy.categories.table.created'),
      width: '120px',
      muted: true,
      sorted: sortedDir('created_at'),
      render: (cat) => fmt(cat.created_at, 'PP'),
    },
  ];

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Icon name="category" size={22} color="var(--primary)" />
          <Box
            component="h2"
            sx={{
              m: 0,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: -0.2,
              color: 'var(--on-surface)',
            }}
          >
            {t('taxonomy.categories.title')}
            {meta && (
              <Box component="span" sx={{ ml: 1, color: 'var(--on-surface-variant)', fontWeight: 500 }}>
                ({meta.total_items})
              </Box>
            )}
          </Box>
        </Box>
        {canWrite && (
          <M3Button size="sm" icon="add" onClick={onOpenCreate} data-testid="create-category">
            {t('taxonomy.categories.addCategory')}
          </M3Button>
        )}
      </Box>

      <Toolbar>
        <SearchField
          value={searchValue}
          onChange={onSearchChange}
          placeholder={t('taxonomy.categories.searchPlaceholder')}
          data-testid="taxonomy.categories-search"
          width="100%"
        />
        <ToolbarSpacer />
      </Toolbar>

      {loading ? (
        <LoadingState label={t('taxonomy.categories.loading')} />
      ) : !categories || categories.length === 0 ? (
        <EmptyState
          icon={<CategoryIcon sx={{ fontSize: 48 }} />}
          title={t('taxonomy.categories.empty.title')}
          description={t('taxonomy.categories.empty.description')}
          action={
            canWrite
              ? { label: t('taxonomy.categories.addCategory'), onClick: onOpenCreate }
              : undefined
          }
        />
      ) : (
        <>
          <DataTableV2<Category>
            data-testid="taxonomy.categories.table"
            columns={columns}
            rows={categories}
            getKey={(cat) => cat.id}
            onSort={onSort}
            renderActions={(cat) => (
              <CategoryRowActions
                category={cat}
                canWrite={canWrite}
                isAdmin={isAdmin}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            )}
          />
          {meta && (
            <Pagination
              total={meta.total_items}
              page={page}
              perPage={rowsPerPage}
              onPage={(next) => onPageChange(null, next - 1)}
              onPerPage={(next) =>
                onRowsPerPageChange({
                  target: { value: String(next) },
                } as unknown as React.ChangeEvent<HTMLInputElement>)
              }
            />
          )}
        </>
      )}
    </Box>
  );
}
