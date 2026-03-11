import { useReducer, useEffect } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Chip,
  IconButton,
  ListItemText,
  MenuItem,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import apiService from '@/services/api';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type { SiteMembership, SiteRole, ClerkUser } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

const ROLES: SiteRole[] = ['owner', 'admin', 'editor', 'author', 'reviewer', 'viewer'];

interface UIState {
  addOpen: boolean;
  addRole: SiteRole;
  addClerkUserId: string;
  clerkSearch: string;
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
  | { type: 'openRemove'; member: SiteMembership }
  | { type: 'closeRemove' }
  | { type: 'openTransfer'; member: SiteMembership }
  | { type: 'closeTransfer' };

const initialUIState: UIState = {
  addOpen: false,
  addRole: 'viewer',
  addClerkUserId: '',
  clerkSearch: '',
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

export default function MembersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const { selectedSiteId } = useSiteContext();
  const { canManageMembers, isOwner, clerkUserId } = useAuth();

  const [ui, dispatch] = useReducer(uiReducer, initialUIState);

  // Command palette action listener
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'add-member') dispatch({ type: 'openAdd' });
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, []);

  // Clerk users for the add member dialog
  const { data: clerkUsers } = useQuery({
    queryKey: ['clerkUsers'],
    queryFn: () => apiService.getClerkUsers({ limit: 100 }),
    enabled: ui.addOpen,
  });

  const { data: members, isLoading, error } = useQuery({
    queryKey: ['members', selectedSiteId],
    queryFn: () => apiService.getSiteMembers(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const addMemberMutation = useMutation({
    mutationFn: () => apiService.addSiteMember(selectedSiteId, { clerk_user_id: ui.addClerkUserId, role: ui.addRole }),
    onSuccess: () => {
      showSuccess(t('members.messages.added'));
      queryClient.invalidateQueries({ queryKey: ['members', selectedSiteId] });
      dispatch({ type: 'resetAddForm' });
    },
    onError: (err) => { showError(err); },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: SiteRole }) =>
      apiService.updateMemberRole(selectedSiteId, memberId, { role }),
    onSuccess: () => {
      showSuccess(t('members.messages.roleUpdated'));
      queryClient.invalidateQueries({ queryKey: ['members', selectedSiteId] });
    },
    onError: (err) => { showError(err); },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => apiService.removeSiteMember(selectedSiteId, memberId),
    onSuccess: () => {
      showSuccess(t('members.messages.removed'));
      queryClient.invalidateQueries({ queryKey: ['members', selectedSiteId] });
      dispatch({ type: 'closeRemove' });
    },
    onError: (err) => { showError(err); },
  });

  const transferMutation = useMutation({
    mutationFn: (newOwnerClerkUserId: string) =>
      apiService.transferOwnership(selectedSiteId, { new_owner_clerk_user_id: newOwnerClerkUserId }),
    onSuccess: () => {
      showSuccess(t('members.messages.ownershipTransferred'));
      queryClient.invalidateQueries({ queryKey: ['members', selectedSiteId] });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      dispatch({ type: 'closeTransfer' });
    },
    onError: (err) => { showError(err); },
  });

  if (!selectedSiteId) {
    return (
      <Box data-testid="members.page">
        <PageHeader title={t('members.title')} subtitle={t('members.subtitle')} />
        <EmptyState title={t('members.empty.noSite')} />
      </Box>
    );
  }

  if (isLoading) return <LoadingState label={t('members.loading')} />;
  if (error) return <EmptyState title={t('members.loadError')} />;

  const roleColor = (role: SiteRole): 'error' | 'warning' | 'info' | 'success' | 'default' => {
    switch (role) {
      case 'owner': return 'error';
      case 'admin': return 'warning';
      case 'editor': return 'info';
      case 'author': return 'success';
      default: return 'default';
    }
  };

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

  return (
    <Box data-testid="members.page">
      <PageHeader
        title={t('members.title')}
        subtitle={t('members.subtitle')}
        action={{ label: t('members.addMember'), onClick: () => dispatch({ type: 'openAdd' }), hidden: !canManageMembers }}
      />

      {!members?.length ? (
        <EmptyState title={t('members.empty.title')} description={t('members.empty.description')} />
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('members.table.name')}</TableCell>
                <TableCell>{t('members.table.email')}</TableCell>
                <TableCell>{t('members.table.role')}</TableCell>
                <TableCell>{t('members.table.joined')}</TableCell>
                {canManageMembers && <TableCell align="right">{t('members.table.actions')}</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Avatar src={member.image_url || undefined} sx={{ width: 32, height: 32 }}>
                        {(member.name ?? '?')[0]}
                      </Avatar>
                      <Typography variant="body2">{member.name || member.clerk_user_id.slice(0, 12)}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">{member.email || '\u2014'}</Typography>
                  </TableCell>
                  <TableCell>
                    {canManageMembers && member.role !== 'owner' ? (
                      <TextField
                        select
                        size="small"
                        value={member.role}
                        onChange={(e) => updateRoleMutation.mutate({ memberId: member.id, role: e.target.value as SiteRole })}
                        sx={{ minWidth: 120 }}
                      >
                        {ROLES.filter((r) => isOwner || (r !== 'owner' && r !== 'admin')).map((r) => (
                          <MenuItem key={r} value={r}>{t(`members.roles.${r}`)}</MenuItem>
                        ))}
                      </TextField>
                    ) : (
                      <Chip label={t(`members.roles.${member.role}`)} color={roleColor(member.role)} size="small" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {format(new Date(member.created_at), 'PP')}
                    </Typography>
                  </TableCell>
                  {canManageMembers && (
                    <TableCell align="right">
                      {member.role !== 'owner' && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => dispatch({ type: 'openRemove', member })}
                          aria-label={t('common.actions.delete')}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                      {isOwner && member.role !== 'owner' && member.clerk_user_id !== clerkUserId && (
                        <IconButton
                          size="small"
                          onClick={() => dispatch({ type: 'openTransfer', member })}
                          aria-label={t('members.transferDialog.title')}
                        >
                          <SwapHorizIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add Member Dialog */}
      <Dialog open={ui.addOpen} onClose={() => dispatch({ type: 'closeAdd' })} maxWidth="sm" fullWidth aria-labelledby="add-member-dialog-title">
        <DialogTitle id="add-member-dialog-title">{t('members.addDialog.title')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
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
              {ROLES.filter((r) => r !== 'owner').map((r) => (
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
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
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
                      <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                    </Box>
                  </Box>
                ))
              )}
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => dispatch({ type: 'closeAdd' })}>{t('common.actions.cancel')}</Button>
          <Button
            variant="contained"
            disabled={!ui.addClerkUserId || addMemberMutation.isPending}
            onClick={() => addMemberMutation.mutate()}
          >
            {t('common.actions.add')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove Member Confirmation */}
      <ConfirmDialog
        open={!!ui.removingMember}
        title={t('members.removeDialog.title')}
        message={t('members.removeDialog.message')}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => ui.removingMember && removeMemberMutation.mutate(ui.removingMember.id)}
        onCancel={() => dispatch({ type: 'closeRemove' })}
        confirmationText={t('common.actions.delete')}
      />

      {/* Transfer Ownership Confirmation */}
      <ConfirmDialog
        open={!!ui.transferTarget}
        title={t('members.transferDialog.title')}
        message={t('members.transferDialog.message', { name: ui.transferTarget?.name || ui.transferTarget?.clerk_user_id })}
        confirmLabel={t('members.transferDialog.confirm')}
        onConfirm={() => ui.transferTarget && transferMutation.mutate(ui.transferTarget.clerk_user_id)}
        onCancel={() => dispatch({ type: 'closeTransfer' })}
      />
    </Box>
  );
}
