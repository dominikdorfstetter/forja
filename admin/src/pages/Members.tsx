import { useState } from 'react';
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
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
import type { SiteMembership, SiteRole, ClerkUser } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

const ROLES: SiteRole[] = ['owner', 'admin', 'editor', 'author', 'reviewer', 'viewer'];

export default function MembersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { selectedSiteId } = useSiteContext();
  const { canManageMembers, isOwner, clerkUserId } = useAuth();

  const [addOpen, setAddOpen] = useState(false);
  const [addRole, setAddRole] = useState<SiteRole>('viewer');
  const [addClerkUserId, setAddClerkUserId] = useState('');
  const [removingMember, setRemovingMember] = useState<SiteMembership | null>(null);
  const [transferTarget, setTransferTarget] = useState<SiteMembership | null>(null);

  // Clerk users for the add member dialog
  const [clerkSearch, setClerkSearch] = useState('');
  const { data: clerkUsers } = useQuery({
    queryKey: ['clerkUsers'],
    queryFn: () => apiService.getClerkUsers({ limit: 100 }),
    enabled: addOpen,
  });

  const { data: members, isLoading, error } = useQuery({
    queryKey: ['members', selectedSiteId],
    queryFn: () => apiService.getSiteMembers(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const addMemberMutation = useMutation({
    mutationFn: () => apiService.addSiteMember(selectedSiteId, { clerk_user_id: addClerkUserId, role: addRole }),
    onSuccess: () => {
      enqueueSnackbar(t('members.messages.added'), { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['members', selectedSiteId] });
      setAddOpen(false);
      setAddClerkUserId('');
      setAddRole('viewer');
    },
    onError: (err) => { const e = resolveError(err); enqueueSnackbar(e.detail || e.title, { variant: 'error' }); },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: SiteRole }) =>
      apiService.updateMemberRole(selectedSiteId, memberId, { role }),
    onSuccess: () => {
      enqueueSnackbar(t('members.messages.roleUpdated'), { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['members', selectedSiteId] });
    },
    onError: (err) => { const e = resolveError(err); enqueueSnackbar(e.detail || e.title, { variant: 'error' }); },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => apiService.removeSiteMember(selectedSiteId, memberId),
    onSuccess: () => {
      enqueueSnackbar(t('members.messages.removed'), { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['members', selectedSiteId] });
      setRemovingMember(null);
    },
    onError: (err) => { const e = resolveError(err); enqueueSnackbar(e.detail || e.title, { variant: 'error' }); },
  });

  const transferMutation = useMutation({
    mutationFn: (newOwnerClerkUserId: string) =>
      apiService.transferOwnership(selectedSiteId, { new_owner_clerk_user_id: newOwnerClerkUserId }),
    onSuccess: () => {
      enqueueSnackbar(t('members.messages.ownershipTransferred'), { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['members', selectedSiteId] });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      setTransferTarget(null);
    },
    onError: (err) => { const e = resolveError(err); enqueueSnackbar(e.detail || e.title, { variant: 'error' }); },
  });

  if (!selectedSiteId) {
    return (
      <Box>
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
    if (!clerkSearch) return true;
    const q = clerkSearch.toLowerCase();
    return (
      u.id.toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.name ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <Box>
      <PageHeader
        title={t('members.title')}
        subtitle={t('members.subtitle')}
        action={{ label: t('members.addMember'), onClick: () => setAddOpen(true), hidden: !canManageMembers }}
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
                    <Typography variant="body2" color="text.secondary">{member.email || '—'}</Typography>
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
                          onClick={() => setRemovingMember(member)}
                          aria-label={t('common.actions.delete')}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                      {isOwner && member.role !== 'owner' && member.clerk_user_id !== clerkUserId && (
                        <IconButton
                          size="small"
                          onClick={() => setTransferTarget(member)}
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
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('members.addDialog.title')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('members.addDialog.searchPlaceholder')}
              value={clerkSearch}
              onChange={(e) => setClerkSearch(e.target.value)}
              size="small"
              fullWidth
            />
            <TextField
              label={t('members.addDialog.selectRole')}
              select
              value={addRole}
              onChange={(e) => setAddRole(e.target.value as SiteRole)}
              size="small"
              fullWidth
            >
              {ROLES.filter((r) => r !== 'owner').map((r) => (
                <MenuItem key={r} value={r}>{t(`members.roles.${r}`)}</MenuItem>
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
                    onClick={() => setAddClerkUserId(u.id)}
                    sx={{
                      p: 1.5,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      bgcolor: addClerkUserId === u.id ? 'action.selected' : 'transparent',
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
          <Button onClick={() => setAddOpen(false)}>{t('common.actions.cancel')}</Button>
          <Button
            variant="contained"
            disabled={!addClerkUserId || addMemberMutation.isPending}
            onClick={() => addMemberMutation.mutate()}
          >
            {t('common.actions.add')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove Member Confirmation */}
      <ConfirmDialog
        open={!!removingMember}
        title={t('members.removeDialog.title')}
        message={t('members.removeDialog.message')}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => removingMember && removeMemberMutation.mutate(removingMember.id)}
        onCancel={() => setRemovingMember(null)}
      />

      {/* Transfer Ownership Confirmation */}
      <ConfirmDialog
        open={!!transferTarget}
        title={t('members.transferDialog.title')}
        message={t('members.transferDialog.message', { name: transferTarget?.name || transferTarget?.clerk_user_id })}
        confirmLabel={t('members.transferDialog.confirm')}
        onConfirm={() => transferTarget && transferMutation.mutate(transferTarget.clerk_user_id)}
        onCancel={() => setTransferTarget(null)}
      />
    </Box>
  );
}
