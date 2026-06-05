import { Box, Alert, Stack, Chip } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useState, useCallback } from 'react';
import { getTrash, permanentDeleteTrashItem, restoreTrashItem } from '@/services/sites';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import {
  PageHeader,
  DataTableV2,
  type DataTableV2Column,
  RowActionBtn,
  ActionMenu,
  type ActionMenuItem,
  Pagination,
} from '@/components/shared/listPageV2';
import { M3Button, Icon } from '@/components/design-system';

const TYPE_ICONS: Record<string, string> = {
  blog: 'article',
  page: 'description',
  project: 'work',
  cv_entry: 'badge',
  skill: 'psychology',
  media: 'image',
  document: 'insert_drive_file',
  legal: 'gavel',
  social: 'share',
  menu: 'menu',
  menu_item: 'segment',
};

const TYPE_COLORS: Record<string, string> = {
  blog: '#b8a4ff',
  page: '#8ec5ff',
  project: '#9fd8c4',
  cv_entry: '#a4b8ff',
  skill: '#ffcf8a',
  media: '#ffc98a',
  document: '#7edac6',
  legal: '#ff9e9e',
  social: '#ff9e9e',
  menu: '#a59fb0',
  menu_item: '#a59fb0',
};

interface TrashItem {
  id: string;
  entity_type: string;
  title?: string | null;
  slug?: string | null;
  deleted_at?: string | null;
}

function daysUntilPurge(deletedAt: string | null | undefined): number {
  if (!deletedAt) return 30;
  const deleted = new Date(deletedAt);
  const purgeDate = new Date(deleted.getTime() + 30 * 24 * 60 * 60 * 1000);
  const now = new Date();
  return Math.max(0, Math.ceil((purgeDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}

function TrashRowActions({
  item,
  isAdmin,
  busy,
  onRestore,
  onDeleteOne,
}: {
  item: TrashItem;
  isAdmin: boolean;
  busy: boolean;
  onRestore: (i: TrashItem) => void;
  onDeleteOne: (i: TrashItem) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const items: ActionMenuItem[] = [
    {
      icon: 'restore',
      label: t('trash.restore'),
      disabled: busy,
      onClick: () => onRestore(item),
    },
    ...(isAdmin
      ? [
          {
            icon: 'delete_forever',
            label: t('trash.permanentDelete'),
            danger: true,
            onClick: () => onDeleteOne(item),
          },
        ]
      : []),
  ];

  return (
    <div style={{ position: 'relative' }}>
      <RowActionBtn
        open={open}
        ariaLabel={t('common.table.actions')}
        data-testid={`trash.actions.${item.id}`}
        onClick={() => setOpen((p) => !p)}
      />
      {open && <ActionMenu items={items} onClose={() => setOpen(false)} />}
    </div>
  );
}

export default function TrashPage() {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const { selectedSiteId } = useSiteContext();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<'delete' | 'deleteAll' | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [prevSiteId, setPrevSiteId] = useState(selectedSiteId);

  // Reset to the first page when the active site changes. Adjusting state
  // during render is React's recommended alternative to a syncing effect — it
  // runs before the query fires, so we never fetch a stale page for the new
  // site.
  if (selectedSiteId !== prevSiteId) {
    setPrevSiteId(selectedSiteId);
    setPage(1);
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['trash', selectedSiteId, page, pageSize],
    queryFn: () => getTrash(selectedSiteId, page, pageSize),
    enabled: !!selectedSiteId,
    placeholderData: keepPreviousData,
  });

  const items: TrashItem[] = data?.items ?? [];
  const total = data?.total ?? 0;

  const changePageSize = useCallback((next: number) => {
    setPageSize(next);
    setPage(1);
  }, []);

  const invalidateTrash = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['trash', selectedSiteId] });
    queryClient.invalidateQueries({ queryKey: ['trash-count', selectedSiteId] });
    queryClient.invalidateQueries({ queryKey: ['blogs'] });
    queryClient.invalidateQueries({ queryKey: ['pages'] });
    queryClient.invalidateQueries({ queryKey: ['media'] });
    queryClient.invalidateQueries({ queryKey: ['documents'] });
    queryClient.invalidateQueries({ queryKey: ['legal'] });
    queryClient.invalidateQueries({ queryKey: ['social-links'] });
    queryClient.invalidateQueries({ queryKey: ['navigation-menus'] });
    queryClient.invalidateQueries({ queryKey: ['navigation-items'] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['cv-entries'] });
    queryClient.invalidateQueries({ queryKey: ['skills'] });
  }, [queryClient, selectedSiteId]);

  const restoreMutation = useMutation({
    mutationFn: async (targets: { id: string; entityType: string }[]) => {
      await Promise.all(
        targets.map(({ id, entityType }) => restoreTrashItem(id, entityType)),
      );
    },
    onSuccess: (_data, targets) => {
      invalidateTrash();
      setSelected((prev) => {
        const next = new Set(prev);
        targets.forEach(({ id }) => next.delete(id));
        return next;
      });
      showSuccess(t('trash.restored'));
    },
    onError: (err) => showError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: async (targets: { id: string; entityType: string }[]) => {
      await Promise.all(
        targets.map(({ id, entityType }) => permanentDeleteTrashItem(id, entityType)),
      );
    },
    onSuccess: () => {
      invalidateTrash();
      setSelected(new Set());
      setConfirmAction(null);
      showSuccess(t('trash.deleted'));
    },
    onError: (err) => {
      setConfirmAction(null);
      showError(err);
    },
  });

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectAll = (next: boolean) => {
    if (next) setSelected(new Set(items.map((i) => i.id)));
    else setSelected(new Set());
  };

  const toTargets = (ids: Iterable<string>) =>
    [...ids].map((id) => {
      const item = items.find((i) => i.id === id);
      return { id, entityType: item?.entity_type ?? 'content' };
    });

  const handleBatchRestore = () => restoreMutation.mutate(toTargets(selected));
  const handleBatchDelete = () => setConfirmAction('delete');
  const handleDeleteAll = () => setConfirmAction('deleteAll');

  const executeConfirmedDelete = () => {
    if (confirmAction === 'deleteAll') {
      deleteMutation.mutate(items.map((i) => ({ id: i.id, entityType: i.entity_type })));
    } else {
      deleteMutation.mutate(toTargets(selected));
    }
  };

  const isBusy = restoreMutation.isPending || deleteMutation.isPending;

  if (isLoading) return <LoadingState />;
  if (error) return <Alert severity="error">{t('common.errors.loadFailed')}</Alert>;

  const columns: DataTableV2Column<TrashItem>[] = [
    {
      key: 'name',
      label: t('common.table.name'),
      width: '1.4fr',
      render: (item) => {
        const iconName = TYPE_ICONS[item.entity_type] ?? 'inventory_2';
        const color = TYPE_COLORS[item.entity_type] ?? 'var(--on-surface-variant)';
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span
              aria-hidden="true"
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: color + '26',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name={iconName} size={16} color={color} />
            </span>
            <span
              style={{
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.title || item.slug || item.id}
            </span>
          </span>
        );
      },
    },
    {
      key: 'type',
      label: t('common.table.type'),
      width: '120px',
      render: (item) => (
        <Chip label={t(`trash.type.${item.entity_type}`)} size="small" variant="outlined" />
      ),
    },
    {
      key: 'deleted_at',
      label: t('trash.columnDeleted'),
      width: '160px',
      muted: true,
      render: (item) => (item.deleted_at ? fmt(item.deleted_at, 'PPp') : '\u2014'),
    },
    {
      key: 'purge',
      label: t('trash.columnAutoPurge'),
      width: '140px',
      render: (item) => {
        const days = daysUntilPurge(item.deleted_at);
        return (
          <Chip
            label={t('trash.daysRemaining', { days })}
            size="small"
            color={days <= 7 ? 'warning' : 'default'}
          />
        );
      },
    },
  ];

  const headerActions = isAdmin && items.length > 0 ? (
    <M3Button
      variant="filled"
      size="md"
      icon="delete_sweep"
      danger
      onClick={handleDeleteAll}
      disabled={isBusy}
      data-testid="trash.delete-all"
    >
      {t('trash.emptyTrash')}
    </M3Button>
  ) : undefined;

  return (
    <Box data-testid="trash.page">
      <PageHeader
        icon="delete"
        breadcrumb={t('trash.title')}
        title={t('trash.title')}
        subtitle={t('trash.subtitle')}
        actions={headerActions}
      />

      {total === 0 ? (
        <EmptyState icon={<DeleteOutlineIcon sx={{ fontSize: 48 }} />} title={t('trash.empty')} />
      ) : (
        <>
          {selected.size > 0 && (
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <M3Button
                variant="outlined"
                size="sm"
                icon="restore"
                onClick={handleBatchRestore}
                disabled={isBusy}
                data-testid="trash.batch-restore"
              >
                {t('trash.restore')} ({selected.size})
              </M3Button>
              {isAdmin && (
                <M3Button
                  variant="outlined"
                  size="sm"
                  icon="delete_forever"
                  danger
                  onClick={handleBatchDelete}
                  disabled={isBusy}
                  data-testid="trash.batch-delete"
                >
                  {t('trash.permanentDelete')} ({selected.size})
                </M3Button>
              )}
            </Stack>
          )}

          <DataTableV2<TrashItem>
            data-testid="trash.table"
            columns={columns}
            rows={items}
            getKey={(item) => item.id}
            selected={selected}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleSelectAll}
            renderActions={(item) => (
              <TrashRowActions
                item={item}
                isAdmin={isAdmin}
                busy={isBusy}
                onRestore={(i) =>
                  restoreMutation.mutate([{ id: i.id, entityType: i.entity_type }])
                }
                onDeleteOne={(i) => {
                  setSelected(new Set([i.id]));
                  setConfirmAction('delete');
                }}
              />
            )}
          />

          <Pagination
            total={total}
            page={page}
            perPage={pageSize}
            onPage={setPage}
            onPerPage={changePageSize}
          />
        </>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction === 'deleteAll' ? t('trash.emptyTrash') : t('trash.permanentDelete')}
        message={
          confirmAction === 'deleteAll'
            ? t('trash.emptyTrashConfirm', { count: items.length })
            : t('trash.permanentDeleteConfirm')
        }
        confirmLabel={
          confirmAction === 'deleteAll' ? t('trash.emptyTrash') : t('trash.permanentDelete')
        }
        onConfirm={executeConfirmedDelete}
        onCancel={() => setConfirmAction(null)}
        loading={deleteMutation.isPending}
      />
    </Box>
  );
}
