import { useReducer, useEffect, useState } from 'react';
import {
  Box,
  Avatar,
  Chip,
  MenuItem,
  TextField,
  Typography,
  Stack,
  Paper,
  ListItemText,
} from '@mui/material';
import FormDialog from '@/components/shared/FormDialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import { getClerkUsers } from '@/services/clerkUsers';
import { addSiteMember, getSiteMembers, removeSiteMember, transferOwnership, updateMemberRole } from '@/services/members';
import { leaveSite } from '@/services/sites';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type { SiteMembership, SiteRole, ClerkUser } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import {
  DataTableV2,
  type DataTableV2Column,
  RowActionBtn,
  ActionMenu,
  type ActionMenuItem,
} from '@/components/shared/listPageV2';
import { SectionHead, M3Button } from '@/components/design-system';

const ROLES: SiteRole[] = ['owner', 'admin', 'editor', 'author', 'reviewer', 'viewer'];

function roleColor(
  role: SiteRole,
): 'error' | 'warning' | 'info' | 'success' | 'default' {
  switch (role) {
    case 'owner':
      return 'error';
    case 'admin':
      return 'warning';
    case 'editor':
      return 'info';
    case 'author':
      return 'success';
    default:
      return 'default';
  }
}

interface UIState {
  addOpen: boolean;
  addRole: SiteRole;
  addClerkUserId: string;
  clerkSearch: string;
  leaveOpen: boolean;
  removingMember: SiteMembership | null;
  transferTarget: SiteMembership | null;
}

type UIAction =
  | { type: 'openAdd' }
  | { type: 'closeAdd' }
  | { type: 'setAddRole'; value: SiteRole }
  | { type: 'setAddClerkUserId'; value: string }
  | { type: 'setClerkSearch'; value: string }
  | { type: 'resetAddForm' }
  | { type: 'openLeave' }
  | { type: 'closeLeave' }
  | { type: 'openRemove'; member: SiteMembership }
  | { type: 'closeRemove' }
  | { type: 'openTransfer'; member: SiteMembership }
  | { type: 'closeTransfer' };

const initialUIState: UIState = {
  addOpen: false,
  addRole: 'viewer',
  addClerkUserId: '',
  clerkSearch: '',
  leaveOpen: false,
  removingMember: null,
  transferTarget: null,
};

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'openAdd':
      return { ...state, addOpen: true };
    case 'closeAdd':
      return { ...state, addOpen: false };
    case 'setAddRole':
      return { ...state, addRole: action.value };
    case 'setAddClerkUserId':
      return { ...state, addClerkUserId: action.value };
    case 'setClerkSearch':
      return { ...state, clerkSearch: action.value };
    case 'resetAddForm':
      return { ...state, addOpen: false, addClerkUserId: '', addRole: 'viewer' };
    case 'openLeave':
      return { ...state, leaveOpen: true };
    case 'closeLeave':
      return { ...state, leaveOpen: false };
    case 'openRemove':
      return { ...state, removingMember: action.member };
    case 'closeRemove':
      return { ...state, removingMember: null };
    case 'openTransfer':
      return { ...state, transferTarget: action.member };
    case 'closeTransfer':
      return { ...state, transferTarget: null };
    default:
      return state;
  }
}

function MemberActionsCell({
  member,
  isOwner,
  isSelf,
  onRemove,
  onTransfer,
}: {
  member: SiteMembership;
  isOwner: boolean;
  isSelf: boolean;
  onRemove: (m: SiteMembership) => void;
  onTransfer: (m: SiteMembership) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (member.role === 'owner') return null;

  const items: ActionMenuItem[] = [
    ...(isOwner && !isSelf
      ? [
          {
            icon: 'swap_horiz',
            label: t('members.transferDialog.title'),
            onClick: () => onTransfer(member),
          },
        ]
      : []),
    {
      icon: 'delete',
      label: t('common.actions.delete'),
      danger: true,
      onClick: () => onRemove(member),
    },
  ];

  return (
    <div style={{ position: 'relative' }}>
      <RowActionBtn
        open={open}
        ariaLabel={t('common.table.actions')}
        data-testid="member-actions.btn.menu"
        onClick={() => setOpen((p) => !p)}
      />
      {open && <ActionMenu items={items} onClose={() => setOpen(false)} />}
    </div>
  );
}

export default function MembersPage() {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const { selectedSiteId, selectedSite } = useSiteContext();
  const { canManageMembers, isOwner, clerkUserId } = useAuth();

  const [ui, dispatch] = useReducer(uiReducer, initialUIState);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'add-member') dispatch({ type: 'openAdd' });
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, []);

  const { data: clerkUsers } = useQuery({
    queryKey: ['clerkUsers'],
    queryFn: () => getClerkUsers({ limit: 100 }),
    enabled: ui.addOpen,
  });

  const { data: members, isLoading, error } = useQuery({
    queryKey: ['members', selectedSiteId],
    queryFn: () => getSiteMembers(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const addMemberMutation = useMutation({
    mutationFn: () =>
      addSiteMember(selectedSiteId, {
        clerk_user_id: ui.addClerkUserId,
        role: ui.addRole,
      }),
    onSuccess: () => {
      showSuccess(t('members.messages.added'));
      queryClient.invalidateQueries({ queryKey: ['members', selectedSiteId] });
      dispatch({ type: 'resetAddForm' });
    },
    onError: (err) => {
      showError(err);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: SiteRole }) =>
      updateMemberRole(selectedSiteId, memberId, { role }),
    onSuccess: () => {
      showSuccess(t('members.messages.roleUpdated'));
      queryClient.invalidateQueries({ queryKey: ['members', selectedSiteId] });
    },
    onError: (err) => {
      showError(err);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => removeSiteMember(selectedSiteId, memberId),
    onSuccess: () => {
      showSuccess(t('members.messages.removed'));
      queryClient.invalidateQueries({ queryKey: ['members', selectedSiteId] });
      dispatch({ type: 'closeRemove' });
    },
    onError: (err) => {
      showError(err);
    },
  });

  const transferMutation = useMutation({
    mutationFn: (newOwnerClerkUserId: string) =>
      transferOwnership(selectedSiteId, {
        new_owner_clerk_user_id: newOwnerClerkUserId,
      }),
    onSuccess: () => {
      showSuccess(t('members.messages.ownershipTransferred'));
      queryClient.invalidateQueries({ queryKey: ['members', selectedSiteId] });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      dispatch({ type: 'closeTransfer' });
    },
    onError: (err) => {
      showError(err);
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveSite(selectedSiteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      navigate('/sites');
    },
    onError: (err) => {
      showError(err);
    },
  });

  if (!selectedSiteId) {
    return (
      <Box data-testid="members.page">
        <SectionHead icon="group" title={t('members.title')} subtitle={t('members.subtitle')} />
        <EmptyState title={t('members.empty.noSite')} />
      </Box>
    );
  }

  if (isLoading) return <LoadingState label={t('members.loading')} />;
  if (error) return <EmptyState title={t('members.loadError')} />;

  const filteredClerkUsers = (clerkUsers?.data ?? []).filter((u: ClerkUser) => {
    const existing = new Set(members?.map((m) => m.clerk_user_id) ?? []);
    if (existing.has(u.id)) return false;
    if (!ui.clerkSearch) return true;
    const q = ui.clerkSearch.toLowerCase();
    return (
      u.id.toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.name ?? '').toLowerCase().includes(q)
    );
  });

  const columns: DataTableV2Column<SiteMembership>[] = [
    {
      key: 'name',
      label: t('members.table.name'),
      width: '1.4fr',
      render: (m) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <Avatar src={m.image_url || undefined} sx={{ width: 32, height: 32 }}>
            {(m.name ?? '?')[0]}
          </Avatar>
          <span
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontWeight: 500,
            }}
          >
            {m.name || m.clerk_user_id.slice(0, 12)}
          </span>
        </span>
      ),
    },
    {
      key: 'email',
      label: t('members.table.email'),
      width: '1fr',
      muted: true,
      render: (m) => m.email || '\u2014',
    },
    {
      key: 'role',
      label: t('members.table.role'),
      width: '180px',
      render: (m) => {
        if (canManageMembers && m.role !== 'owner') {
          return (
            <TextField
              select
              size="small"
              value={m.role}
              onChange={(e) =>
                updateRoleMutation.mutate({
                  memberId: m.id,
                  role: e.target.value as SiteRole,
                })
              }
              sx={{
                minWidth: 140,
                '& .MuiOutlinedInput-root': { borderRadius: 999 },
              }}
              data-testid="role-selector"
            >
              {ROLES.filter((r) => isOwner || (r !== 'owner' && r !== 'admin')).map((r) => (
                <MenuItem key={r} value={r}>
                  {t(`members.roles.${r}`)}
                </MenuItem>
              ))}
            </TextField>
          );
        }
        return (
          <Chip label={t(`members.roles.${m.role}`)} color={roleColor(m.role)} size="small" />
        );
      },
    },
    {
      key: 'created_at',
      label: t('members.table.joined'),
      width: '120px',
      muted: true,
      render: (m) => fmt(m.created_at, 'PP'),
    },
  ];

  const actions = (
    <Stack direction="row" spacing={1}>
      {!isOwner && (
        <M3Button
          variant="outlined"
          size="md"
          icon="logout"
          danger
          onClick={() => dispatch({ type: 'openLeave' })}
          data-testid="leave-site"
        >
          {t('members.leaveSite')}
        </M3Button>
      )}
      {canManageMembers && (
        <M3Button
          size="md"
          icon="person_add"
          onClick={() => dispatch({ type: 'openAdd' })}
          data-testid="add-member"
        >
          {t('members.addMember')}
        </M3Button>
      )}
    </Stack>
  );

  return (
    <Box data-testid="members.page">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <SectionHead
          icon="group"
          title={t('members.title')}
          subtitle={t('members.subtitle')}
        />
        <Box sx={{ mt: 0.5 }}>{actions}</Box>
      </Box>

      {!members?.length ? (
        <EmptyState
          title={t('members.empty.title')}
          description={t('members.empty.description')}
        />
      ) : (
        <DataTableV2<SiteMembership>
          data-testid="members.table"
          columns={columns}
          rows={members}
          getKey={(m) => m.id}
          renderActions={
            canManageMembers
              ? (m) => (
                  <MemberActionsCell
                    member={m}
                    isOwner={isOwner}
                    isSelf={m.clerk_user_id === clerkUserId}
                    onRemove={(mem) => dispatch({ type: 'openRemove', member: mem })}
                    onTransfer={(mem) => dispatch({ type: 'openTransfer', member: mem })}
                  />
                )
              : undefined
          }
        />
      )}

      {/* Add Member Dialog */}
      <FormDialog
        open={ui.addOpen}
        onClose={() => dispatch({ type: 'closeAdd' })}
        onSubmit={() => addMemberMutation.mutate()}
        icon="person_add"
        title={t('members.addDialog.title')}
        submitLabel={t('common.actions.add')}
        submitDisabled={!ui.addClerkUserId}
        submitTestId="invite-submit"
        loading={addMemberMutation.isPending}
      >
        <TextField
          autoFocus
          label={t('members.addDialog.searchPlaceholder')}
          value={ui.clerkSearch}
          onChange={(e) => dispatch({ type: 'setClerkSearch', value: e.target.value })}
          size="small"
          fullWidth
        />
        <TextField
          label={t('members.addDialog.selectRole')}
          select
          value={ui.addRole}
          onChange={(e) => dispatch({ type: 'setAddRole', value: e.target.value as SiteRole })}
          size="small"
          fullWidth
        >
          {ROLES.filter((r) => r !== 'owner' && (isOwner || r !== 'admin')).map((r) => (
            <MenuItem key={r} value={r}>
              <ListItemText
                primary={t(`members.roles.${r}`)}
                secondary={t(`members.roleDescriptions.${r}`)}
              />
            </MenuItem>
          ))}
        </TextField>
        <Paper variant="outlined" sx={{ maxHeight: 240, overflow: 'auto' }}>
          {filteredClerkUsers.length === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ p: 2, textAlign: 'center' }}
            >
              {t('members.addDialog.noResults')}
            </Typography>
          ) : (
            filteredClerkUsers.map((u: ClerkUser) => (
              <Box
                key={u.id}
                onClick={() => dispatch({ type: 'setAddClerkUserId', value: u.id })}
                sx={{
                  p: 1.5,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  bgcolor: ui.addClerkUserId === u.id ? 'action.selected' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Avatar src={u.image_url || undefined} sx={{ width: 28, height: 28 }}>
                  {(u.name ?? '?')[0]}
                </Avatar>
                <Box>
                  <Typography variant="body2">{u.name || u.id}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {u.email}
                  </Typography>
                </Box>
              </Box>
            ))
          )}
        </Paper>
      </FormDialog>

      <ConfirmDialog
        open={!!ui.removingMember}
        title={t('members.removeDialog.title')}
        message={t('members.removeDialog.message')}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() =>
          ui.removingMember && removeMemberMutation.mutate(ui.removingMember.id)
        }
        onCancel={() => dispatch({ type: 'closeRemove' })}
        confirmationText={t('common.actions.delete')}
      />

      <ConfirmDialog
        open={!!ui.transferTarget}
        title={t('members.transferDialog.title')}
        message={t('members.transferDialog.message', {
          name: ui.transferTarget?.name || ui.transferTarget?.clerk_user_id,
        })}
        confirmLabel={t('members.transferDialog.confirm')}
        onConfirm={() =>
          ui.transferTarget && transferMutation.mutate(ui.transferTarget.clerk_user_id)
        }
        onCancel={() => dispatch({ type: 'closeTransfer' })}
      />

      <ConfirmDialog
        open={ui.leaveOpen}
        title={t('members.leaveConfirm.title', { siteName: selectedSite?.name ?? '' })}
        message={t('members.leaveConfirm.message')}
        confirmLabel={t('members.leaveConfirm.confirm')}
        onConfirm={() => leaveMutation.mutate()}
        onCancel={() => dispatch({ type: 'closeLeave' })}
        loading={leaveMutation.isPending}
      />

    </Box>
  );
}
