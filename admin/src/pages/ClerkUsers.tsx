import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { Avatar, Box, CircularProgress, Tooltip } from '@mui/material';
import { deleteBannedUser, getClerkUsers, unsuspendUser } from '@/services/clerkUsers';
import { useAuth } from '@/store/AuthContext';
import type { ClerkUser } from '@/types/api';
import SuspendUserDialog from '@/pages/system/SuspendUserDialog';
import BanUserDialog from '@/pages/system/BanUserDialog';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import {
  DataTableV2,
  Pagination,
  RowActionBtn,
  ActionMenu,
  type DataTableV2Column,
  type ActionMenuItem,
} from '@/components/shared/listPageV2';
import { queryKeys } from '@/lib/queryKeys';

function formatTimestamp(ts?: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function StatusPill({ status }: { status: ClerkUser['moderation_status'] }) {
  const paint =
    status === 'banned'
      ? { bg: 'color-mix(in oklch, var(--err) 18%, transparent)', fg: 'var(--err)' }
      : status === 'suspended'
        ? { bg: 'var(--warn-container)', fg: 'var(--on-warn-container)' }
        : { bg: 'var(--tertiary-container)', fg: 'var(--on-tertiary-container)' };
  return (
    <Box
      component="span"
      data-testid="clerk-users.status-badge"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1.25,
        height: 22,
        borderRadius: '999px',
        bgcolor: paint.bg,
        color: paint.fg,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.3,
        fontVariationSettings: '"wght" 600, "opsz" 11',
        textTransform: 'capitalize',
      }}
    >
      {status}
    </Box>
  );
}

export default function ClerkUsersPage() {
  const { t } = useTranslation();
  const { isMaster } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ kind: 'suspend' | 'ban' | 'delete'; user: ClerkUser } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.clerkUsers(page, rowsPerPage),
    queryFn: () => getClerkUsers({ limit: rowsPerPage, offset: (page - 1) * rowsPerPage }),
  });

  const unsuspendMutation = useMutation({
    mutationFn: (userId: string) => unsuspendUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clerkUsers() });
      enqueueSnackbar(t('system.users.unsuspend.success'), { variant: 'success' });
    },
    onError: () => enqueueSnackbar(t('system.users.unsuspend.error'), { variant: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteBannedUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clerkUsers() });
      enqueueSnackbar(t('system.users.delete.success'), { variant: 'success' });
      setDialog(null);
    },
    onError: () => enqueueSnackbar(t('system.users.delete.error'), { variant: 'error' }),
  });

  const buildMenuItems = useCallback(
    (user: ClerkUser): ActionMenuItem[] => {
      const items: ActionMenuItem[] = [];
      if (user.moderation_status === 'active') {
        items.push({
          icon: 'pause_circle',
          label: t('system.users.actions.suspend'),
          onClick: () => setDialog({ kind: 'suspend', user }),
        });
      }
      if (user.moderation_status !== 'banned') {
        items.push({
          icon: 'block',
          label: t('system.users.actions.ban'),
          onClick: () => setDialog({ kind: 'ban', user }),
          danger: true,
        });
      }
      if (user.moderation_status === 'suspended') {
        items.push({
          icon: 'check_circle',
          label: t('system.users.actions.unsuspend'),
          onClick: () => unsuspendMutation.mutate(user.id),
        });
      }
      if (user.moderation_status === 'banned') {
        items.push({
          icon: 'delete_forever',
          label: t('system.users.actions.delete'),
          onClick: () => setDialog({ kind: 'delete', user }),
          danger: true,
        });
      }
      return items;
    },
    [t, unsuspendMutation],
  );

  const columns: DataTableV2Column<ClerkUser>[] = [
    {
      key: 'user',
      label: t('system.users.columns.user'),
      width: 'minmax(220px, 1.5fr)',
      render: (user) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Avatar src={user.image_url || undefined} alt={user.name} sx={{ width: 32, height: 32 }} />
          <Box
            component="span"
            sx={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}
          >
            {user.name}
          </Box>
        </Box>
      ),
    },
    {
      key: 'email',
      label: t('system.users.columns.email'),
      width: 'minmax(220px, 2fr)',
      muted: true,
      render: (user) => user.email || '—',
    },
    {
      key: 'status',
      label: t('system.users.columns.status'),
      width: 'minmax(140px, 1fr)',
      render: (user) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StatusPill status={user.moderation_status} />
          {user.moderation_reason && (
            <Tooltip title={user.moderation_reason} arrow>
              <Box
                component="span"
                sx={{
                  maxWidth: 160,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 12,
                  color: 'var(--on-surface-variant)',
                }}
              >
                {user.moderation_reason}
              </Box>
            </Tooltip>
          )}
        </Box>
      ),
    },
    {
      key: 'lastSignIn',
      label: t('system.users.columns.lastSignIn'),
      width: '140px',
      muted: true,
      render: (user) => formatTimestamp(user.last_sign_in_at),
    },
  ];

  const renderActions = isMaster
    ? (user: ClerkUser) => {
        const items = buildMenuItems(user);
        if (items.length === 0) return null;
        return (
          <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'inline-flex' }}>
            <RowActionBtn
              open={menuOpenId === user.id}
              onClick={() => setMenuOpenId((prev) => (prev === user.id ? null : user.id))}
              ariaLabel={t('common.actions.more', 'More')}
              data-testid="clerk-users.action-menu"
            />
            {menuOpenId === user.id && (
              <ActionMenu
                items={items}
                onClose={() => setMenuOpenId(null)}
                data-testid="clerk-users.action-menu.popup"
              />
            )}
          </Box>
        );
      }
    : undefined;

  return (
    <Box data-testid="clerk-users.page">
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <>
          <DataTableV2<ClerkUser>
            columns={columns}
            rows={data?.data ?? []}
            getKey={(user) => user.id}
            onRowClick={(user) => navigate(`/system/users/${user.id}`)}
            renderActions={renderActions}
            emptyMessage={t('common.table.noData')}
            data-testid="clerk-users-table"
          />

          {data?.total_count ? (
            <Pagination
              total={data.total_count}
              page={page}
              perPage={rowsPerPage}
              onPage={setPage}
              onPerPage={(n) => {
                setRowsPerPage(n);
                setPage(1);
              }}
              options={[10, 20, 50]}
            />
          ) : null}
        </>
      )}

      {dialog?.kind === 'suspend' && (
        <SuspendUserDialog
          open
          onClose={() => setDialog(null)}
          userId={dialog.user.id}
          userName={dialog.user.name}
        />
      )}
      {dialog?.kind === 'ban' && (
        <BanUserDialog
          open
          onClose={() => setDialog(null)}
          userId={dialog.user.id}
          userName={dialog.user.name}
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          open
          title={`${t('system.users.delete.title')}: ${dialog.user.name}`}
          message={`${t('system.users.delete.warning')}\n\n${t('system.users.delete.consequences')}`}
          confirmLabel={t('system.users.delete.confirm')}
          confirmColor="error"
          onConfirm={() => deleteMutation.mutate(dialog.user.id)}
          onCancel={() => setDialog(null)}
          loading={deleteMutation.isPending}
          confirmationText={t('common.actions.delete')}
        />
      )}
    </Box>
  );
}
