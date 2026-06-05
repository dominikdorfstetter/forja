import { useState } from 'react';
import { Box, Chip } from '@mui/material';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import { useTranslation } from 'react-i18next';
import type { Tag } from '@/types/api';
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

function TagRowActions({
  tag,
  canWrite,
  isAdmin,
  onEdit,
  onDelete,
}: {
  tag: Tag;
  canWrite: boolean;
  isAdmin: boolean;
  onEdit: (t: Tag) => void;
  onDelete: (t: Tag) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!canWrite && !isAdmin) return null;

  const items: ActionMenuItem[] = [
    ...(canWrite
      ? [{ icon: 'edit', label: t('common.actions.edit'), onClick: () => onEdit(tag) }]
      : []),
    ...(isAdmin
      ? [
          {
            icon: 'delete',
            label: t('common.actions.delete'),
            danger: true,
            onClick: () => onDelete(tag),
          },
        ]
      : []),
  ];

  return (
    <div style={{ position: 'relative' }}>
      <RowActionBtn
        open={open}
        ariaLabel={t('common.table.actions')}
        data-testid="tag-actions.btn.menu"
        onClick={() => setOpen((p) => !p)}
      />
      {open && <ActionMenu items={items} onClose={() => setOpen(false)} />}
    </div>
  );
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
  const fmt = useLocalizedFormat();

  const sortedDir = (k: string): 'asc' | 'desc' | undefined =>
    sortBy === k ? sortDir : undefined;

  const columns: DataTableV2Column<Tag>[] = [
    {
      key: 'slug',
      label: t('taxonomy.tags.table.slug'),
      width: '1fr',
      sorted: sortedDir('slug'),
      render: (tag) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {tag.slug}
        </span>
      ),
    },
    {
      key: 'scope',
      label: t('taxonomy.tags.table.scope'),
      width: '100px',
      render: (tag) =>
        tag.is_global ? (
          <Chip label={t('common.labels.global')} size="small" color="info" variant="outlined" />
        ) : (
          <Chip label={t('common.labels.site')} size="small" variant="outlined" />
        ),
    },
    {
      key: 'created_at',
      label: t('taxonomy.tags.table.created'),
      width: '120px',
      muted: true,
      sorted: sortedDir('created_at'),
      render: (tag) => fmt(tag.created_at, 'PP'),
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
          <Icon name="sell" size={22} color="var(--primary)" />
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
            {t('taxonomy.tags.title')}
            {meta && (
              <Box component="span" sx={{ ml: 1, color: 'var(--on-surface-variant)', fontWeight: 500 }}>
                ({meta.total_items})
              </Box>
            )}
          </Box>
        </Box>
        {canWrite && (
          <M3Button size="sm" icon="add" onClick={onOpenCreate} data-testid="create-tag">
            {t('taxonomy.tags.addTag')}
          </M3Button>
        )}
      </Box>

      <Toolbar>
        <SearchField
          value={searchValue}
          onChange={onSearchChange}
          placeholder={t('taxonomy.tags.searchPlaceholder')}
          data-testid="taxonomy.tags-search"
          width="100%"
        />
        <ToolbarSpacer />
      </Toolbar>

      {loading ? (
        <LoadingState label={t('taxonomy.tags.loading')} />
      ) : !tags || tags.length === 0 ? (
        <EmptyState
          icon={<LocalOfferIcon sx={{ fontSize: 48 }} />}
          title={t('taxonomy.tags.empty.title')}
          description={t('taxonomy.tags.empty.description')}
          action={canWrite ? { label: t('taxonomy.tags.addTag'), onClick: onOpenCreate } : undefined}
        />
      ) : (
        <>
          <DataTableV2<Tag>
            data-testid="taxonomy.tags.table"
            columns={columns}
            rows={tags}
            getKey={(tag) => tag.id}
            onSort={onSort}
            renderActions={(tag) => (
              <TagRowActions
                tag={tag}
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
