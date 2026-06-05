import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Box, Alert, Tooltip } from '@mui/material';
import { keepPreviousData } from '@tanstack/react-query';
import { useLocalizedFormat, useLocalizedDistanceToNow } from '@/utils/dateFnsLocale';
import RateReviewIcon from '@mui/icons-material/RateReview';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { deleteNotification, deleteReadNotifications, getNotificationStatusCounts, getNotifications, markAllNotificationsRead, markNotificationRead } from '@/services/notifications';
import { useSiteContext } from '@/store/SiteContext';
import { useListPageState } from '@/hooks/useListPageState';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import {
  PageHeader,
  Toolbar,
  ToolbarSpacer,
  SearchField,
  DataTableV2,
  type DataTableV2Column,
  Pagination,
} from '@/components/shared/listPageV2';
import { Chip, M3Button, M3IconButton } from '@/components/design-system';
import type { NotificationResponse, NotificationType } from '@/types/api';

type ReadFilter = 'all' | 'unread' | 'read';

function typeIcon(type: NotificationType) {
  switch (type) {
    case 'content_submitted':
      return <RateReviewIcon fontSize="small" sx={{ color: 'var(--info)' }} />;
    case 'content_approved':
      return <CheckCircleIcon fontSize="small" sx={{ color: 'var(--on-tertiary-container)' }} />;
    case 'changes_requested':
      return <EditIcon fontSize="small" sx={{ color: 'var(--on-warn-container)' }} />;
    default:
      return <InfoOutlinedIcon fontSize="small" sx={{ color: 'var(--on-surface-variant)' }} />;
  }
}

function typeLabel(type: NotificationType, t: (key: string) => string): string {
  switch (type) {
    case 'content_submitted':
      return t('notifications.types.submitted');
    case 'content_approved':
      return t('notifications.types.approved');
    case 'changes_requested':
      return t('notifications.types.changesRequested');
    default:
      return t('notifications.types.system');
  }
}

function StatusPillLocal({ isRead, label }: { isRead: boolean; label: string }) {
  const bg = isRead
    ? 'var(--surface-container-high)'
    : 'color-mix(in srgb, var(--primary) 16%, transparent)';
  const fg = isRead ? 'var(--on-surface-variant)' : 'var(--primary)';
  const border = isRead
    ? '1px solid var(--outline-variant)'
    : '1px solid color-mix(in srgb, var(--primary) 45%, transparent)';
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1.1,
        height: 22,
        borderRadius: '999px',
        bgcolor: bg,
        color: fg,
        border,
        fontSize: 11,
        fontWeight: 600,
        fontVariationSettings: '"wght" 600, "opsz" 11',
        letterSpacing: 0.3,
      }}
    >
      {label}
    </Box>
  );
}

function TypePillLocal({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        height: 24,
        borderRadius: '999px',
        bgcolor: 'var(--surface-container-high)',
        color: 'var(--on-surface)',
        border: '1px solid var(--outline-variant)',
        fontSize: 11,
        fontWeight: 600,
        fontVariationSettings: '"wght" 600, "opsz" 11',
      }}
    >
      {icon}
      {label}
    </Box>
  );
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const distanceToNow = useLocalizedDistanceToNow();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedSiteId } = useSiteContext();
  const { showError, showSuccess } = useErrorSnackbar();
  const {
    page,
    setPage,
    pageSize,
    search,
    setSearch,
    debouncedSearch,
    sortBy,
    sortDir,
    handleSort,
    handleRowsPerPageChange,
  } = useListPageState();

  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [deleteReadOpen, setDeleteReadOpen] = useState(false);

  const isReadParam =
    readFilter === 'all' ? undefined : readFilter === 'read';

  const { data, isLoading } = useQuery({
    queryKey: [
      'notifications',
      selectedSiteId,
      page,
      pageSize,
      debouncedSearch,
      sortBy,
      sortDir,
      readFilter,
    ],
    queryFn: () =>
      getNotifications(selectedSiteId!, {
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
        sort_by: sortBy || undefined,
        sort_dir: sortBy ? sortDir : undefined,
        is_read: isReadParam,
      }),
    enabled: !!selectedSiteId,
    placeholderData: keepPreviousData,
  });

  const { data: counts } = useQuery({
    queryKey: ['notifications-status-counts', selectedSiteId],
    queryFn: () => getNotificationStatusCounts(selectedSiteId!),
    enabled: !!selectedSiteId,
    placeholderData: keepPreviousData,
  });

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['notifications', selectedSiteId] });
    queryClient.invalidateQueries({ queryKey: ['notifications-unread', selectedSiteId] });
    queryClient.invalidateQueries({ queryKey: ['notifications-status-counts', selectedSiteId] });
  }, [queryClient, selectedSiteId]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: invalidateAll,
    onError: showError,
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(selectedSiteId!),
    onSuccess: invalidateAll,
    onError: showError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () => {
      invalidateAll();
      showSuccess(t('notifications.messages.deleted'));
    },
    onError: showError,
  });

  const deleteReadMutation = useMutation({
    mutationFn: () => deleteReadNotifications(selectedSiteId!),
    onSuccess: (resp) => {
      invalidateAll();
      setDeleteReadOpen(false);
      showSuccess(t('notifications.messages.readCleared', { count: resp.deleted }));
    },
    onError: showError,
  });

  const handleRowClick = useCallback(
    (notification: NotificationResponse) => {
      if (!notification.is_read) {
        markReadMutation.mutate(notification.id);
      }
      if (notification.entity_type === 'blog') {
        navigate(`/blogs/${notification.entity_id}`);
      } else if (notification.entity_type === 'page') {
        navigate(`/pages/${notification.entity_id}`);
      }
    },
    [markReadMutation, navigate],
  );

  if (!selectedSiteId) {
    return (
      <Box data-testid="notifications.page">
        <PageHeader
          icon="notifications"
          title={t('notifications.pageTitle')}
          subtitle={t('notifications.pageSubtitle')}
        />
        <Alert severity="info">{t('notifications.noSite')}</Alert>
      </Box>
    );
  }

  const notifications = data?.data ?? [];
  const total = data?.meta?.total_items ?? 0;
  const readCount = counts?.read ?? 0;
  const unreadCount = counts?.unread ?? 0;
  const allCount = readCount + unreadCount;

  const headerActions = (
    <>
      {readCount > 0 && (
        <M3Button
          variant="outlined"
          size="md"
          icon="delete_sweep"
          danger
          onClick={() => setDeleteReadOpen(true)}
        >
          {t('notifications.actions.deleteRead')}
        </M3Button>
      )}
      {unreadCount > 0 && (
        <M3Button
          variant="filled"
          size="md"
          icon="done_all"
          onClick={() => markAllReadMutation.mutate()}
          disabled={markAllReadMutation.isPending}
        >
          {t('notifications.markAllRead')}
        </M3Button>
      )}
    </>
  );

  const sortedDir = (k: string): 'asc' | 'desc' | undefined =>
    sortBy === k ? sortDir : undefined;

  const columns: DataTableV2Column<NotificationResponse>[] = [
    {
      key: 'notification_type',
      label: t('notifications.columns.type'),
      width: '150px',
      sorted: sortedDir('notification_type'),
      render: (n) => (
        <TypePillLocal
          icon={typeIcon(n.notification_type)}
          label={typeLabel(n.notification_type, t)}
        />
      ),
    },
    {
      key: 'title',
      label: t('notifications.columns.title'),
      width: '1fr',
      render: (n) => (
        <Box
          component="span"
          sx={{
            fontSize: 14,
            fontWeight: n.is_read ? 500 : 700,
            color: 'var(--on-surface)',
          }}
        >
          {n.title}
        </Box>
      ),
    },
    {
      key: 'message',
      label: t('notifications.columns.message'),
      width: '1fr',
      muted: true,
      render: (n) => (
        <Box
          component="span"
          sx={{
            fontSize: 13,
            color: 'var(--on-surface-variant)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
          }}
        >
          {n.message || '—'}
        </Box>
      ),
    },
    {
      key: 'created_at',
      label: t('notifications.columns.time'),
      width: '160px',
      muted: true,
      sorted: sortedDir('created_at'),
      render: (n) => (
        <Tooltip title={fmt(n.created_at, 'PPpp')} arrow>
          <span>{distanceToNow(n.created_at, { addSuffix: true })}</span>
        </Tooltip>
      ),
    },
    {
      key: 'status',
      label: t('notifications.columns.status'),
      width: '120px',
      render: (n) => (
        <StatusPillLocal
          isRead={n.is_read}
          label={n.is_read ? t('notifications.read') : t('notifications.unread')}
        />
      ),
    },
  ];

  return (
    <Box data-testid="notifications.page">
      <PageHeader
        icon="notifications"
        breadcrumb={t('notifications.pageTitle')}
        title={t('notifications.pageTitle')}
        subtitle={t('notifications.pageSubtitle')}
        actions={headerActions}
      />

      {isLoading && notifications.length === 0 ? (
        <LoadingState />
      ) : (
        <>
          <Toolbar>
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder={t('notifications.searchPlaceholder')}
              width={320}
              data-testid="notifications-search"
            />
            <ToolbarSpacer />
            <Chip
              active={readFilter === 'all'}
              count={allCount}
              onClick={() => {
                setReadFilter('all');
                setPage(() => 1);
              }}
            >
              {t('notifications.filters.all')}
            </Chip>
            <Chip
              active={readFilter === 'unread'}
              count={unreadCount}
              onClick={() => {
                setReadFilter('unread');
                setPage(() => 1);
              }}
            >
              {t('notifications.filters.unread')}
            </Chip>
            <Chip
              active={readFilter === 'read'}
              count={readCount}
              onClick={() => {
                setReadFilter('read');
                setPage(() => 1);
              }}
            >
              {t('notifications.filters.read')}
            </Chip>
          </Toolbar>

          {notifications.length === 0 ? (
            <EmptyState title={t('notifications.empty')} />
          ) : (
            <>
              <DataTableV2<NotificationResponse>
                data-testid="notifications.table"
                columns={columns}
                rows={notifications}
                getKey={(n) => n.id}
                onRowClick={handleRowClick}
                onSort={handleSort}
                renderActions={(n) => (
                  <M3IconButton
                    name="delete"
                    size={32}
                    tooltip={t('notifications.actions.delete')}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(n.id);
                    }}
                  />
                )}
              />
              <Pagination
                total={total}
                page={page}
                perPage={pageSize}
                onPage={setPage}
                onPerPage={(n) => handleRowsPerPageChange({ target: { value: String(n) } } as never)}
              />
            </>
          )}
        </>
      )}

      <ConfirmDialog
        open={deleteReadOpen}
        title={t('notifications.actions.confirmDeleteReadTitle')}
        message={t('notifications.actions.confirmDeleteReadMessage', { count: readCount })}
        confirmLabel={t('notifications.actions.confirmDeleteReadConfirm', { count: readCount })}
        confirmColor="error"
        onConfirm={() => deleteReadMutation.mutate()}
        onCancel={() => setDeleteReadOpen(false)}
        loading={deleteReadMutation.isPending}
      />
    </Box>
  );
}
